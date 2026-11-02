import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Bell, ChevronDown, ExternalLink, Eye, EyeOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ButtonSpinner } from "@/components/feedback/button-spinner";
import { InlineError } from "@/components/feedback/inline-error";
import { pingAiClient } from "@/lib/ai/xai-client";
import { cn } from "@/lib/cn";
import type { ErrorCopy, FeedbackAction, FeedbackKind } from "@/lib/feedback/error-copy";
import { describeError, sheetErrorCopy, sheetProblemFromWarning } from "@/lib/feedback/error-copy";
import { saveAndShare } from "@/lib/native/files";
import {
  getNotificationPermissionState,
  isNativeNotificationService,
  requestNativeNotifications,
  requestNotificationPermission,
} from "@/lib/native/notifications";
import { setKey } from "@/lib/secure/keys";
import {
  applyMap,
  guessMap,
  missingRequiredColumns,
  pickSheet,
  COLUMN_FIELDS,
} from "@/lib/study/parse-sheet";
import { readWorkbookOffThread, SheetReadError } from "@/lib/study/parse-sheet-client";
import {
  isKeyCheckSuccess,
  isValidKeyDraft,
  keyCheckErrorCopy,
  nextOnboardingStep,
  ONBOARDING_STEP_COUNT,
  previousOnboardingStep,
  shouldShowPlanDayCount,
  type KeyCheckErrorCopy,
  type KeyCheckFailure,
  type OnboardingStep,
} from "@/lib/study/onboarding";
import { StudyProvider, useStudy } from "@/lib/study/store";

/**
 * Introdução em 4 telas (rota fora da barra de navegação).
 *
 * Reaproveita o que já existe: a importação passa pelo mesmo Web Worker e pelo
 * mesmo parser da tela Importar; a planilha modelo usa o mesmo gerador e o
 * mesmo `saveAndShare` (Filesystem + Share no APK); a verificação da chave usa
 * o cliente xAI (server function na web, CapacitorHttp no APK); a permissão de
 * notificação usa o serviço nativo (`src/lib/native`). Nada de servidor novo.
 */

const EMPTY_FILE_MESSAGE =
  "O arquivo está vazio. Escolha uma planilha .xlsx ou .csv com os dias do plano.";
const CORRUPTED_FILE_MESSAGE =
  "Não consegui ler este arquivo. Ele pode estar corrompido ou não ser uma planilha .xlsx/.csv válida. Baixe a planilha modelo e tente de novo.";
const VERIFY_TIMEOUT_MS = 15000;

export const Route = createFileRoute("/boas-vindas")({
  head: () => ({ meta: [{ title: "Boas-vindas · Reta" }] }),
  component: WelcomeRoute,
});

function WelcomeRoute() {
  return (
    <StudyProvider>
      <WelcomePage />
    </StudyProvider>
  );
}

