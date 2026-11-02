import {
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  LogIn,
  LogOut,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ButtonSpinner } from "@/components/feedback/button-spinner";
import { InlineError } from "@/components/feedback/inline-error";
import { cn } from "@/lib/cn";
import type { ErrorCopy } from "@/lib/feedback/error-copy";
import {
  AuthDiagnostics,
  PollWake,
  pollDeviceToken,
  requestDeviceCode,
  XaiAuthError,
  xaiAuthErrorLines,
  xaiAuthMessage,
  type DeviceCode,
  type XaiAuthErrorCode,
} from "@/lib/ai/xai-auth/device";
import { XAI_OAUTH_NOTICE } from "@/lib/ai/xai-auth/config";
import { defaultAuthTransport, openVerificationPage } from "@/lib/ai/xai-auth/transport";
import { connectXaiAccount, disconnectXaiAccount, hasXaiAccount } from "@/lib/ai/xai-auth/session";

function loginError(message: string): ErrorCopy {
  return { kind: "unknown", title: "Login experimental", message };
}

/** Códigos em que repetir o mesmo `device_code` não adianta. */
function canRetryPoll(code: XaiAuthErrorCode): boolean {
  return (
    code !== "expired_token" &&
    code !== "access_denied" &&
    code !== "invalid_grant" &&
    code !== "invalid_request"
  );
}

/** Copia com fallback para WebViews sem `navigator.clipboard`. */
async function copyText(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // Tenta o fallback antigo abaixo.
  }
  try {
    const area = document.createElement("textarea");
    area.value = value;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const copied = document.execCommand("copy");
    document.body.removeChild(area);
    return copied;
  } catch {
    return false;
  }
}

/**
 * Login de conta xAI por device code (RFC 8628).
 *
 * Bloco recolhido, abaixo da chave xAI. A chave continua tendo prioridade; se
 * o login for recusado, o cliente mostra "Login de conta xAI recusado — use a
 * chave de API". Os tokens só entram no cofre seguro/sessão.
 *
 * O `device_code` e o prazo ficam só em memória: se o polling falhar (WebView
 * pausada, rede instável), "Já autorizei — verificar de novo" reaproveita o
 * mesmo código enquanto ele não expirar.
 */
