import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { BookOpen, CalendarDays, ChartNoAxesColumn, NotebookPen, Settings } from "lucide-react";
import { useEffect } from "react";
import { cn } from "@/lib/cn";
import { dueNotices, registerWorker, showNotice } from "@/lib/study/notify";
import { StudyProvider, useStudy } from "@/lib/study/store";

const NAV = [
  { to: "/", label: "Hoje", icon: BookOpen },
  { to: "/plano", label: "Plano", icon: CalendarDays },
  { to: "/progresso", label: "Progresso", icon: ChartNoAxesColumn },
  { to: "/erros", label: "Erros", icon: NotebookPen },
  { to: "/ajustes", label: "Ajustes", icon: Settings },
] as const;

function Frame() {
  const { ready, loadError, settings, days, sessions, notifyLog, rememberNotify } = useStudy();
  const path = useRouterState({ select: (s) => s.location.pathname });

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

  if (!ready) {
    return (
      <main className="flex min-h-screen flex-col justify-end bg-bg px-6 py-16">
        <p className="font-display text-5xl text-fg">Reta</p>
        <p className="mt-2 text-muted">Abrindo o plano…</p>
        <div className="mt-8 h-1 w-40 overflow-hidden rounded-full bg-surface-2">
          <div className="reta-bar h-full w-full bg-primary" />
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-bg text-fg">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-fg"
      >
        Ir para o conteúdo
      </a>
      <div className="mx-auto flex max-w-6xl">
        <aside className="no-print sticky top-0 hidden h-screen w-56 shrink-0 flex-col gap-8 border-r border-border px-5 py-8 md:flex">
          <Link to="/" className="flex items-center gap-2">
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
                    "flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm",
                    active ? "bg-surface-2 text-primary" : "text-muted hover:bg-surface hover:text-fg",
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>
        <div className="min-w-0 flex-1">
          {loadError ? <p className="px-5 pt-4 text-sm text-clay-text">{loadError}</p> : null}
          <main id="conteudo" className="px-4 py-6 pb-36 md:px-8 md:py-8 md:pb-20">
            <Outlet />
          </main>
        </div>
      </div>
      <nav className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-border bg-bg/95 pb-12 backdrop-blur md:hidden" aria-label="Seções">
        <ul className="grid grid-cols-5">
          {NAV.map((item) => {
            const active = item.to === "/" ? path === "/" : path.startsWith(item.to);
            const Icon = item.icon;
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className={cn(
                    "flex min-h-14 flex-col items-center justify-center gap-1 text-xs",
                    active ? "text-primary" : "text-muted",
                  )}
                >
                  <Icon className="size-5" aria-hidden />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
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