function WelcomePage() {
  const study = useStudy();
  const navigate = useNavigate();
  const [step, setStep] = useState<OnboardingStep>(0);
  const [finishError, setFinishError] = useState("");
  const stepRef = useRef(step);
  stepRef.current = step;

  /**
   * "Voltar" do Android: um passo por toque. Na primeira tela não há para onde
   * voltar, então minimiza (o sistema pode encerrar depois; nada foi perdido).
   * Na web o navegador cuida do voltar e este listener nem é registrado.
   */
  useEffect(() => {
    let cancelled = false;
    let remove: (() => void) | undefined;
    void (async () => {
      const { Capacitor } = await import("@capacitor/core");
      if (cancelled || Capacitor.getPlatform() !== "android") return;
      const { App } = await import("@capacitor/app");
      const listener = await App.addListener("backButton", () => {
        const current = stepRef.current;
        if (current > 0) {
          setStep(previousOnboardingStep(current));
          return;
        }
        void App.minimizeApp().catch(() => undefined);
      });
      if (cancelled) {
        void listener.remove();
        return;
      }
      remove = () => {
        void listener.remove();
      };
    })();
    return () => {
      cancelled = true;
      remove?.();
    };
  }, []);

  if (!study.ready) {
    return (
      <main className="flex min-h-screen flex-col justify-end bg-bg px-6 py-16">
        <p className="font-display text-5xl text-fg">Reta</p>
        <p className="mt-2 text-muted">Preparando a introdução…</p>
        <div className="mt-8 h-1 w-40 overflow-hidden rounded-full bg-surface-2">
          <div className="reta-bar h-full w-full bg-primary" />
        </div>
      </main>
    );
  }

  async function finish() {
    try {
      await study.completeOnboarding();
      await navigate({ to: "/", replace: true });
    } catch {
      setFinishError("Não consegui guardar a introdução neste aparelho. Tente de novo.");
    }
  }

  function skip() {
    void finish();
  }

  return (
    <div className="min-h-screen bg-bg text-fg">
      <div className="onboarding-shell">
        <header className="onboarding-header flex min-h-12 items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <span className="size-3 rounded-sm bg-primary" aria-hidden />
            <span className="font-display text-2xl leading-none">Reta</span>
          </span>
          {/* Pontos e "Pular" na mesma linha: a contagem fica acessível pelo
              aria-label dos pontos em todos os passos. */}
          <span className="flex shrink-0 items-center gap-1">
            <StepDots step={step} />
            {step > 0 ? (
              <Button
                variant="ghost"
                className="min-h-12 min-w-12 px-3 text-muted"
                aria-label="Pular introdução"
                onClick={skip}
              >
                Pular
              </Button>
            ) : null}
          </span>
        </header>

        <div key={step} className="onboarding-body flex-1">
          {step === 0 ? <WelcomeStep onStart={() => setStep(1)} /> : null}
          {step === 1 ? (
            <SheetStep
              onDone={() => setStep(nextOnboardingStep(step))}
              onLater={() => setStep(nextOnboardingStep(step))}
            />
          ) : null}
          {step === 2 ? (
            <ProfessorStep
              onDone={() => setStep(nextOnboardingStep(step))}
              onSkip={() => setStep(nextOnboardingStep(step))}
            />
          ) : null}
          {step === 3 ? <RemindersStep onDone={() => void finish()} /> : null}
        </div>

        {finishError ? (
          <p
            role="alert"
            className="onboarding-footer mb-3 rounded-xl border border-clay/40 bg-clay/10 px-3 py-2.5 text-sm text-clay-text"
          >
            {finishError}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function StepDots({ step }: { step: OnboardingStep }) {
  return (
    <div
      role="progressbar"
      aria-label={`Passo ${step + 1} de ${ONBOARDING_STEP_COUNT}`}
      aria-valuemin={1}
      aria-valuemax={ONBOARDING_STEP_COUNT}
      aria-valuenow={step + 1}
      className="flex items-center gap-2"
    >
      {Array.from({ length: ONBOARDING_STEP_COUNT }, (_, index) => (
        <span
          key={index}
          aria-hidden
          className={
            index === step
              ? "h-2 w-7 rounded-full bg-primary transition-all"
              : "size-2 rounded-full bg-border transition-all"
          }
        />
      ))}
    </div>
  );
}

function WelcomeStep({ onStart }: { onStart: () => void }) {
  return (
    <section className="onboarding-step">
      <div className="onboarding-copy">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">Bem-vindo ao Reta</p>
        <h1 className="mt-3 text-4xl leading-tight">Seu plano até a prova, um bloco por vez.</h1>
        <p className="mt-5 text-base leading-relaxed text-muted">
          O Reta transforma a sua planilha de estudos em blocos com timer, questões e revisão. Tudo fica
          neste aparelho, e o plano funciona mesmo sem internet.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Em três telas você importa o plano, conecta o Grok (opcional) e escolhe se quer lembretes.
        </p>
      </div>
      <div className="onboarding-controls">
        <Button className="w-full" onClick={onStart}>
          Começar
        </Button>
      </div>
    </section>
  );
}

function fileCopy(title: string, message: string): ErrorCopy {
  return {
    ...describeError(message),
    title,
    message,
    detail: undefined,
    action: { id: "choose-file", label: "Escolher outro arquivo" },
    secondaryAction: { id: "download-template", label: "Baixar modelo" },
  };
}

function SheetStep({ onDone, onLater }: { onDone: () => void; onLater: () => void }) {
  const { importDays, days, seeded } = useStudy();
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<ErrorCopy | null>(null);
  const [note, setNote] = useState("");
  const [importedThisSession, setImportedThisSession] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const showDayCount = shouldShowPlanDayCount({
    seeded,
    dayCount: days.length,
    importedThisSession,
  });

  async function onFile(file: File) {
    setError(null);
    setNote("");
    if (file.size === 0) {
      setError(fileCopy("O arquivo está vazio", EMPTY_FILE_MESSAGE));
      return;
    }
    if (file.size > 5_000_000) {
      setError(fileCopy("Arquivo grande demais", "O limite é 5 MB. Escolha um arquivo menor."));
      return;
    }
    setReading(true);
    try {
      const tables = await readWorkbookOffThread(await file.arrayBuffer());
      const usable = tables.filter((table) => table.matrix.length > 0);
      if (!usable.length) {
        setError(fileCopy("A planilha está vazia", EMPTY_FILE_MESSAGE));
        return;
      }
      const target = pickSheet(usable) ?? usable[0]!;
      const map = guessMap(target.headers);
      const missing = missingRequiredColumns(map);
      if (missing.length) {
        setError(
          sheetErrorCopy({
            missingColumns: missing.map(
              (key) => COLUMN_FIELDS.find((field) => field.key === key)?.label ?? key,
            ),
            ...(target.headerRow >= 0 ? { row: target.headerRow + 1 } : {}),
          }),
        );
        return;
      }
      const preview = applyMap(target.matrix, target.headerRow, map);
      if (!preview.days.length) {
        setError(
          sheetErrorCopy(
            preview.warnings[0]
              ? sheetProblemFromWarning(preview.warnings[0])
              : { reason: "Nenhum dia válido encontrado." },
          ),
        );
        return;
      }
      await importDays(preview.days, target.name);
      setImportedThisSession(true);
      setNote(`${preview.days.length} dias importados.`);
      onDone();
    } catch (err) {
      setError(
        err instanceof SheetReadError && err.code === "empty"
          ? fileCopy("O arquivo está vazio", EMPTY_FILE_MESSAGE)
          : fileCopy("Não consegui ler essa planilha", CORRUPTED_FILE_MESSAGE),
      );
    } finally {
      setReading(false);
    }
  }

  async function downloadTemplate() {
    setError(null);
    setNote("");
    try {
      // Mesmo gerador e mesmo caminho nativo da tela Importar.
      const { buildTemplateWorkbook } = await import("@/lib/study/parse-sheet-workbook");
      const bytes = buildTemplateWorkbook();
      const mime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      const result = await saveAndShare(
        "reta-planilha-modelo.xlsx",
        mime,
        new Blob([bytes], { type: mime }),
      );
      setNote(
        result.mode === "canceled"
          ? "Compartilhamento cancelado."
          : result.mode === "shared"
            ? "Planilha modelo pronta para salvar."
            : "Planilha modelo salva no aparelho.",
      );
    } catch {
      setError({
        ...describeError("Não consegui gerar a planilha modelo. Tente de novo."),
        action: { id: "download-template", label: "Baixar modelo" },
      });
    }
  }

  function handleAction(action: FeedbackAction) {
    if (action.id === "choose-file") fileInput.current?.click();
    else if (action.id === "download-template") void downloadTemplate();
  }

  return (
    <section className="onboarding-step">
      <div className="onboarding-copy">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">Planilha</p>
        <h1 className="mt-3 text-4xl leading-tight">Importe sua planilha ou use o modelo.</h1>
        <p className="mt-4 text-base leading-relaxed text-muted">
          Entram só data, bloco A, bloco B e revisão, com o tempo de cada um. Se preferir, avance e importe
          depois em <span className="font-semibold text-fg">Planilha</span>.
        </p>
      </div>

      <div className="onboarding-controls">
        <div className="flex flex-col gap-3">
          <Button disabled={reading} onClick={() => fileInput.current?.click()}>
            {reading ? (
              <>
                <ButtonSpinner />
                Lendo a planilha…
              </>
            ) : (
              "Importar .xlsx"
            )}
          </Button>
          <Button variant="surface" onClick={() => void downloadTemplate()}>
            Baixar modelo
          </Button>
        </div>

        <input
          ref={fileInput}
          className="sr-only"
          type="file"
          disabled={reading}
          accept=".xlsx,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = "";
            if (file) void onFile(file);
          }}
        />

        <p className="mt-4 text-xs leading-relaxed text-muted">
          Formatos aceitos: .xlsx e .csv. Datas em dd/mm/aaaa ou aaaa-mm-dd.
        </p>

        {/* Só anuncia "N dias no plano atual" quando o plano não é o exemplo. */}
        {showDayCount ? (
          <p className="mt-1 text-xs leading-relaxed text-muted">{days.length} dias no plano atual.</p>
        ) : null}

        {note ? (
          <p
            role="status"
            className="mt-4 rounded-xl border border-primary/40 bg-surface px-3 py-2.5 text-sm"
          >
            {note}
          </p>
        ) : null}
        {error ? <InlineError copy={error} onAction={handleAction} className="mt-4" /> : null}

        {/* Avança só para o Professor IA; não encerra a introdução. */}
        <Button
          variant="ghost"
          className="mt-3 min-h-12 w-full px-4 text-sm font-medium text-muted"
          disabled={reading}
          onClick={onLater}
        >
          Agora não (usar plano de exemplo)
        </Button>
      </div>
    </section>
  );
}

const INLINE_KIND: Record<KeyCheckErrorCopy["kind"], FeedbackKind> = {
  invalid: "unauthorized",
  "rate-limit": "rate-limit",
  offline: "offline",
  unknown: "unknown",
};

const INLINE_TITLE: Record<KeyCheckErrorCopy["kind"], string> = {
  invalid: "Chave recusada",
  "rate-limit": "Limite atingido",
  offline: "Sem internet",
  unknown: "Não deu para verificar",
};

function keyErrorCopy(error: KeyCheckErrorCopy): ErrorCopy {
  return {
    kind: INLINE_KIND[error.kind],
    title: INLINE_TITLE[error.kind],
    message: error.message,
  };
}

function ProfessorStep({ onDone, onSkip }: { onDone: () => void; onSkip: () => void }) {
  const [keyDraft, setKeyDraft] = useState("");
  const [reveal, setReveal] = useState(false);
  const [checking, setChecking] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [error, setError] = useState<ErrorCopy | null>(null);
  const emptyKey = !isValidKeyDraft(keyDraft);

  function online(): boolean {
    return typeof navigator === "undefined" || navigator.onLine !== false;
  }

  async function paste() {
    try {
      const text = await navigator.clipboard.readText();
      if (text.trim()) setKeyDraft(text.trim());
    } catch {
      // Sem permissão de área de transferência: a pessoa cola manualmente.
    }
  }

  function openConsole() {
    window.open("https://console.x.ai/", "_blank", "noopener,noreferrer");
  }

  async function verify() {
    if (checking) return;
    setError(null);
    const key = keyDraft.trim();
    if (!isValidKeyDraft(key)) {
      setError({ kind: "unauthorized", title: "Falta a chave", message: "Cole a chave da xAI para verificar." });
      return;
    }
    setChecking(true);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("timeout")), VERIFY_TIMEOUT_MS);
      });
      const result = await Promise.race([
        pingAiClient({ provider: "grok", userKey: key }),
        timeout,
      ]);
      if (!isKeyCheckSuccess(result)) {
        // Resultado real de falha traz `failure`; uma resposta 200 que não é o
        // JSON da server function (host estático) cai no texto neutro.
        const failure: KeyCheckFailure =
          result && typeof result === "object" && (result as { ok?: unknown }).ok === false
            ? (((result as { failure?: KeyCheckFailure }).failure ??
                { message: String((result as { error?: unknown }).error ?? "") }) as KeyCheckFailure)
            : { kind: "unknown" };
        setError(keyErrorCopy(keyCheckErrorCopy(failure, { online: online() })));
        return;
      }
      // Só guarda depois que a xAI aceitou: Keystore no Android, IndexedDB na web.
      await setKey("xai", key);
      onDone();
    } catch {
      setError(keyErrorCopy(keyCheckErrorCopy({ kind: "timeout" }, { online: online() })));
    } finally {
      if (timer) clearTimeout(timer);
      setChecking(false);
    }
  }

  return (
    <section className="onboarding-step">
      <div className="onboarding-copy">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">
          Professor IA (opcional)
        </p>
        <h1 className="mt-3 text-4xl leading-tight">
          Conecte o Grok para gerar questões e tirar dúvidas
        </h1>
        <p className="mt-4 text-base leading-relaxed text-muted">
          Sem a chave o app continua funcionando: você perde só a geração de aulas novas e o chat com o
          professor.
        </p>
      </div>

      <div className="onboarding-controls">
        <details
          className="rounded-xl border border-border bg-surface"
          onToggle={(event) => setHelpOpen(event.currentTarget.open)}
        >
          <summary
            aria-expanded={helpOpen}
            className="flex min-h-[52px] cursor-pointer list-none items-center justify-between gap-3 px-4 text-sm font-semibold [&::-webkit-details-marker]:hidden"
            // O evento `toggle` do <details> não borbulha; o clique mantém o
            // estado do ícone/aria sincronizado também no React.
            onClick={() => setHelpOpen((open) => !open)}
          >
            Como conseguir a chave
            <ChevronDown
              aria-hidden
              className={cn(
                "size-6 shrink-0 text-muted transition-transform",
                helpOpen && "rotate-180",
              )}
            />
          </summary>
          <div className="border-t border-border px-4 py-3">
            <ol className="flex flex-col gap-2 text-sm leading-relaxed text-muted">
              <li className="flex gap-2">
                <span className="font-semibold text-primary" aria-hidden>1.</span>
                Crie sua conta no console da xAI.
              </li>
              <li className="flex gap-2">
                <span className="font-semibold text-primary" aria-hidden>2.</span>
                Crie uma API key (ela começa com <span className="font-semibold text-fg">xai-</span>).
              </li>
              <li className="flex gap-2">
                <span className="font-semibold text-primary" aria-hidden>3.</span>
                Cole a chave aqui embaixo.
              </li>
            </ol>
            <Button variant="surface" className="mt-3 w-full" onClick={openConsole}>
              Abrir console xAI
              <ExternalLink className="size-[18px]" aria-hidden />
            </Button>
          </div>
        </details>

        <label htmlFor="xai-key" className="mt-5 text-sm font-semibold">
          Chave da xAI
        </label>
        <div className="mt-1.5 flex gap-2">
          <div className="relative min-w-0 flex-1">
            <input
              id="xai-key"
              className="min-h-12 w-full rounded-xl border border-border bg-surface-2 px-3 pr-12 text-base text-fg placeholder:text-muted"
              type={reveal ? "text" : "password"}
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="xai-…"
              value={keyDraft}
              onChange={(event) => setKeyDraft(event.target.value)}
            />
            <button
              type="button"
              aria-label={reveal ? "Ocultar chave" : "Mostrar chave"}
              className="absolute right-0 top-0 flex size-12 items-center justify-center rounded-xl text-muted hover:text-fg"
              onClick={() => setReveal((value) => !value)}
            >
              {reveal ? (
                <EyeOff className="size-5" aria-hidden />
              ) : (
                <Eye className="size-5" aria-hidden />
              )}
            </button>
          </div>
          <Button variant="surface" className="shrink-0" onClick={() => void paste()}>
            Colar
          </Button>
        </div>

        {error ? <InlineError copy={error} className="mt-3" /> : null}

        <p className="mt-4 rounded-xl bg-surface px-3 py-2.5 text-xs leading-relaxed text-muted">
          A chave fica guardada só neste aparelho, criptografada. O uso é cobrado na sua conta xAI.
        </p>

        <div className="mt-6 flex flex-col gap-2">
          {/* Vazio = desabilitado; "checando" mantém o visual primário. */}
          <Button
            className={cn(
              emptyKey &&
                "disabled:bg-fg/[0.12] disabled:text-fg/[0.38] disabled:opacity-100",
            )}
            disabled={checking || emptyKey}
            onClick={() => void verify()}
          >
            {checking ? (
              <>
                <ButtonSpinner />
                Verificando…
              </>
            ) : (
              "Verificar chave"
            )}
          </Button>
          <Button variant="ghost" className="min-h-12" disabled={checking} onClick={onSkip}>
            Agora não
          </Button>
        </div>
      </div>
    </section>
  );
}