export function XaiAccountLogin({
  onConnected,
  className,
}: {
  onConnected?: () => void;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [connected, setConnected] = useState(false);
  const [checking, setChecking] = useState(true);
  const [starting, setStarting] = useState(false);
  const [polling, setPolling] = useState(false);
  const [device, setDevice] = useState<{ code: DeviceCode; expiresAt: number } | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<ErrorCopy | null>(null);
  const [failure, setFailure] = useState<XaiAuthError | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const cancelled = useRef(false);
  const wakeRef = useRef<PollWake | null>(null);
  const diagnosticsRef = useRef<AuthDiagnostics | null>(null);
  const busy = starting || polling;

  useEffect(() => {
    let live = true;
    void hasXaiAccount().then((value) => {
      if (!live) return;
      setConnected(value);
      setChecking(false);
    });
    return () => {
      live = false;
      cancelled.current = true;
    };
  }, []);

  /**
   * O WebView pausa os timers em segundo plano. Ao voltar (nativo ou web),
   * acorda o sleep atual para o próximo poll sair imediatamente.
   */
  useEffect(() => {
    let removed = false;
    let removeNative: (() => void) | undefined;
    let lastNudge = 0;

    function nudge(reason: string) {
      const now = Date.now();
      if (now - lastNudge < 800) return;
      lastNudge = now;
      if (!wakeRef.current) return;
      diagnosticsRef.current?.add("wake", reason);
      wakeRef.current.wake();
    }

    function onVisibility() {
      if (document.visibilityState === "visible") {
        nudge("App voltou ao primeiro plano (web)");
      }
    }
    document.addEventListener("visibilitychange", onVisibility);

    void (async () => {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (!Capacitor.isNativePlatform()) return;
        const { App } = await import("@capacitor/app");
        const listener = await App.addListener("appStateChange", ({ isActive }) => {
          if (isActive) nudge("App voltou ao primeiro plano");
        });
        if (removed) {
          void listener.remove();
          return;
        }
        removeNative = () => {
          void listener.remove();
        };
      } catch {
        // Sem o plugin nativo, o `visibilitychange` da web já cobre.
      }
    })();

    return () => {
      removed = true;
      document.removeEventListener("visibilitychange", onVisibility);
      removeNative?.();
    };
  }, []);

  function cancel() {
    cancelled.current = true;
    wakeRef.current?.wake();
    setDevice(null);
    setStatus("");
    setStarting(false);
    setPolling(false);
    setError(null);
    setFailure(null);
    setDetailsOpen(false);
  }

  function showFailure(err: unknown, fallbackMessage: string) {
    const detail =
      err instanceof XaiAuthError
        ? err
        : new XaiAuthError(xaiAuthMessage("unknown"), "unknown", { at: Date.now() });
    setFailure(detail);
    setError(loginError(err instanceof XaiAuthError ? xaiAuthMessage(err.code) : fallbackMessage));
    setStatus("");
    if (err instanceof XaiAuthError && !canRetryPoll(err.code)) {
      setDevice(null);
    }
  }

  async function poll(deviceCode: DeviceCode, expiresAt: number, immediate: boolean) {
    const remainingSeconds = Math.floor((expiresAt - Date.now()) / 1000);
    if (remainingSeconds <= 0) {
      showFailure(
        new XaiAuthError(xaiAuthMessage("expired_token"), "expired_token", {
          attempts: 0,
          at: Date.now(),
          events: diagnosticsRef.current?.list(),
        }),
        xaiAuthMessage("expired_token"),
      );
      setDevice(null);
      return;
    }

    const diagnostics = diagnosticsRef.current ?? new AuthDiagnostics(30);
    diagnosticsRef.current = diagnostics;
    const wake = new PollWake();
    if (immediate) {
      diagnostics.add("wake", "Verificação pedida agora");
      wake.wake();
    }
    wakeRef.current = wake;
    setPolling(true);
    setError(null);
    setFailure(null);
    setDetailsOpen(false);
    setCopied(false);
    setStatus("Aguardando você autorizar no navegador…");

    try {
      const tokens = await pollDeviceToken(defaultAuthTransport(), {
        deviceCode: deviceCode.deviceCode,
        intervalSeconds: deviceCode.intervalSeconds,
        expiresInSeconds: remainingSeconds,
        wake,
        diagnostics,
        isCancelled: () => cancelled.current,
        onSlowDown: () => setStatus("A xAI pediu para esperar um pouco mais…"),
      });
      if (cancelled.current) return;
      await connectXaiAccount(tokens);
      setConnected(true);
      setDevice(null);
      setFailure(null);
      setStatus("Conta xAI conectada. A chave de API continua tendo prioridade.");
      onConnected?.();
    } catch (err) {
      if (cancelled.current) return;
      showFailure(err, xaiAuthMessage("unknown"));
    } finally {
      setPolling(false);
      if (wakeRef.current === wake) wakeRef.current = null;
    }
  }

  async function start() {
    if (busy) return;
    cancelled.current = false;
    diagnosticsRef.current = new AuthDiagnostics(30);
    setStarting(true);
    setError(null);
    setFailure(null);
    setStatus("");
    setDevice(null);
    setDetailsOpen(false);
    setCopied(false);
    try {
      const code = await requestDeviceCode(defaultAuthTransport(), {
        diagnostics: diagnosticsRef.current,
      });
      if (cancelled.current) return;
      const expiresAt = Date.now() + code.expiresInSeconds * 1000;
      setDevice({ code, expiresAt });
      setStatus("Aguardando você autorizar no navegador…");
      openVerificationPage(code.verificationUriComplete);
      setStarting(false);
      await poll(code, expiresAt, false);
    } catch (err) {
      if (cancelled.current) return;
      showFailure(err, "Não consegui pedir o código para a xAI. Tente de novo.");
    } finally {
      setStarting(false);
    }
  }

  function verifyAgain() {
    if (!device || polling) return;
    void poll(device.code, device.expiresAt, true);
  }

  async function signOut() {
    cancelled.current = true;
    setStarting(true);
    setError(null);
    setFailure(null);
    try {
      await disconnectXaiAccount();
      setConnected(false);
      setStatus("Conta xAI desconectada deste aparelho.");
    } catch {
      setError(loginError("Não consegui desconectar a conta xAI."));
    } finally {
      setStarting(false);
    }
  }

  async function copyDetails() {
    if (!failure) return;
    setCopied(await copyText(xaiAuthErrorLines(failure).join("\n")));
  }

  const retryAvailable =
    device != null &&
    failure != null &&
    canRetryPoll(failure.code) &&
    Date.now() < device.expiresAt;
  const detailLines = failure ? xaiAuthErrorLines(failure) : [];

  return (
    <details
      className={cn("group", className)}
      onToggle={(event) => {
        const open = event.currentTarget.open;
        setExpanded(open);
        if (!open) cancel();
      }}
    >
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-surface-2 [&::-webkit-details-marker]:hidden">
        <LogIn className="size-5 shrink-0 text-muted" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block text-base text-fg">Entrar com conta xAI (experimental)</span>
          <span className="mt-0.5 block text-sm leading-relaxed text-muted">
            {checking
              ? "Verificando…"
              : connected
                ? "Conta conectada neste aparelho."
                : "Alternativa à chave de API. Pode parar de funcionar."}
          </span>
        </span>
        <span
          className={cn(
            "shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold",
            connected
              ? "border-primary/60 bg-primary-tonal text-primary"
              : "border-border bg-surface-2 text-muted",
          )}
        >
          {connected ? "Conectada" : "Desconectada"}
        </span>
        <ChevronDown
          className="size-5 shrink-0 text-muted transition-transform group-open:rotate-180"
          aria-hidden
        />
      </summary>

      <div className="flex flex-col gap-3 border-t border-border px-4 py-4">
        <p className="flex items-start gap-2 text-xs leading-relaxed text-muted">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-clay-text" aria-hidden />
          {XAI_OAUTH_NOTICE}
        </p>

        {connected ? (
          <>
            <p className="text-sm leading-relaxed text-muted">
              O app usa o token no lugar da chave só quando não há chave xAI salva. Se a xAI recusar
              o login, cole a chave de API em Ajustes.
            </p>
            <Button
              variant="clay"
              className="self-start"
              disabled={starting}
              onClick={() => void signOut()}
            >
              <LogOut className="size-4" aria-hidden />
              Sair da conta xAI
            </Button>
          </>
        ) : device ? (
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface-2 p-4">
            <p className="text-sm leading-relaxed text-muted">
              Abra a página da xAI e digite este código:
            </p>
            <p className="text-center font-mono text-3xl font-semibold tracking-[0.2em] text-primary">
              {device.code.userCode}
            </p>
            <a
              href={device.code.verificationUriComplete}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-12 items-center justify-center gap-1.5 text-sm font-semibold text-primary underline-offset-4 hover:underline"
            >
              Abrir a página de verificação
              <ExternalLink className="size-4" aria-hidden />
            </a>
            <p className="text-center text-xs leading-relaxed text-muted" role="status">
              {polling
                ? status || "Verificando agora…"
                : failure
                  ? "A xAI ainda não confirmou o login."
                  : status || "Aguardando…"}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {retryAvailable ? (
                <Button variant="surface" disabled={polling} onClick={verifyAgain}>
                  {polling ? <ButtonSpinner /> : <RefreshCw className="size-4" aria-hidden />}
                  Já autorizei — verificar de novo
                </Button>
              ) : null}
              <Button variant="ghost" onClick={cancel}>
                Cancelar
              </Button>
            </div>
            {!retryAvailable && Date.now() >= device.expiresAt ? (
              <p className="text-center text-xs leading-relaxed text-muted">
                O código expirou. Feche e entre de novo para gerar outro.
              </p>
            ) : null}
          </div>
        ) : (
          <Button
            variant="surface"
            className="self-start"
            disabled={busy}
            onClick={() => void start()}
          >
            {busy ? (
              <>
                <ButtonSpinner />
                Abrindo…
              </>
            ) : (
              <>
                <LogIn className="size-4" aria-hidden />
                Entrar com conta xAI
              </>
            )}
          </Button>
        )}

        {status && !device ? (
          <p className="text-sm leading-relaxed text-muted" role="status">
            {status}
          </p>
        ) : null}
        {error ? <InlineError copy={error} /> : null}
        {failure && detailLines.length ? (
          <details
            className="group/diag rounded-xl border border-border bg-surface-2 px-3 py-2"
            open={detailsOpen}
            onToggle={(event) => setDetailsOpen(event.currentTarget.open)}
          >
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 text-sm font-semibold text-fg [&::-webkit-details-marker]:hidden">
              Detalhes técnicos
              <ChevronDown
                className="size-4 shrink-0 text-muted transition-transform group-open/diag:rotate-180"
                aria-hidden
              />
            </summary>
            <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-muted">
              {detailLines.join("\n")}
            </pre>
            <Button
              variant="ghost"
              className="mt-2 min-h-12 px-2 text-xs"
              onClick={() => void copyDetails()}
            >
              {copied ? (
                <Check className="size-4 text-success" aria-hidden />
              ) : (
                <Copy className="size-4" aria-hidden />
              )}
              {copied ? "Detalhes copiados" : "Copiar detalhes"}
            </Button>
          </details>
        ) : null}
        {!expanded ? null : (
          <p className="text-xs leading-relaxed text-muted">
            Nada depende deste login: com a chave de API tudo continua funcionando como antes.
          </p>
        )}
      </div>
    </details>
  );
}
