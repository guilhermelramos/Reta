import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { BookOpen, CalendarDays, ChartNoAxesColumn, NotebookPen, Settings } from "lucide-react";
import { useEffect } from "react";
import { cn } from "@/lib/cn";
import { syncNativeNotifications } from "@/lib/native/notifications";
import { dueNotices, registerWorker, showNotice } from "@/lib/study/notify";
import { hasImportedPlan, shouldShowOnboarding } from "@/lib/study/onboarding";
import { StudyProvider, useStudy } from "@/lib/study/store";

const NAV = [
  { to: "/", label: "Hoje", icon: BookOpen },
  { to: "/plano", label: "Plano", icon: CalendarDays },
  { to: "/progresso", label: "Progresso", icon: ChartNoAxesColumn },
  { to: "/erros", label: "Erros", icon: NotebookPen },
  { to: "/ajustes", label: "Ajustes", icon: Settings },
] as const;

function Frame() {
  const { ready, loadError, settings, days, sessions, notifyLog, keys, seeded, onboardingDone, rememberNotify } = useStudy();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  // Modo foco: a sessão de estudo esconde a navegação inferior e a barra
  // lateral (em qualquer largura) para o timer ocupar a tela inteira; a
  // paisagem usa o split view da própria sessão.
  const focusMode = path === "/sessao" || path.startsWith("/sessao/");

  // Primeira abertura (ou revisão pendente): a introdução mora fora da barra
  // de navegação. Chave salva ou planilha importada contam como "já feito".
  const showOnboarding =
    ready &&
    shouldShowOnboarding({
      onboardingDone,
      hasXaiKey: Boolean(keys.xai.trim()),
      hasImportedPlan: hasImportedPlan(seeded, days.length),
    });

  useEffect(() => {
    if (!showOnboarding) return;
    void navigate({ to: "/boas-vindas", replace: true });
  }, [showOnboarding, navigate]);

  useEffect(() => {
    registerWorker();
  }, []);

  useEffect(() => {
    if (!ready) return;
    const tick = () => {
      const today = days.find((d) => d.date === new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date()));
      const notices = dueNotices({ settings, today, sessions, log: notifyLog });
      if (!notices.length) return;
      const next = { ...notifyLog };
      for (const notice of notices) {
        next[notice.tag] = today?.date ?? next[notice.tag] ?? "";
        void showNotice(notice);
      }
      rememberNotify(next);
    };
    tick();
    const id = window.setInterval(tick, 30000);
    return () => window.clearInterval(id);
  }, [ready, settings, days, sessions, notifyLog, rememberNotify]);

  // No app nativo os avisos são alarmes do próprio Android: reagenda ao abrir
  // (e ao voltar do segundo plano) e sempre que o plano ou os ajustes mudam.
  // Na web a chamada é inerte e o tick acima continua sendo o comportamento.
  useEffect(() => {
    if (!ready) return;
    const sync = () => {
      void syncNativeNotifications({ settings, days, sessions, log: notifyLog });
    };
    sync();
    const onVisible = () => {
      if (document.visibilityState === "visible") sync();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [ready, settings, days, sessions, notifyLog]);

  if (!ready || showOnboarding) {
    return <Splash label={showOnboarding ? "Vamos começar…" : "Abrindo o plano…"} />;
  }

  return (
    <div className="min-h-screen bg-bg text-fg">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:flex focus:min-h-12 focus:items-center focus:rounded-xl focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-fg"
      >
        Ir para o conteúdo
      </a>
      <div className={focusMode ? undefined : "mx-auto flex max-w-6xl"}>
        {focusMode ? null : (
          <aside className="no-print sticky top-0 hidden h-screen w-56 shrink-0 flex-col gap-8 border-r border-border px-5 py-8 md:flex">
            <Link to="/" className="flex min-h-12 items-center gap-2">
              <span className="size-3 rounded-sm bg-primary" aria-hidden />
              <span className="font-display text-3xl leading-none">Reta</span>
            </Link>
            <nav className="flex flex-col gap-1" aria-label="Seções">
              {NAV.map((item) => {
                const active = item.to === "/" ? path === "/" : path.startsWith(item.to);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={cn(
                      "flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm",
                      active
                        ? "bg-surface-2 text-primary"
                        : "text-muted hover:bg-surface hover:text-fg",
                    )}
                  >
                    <Icon className="size-4" aria-hidden />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </aside>
        )}
        <div className="min-w-0 flex-1">
          {loadError ? <p className="px-5 pt-4 text-sm text-clay-text">{loadError}</p> : null}
          <main
            id="conteudo"
            className={
              focusMode
                ? undefined
                : "px-4 py-6 pb-[calc(6rem_+_env(safe-area-inset-bottom))] md:px-8 md:py-8 md:pb-20"
            }
          >
            <Outlet />
          </main>
        </div>
      </div>
      {focusMode ? null : (
        <nav
          className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-border bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
          aria-label="Seções"
        >
          {/* M3 Navigation bar: 80dp de conteúdo + safe area. */}
          <ul className="grid h-20 grid-cols-5">
            {NAV.map((item) => {
              const active = item.to === "/" ? path === "/" : path.startsWith(item.to);
              const Icon = item.icon;
              return (
                <li key={item.to} className="min-w-0">
                  <Link
                    to={item.to}
                    aria-current={active ? "page" : undefined}
                    className="flex h-full w-full flex-col items-center justify-center gap-1 px-1 text-xs font-medium"
                  >
                    <span
                      className={cn(
                        "flex h-8 w-16 items-center justify-center rounded-full transition-colors",
                        active ? "bg-primary/25" : "bg-transparent",
                      )}
                    >
                      <Icon
                        className={cn("size-6", active ? "text-fg" : "text-muted")}
                        aria-hidden
                      />
                    </span>
                    <span className={active ? "text-fg" : "text-muted"}>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </div>
  );
}

export function ShellLayout() {
  return (
    <StudyProvider>
      <Frame />
    </StudyProvider>
  );
}

/** Tela de espera curta (carregando ou saindo para a introdução). */
function Splash({ label }: { label: string }) {
  return (
    <main className="flex min-h-screen flex-col justify-end bg-bg px-6 py-16">
      <p className="font-display text-5xl text-fg">Reta</p>
      <p className="mt-2 text-muted">{label}</p>
      <div className="mt-8 h-1 w-40 overflow-hidden rounded-full bg-surface-2">
        <div className="reta-bar h-full w-full bg-primary" />
      </div>
    </main>
  );
}