function RemindersStep({ onDone }: { onDone: () => void }) {
  const { settings, days, sessions, notifyLog } = useStudy();
  const [busy, setBusy] = useState(false);
  const [denied, setDenied] = useState(false);
  const [note, setNote] = useState("");

  // Quem já negou a permissão no sistema vê o aviso discreto sem tocar de novo.
  useEffect(() => {
    let live = true;
    void getNotificationPermissionState().then((state) => {
      if (live && state === "denied") setDenied(true);
    });
    return () => {
      live = false;
    };
  }, []);

  async function activate() {
    if (busy) return;
    setBusy(true);
    setNote("");
    try {
      if (isNativeNotificationService()) {
        // Só POST_NOTIFICATIONS aqui. Alarme exato e bateria ficam para o
        // momento de valor (início de um timer), nunca no onboarding.
        const status = await requestNativeNotifications();
        if (status.permission === "granted") {
          const { syncNativeNotifications } = await import("@/lib/native/notifications");
          await syncNativeNotifications({ settings, days, sessions, log: notifyLog });
          onDone();
          return;
        }
        if (status.error) setNote(`Não consegui pedir a permissão: ${status.error}`);
        setDenied(true);
        return;
      }

      if (typeof Notification === "undefined") {
        setDenied(true);
        return;
      }
      const permission = await requestNotificationPermission();
      if (permission === "granted") {
        onDone();
        return;
      }
      setDenied(true);
    } catch {
      setDenied(true);
    } finally {
      setBusy(false);
    }
  }

  const native = isNativeNotificationService();

  return (
    <section className="onboarding-step">
      <div className="onboarding-copy">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">Lembretes</p>
        {/* Mesmo padrão dos passos 1–3: título fora do cartão. */}
        <h1 className="mt-3 text-[clamp(22px,6vw,28px)] leading-[1.25]">
          Quer um aviso na hora de cada bloco e quando o timer acabar?
        </h1>
      </div>

      <div className="onboarding-controls">
        <section className="rounded-2xl border border-border bg-surface p-5">
          <span className="flex size-12 items-center justify-center rounded-full bg-primary/20 text-primary">
            <Bell className="size-6" aria-hidden />
          </span>
          <p className="mt-4 text-sm leading-relaxed text-muted">
            Os avisos são agendados no próprio aparelho e chegam com o app fechado.
          </p>
        </section>

        {/* Só depois de uma negação: o cartão não repete a frase. */}
        {denied ? (
          <p role="status" className="mt-3 text-xs leading-relaxed text-muted">
            Você pode ativar depois em Ajustes.
          </p>
        ) : null}
        {note ? (
          <p role="status" className="mt-3 text-sm">
            {note}
          </p>
        ) : null}

        <div className="mt-6 flex flex-col gap-2">
          {denied ? (
            <Button className={native ? "min-h-14" : undefined} onClick={onDone}>
              Continuar
            </Button>
          ) : (
            <>
              <Button
                className={native ? "min-h-14" : undefined}
                disabled={busy}
                onClick={() => void activate()}
              >
                {busy ? (
                  <>
                    <ButtonSpinner />
                    Ativando…
                  </>
                ) : (
                  "Ativar lembretes"
                )}
              </Button>
              <Button variant="ghost" className="min-h-12" disabled={busy} onClick={onDone}>
                Agora não
              </Button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
