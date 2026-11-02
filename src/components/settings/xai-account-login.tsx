import { ChevronDown, ExternalLink, LogIn, LogOut, ShieldAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ButtonSpinner } from "@/components/feedback/button-spinner";
import { InlineError } from "@/components/feedback/inline-error";
import { cn } from "@/lib/cn";
import type { ErrorCopy } from "@/lib/feedback/error-copy";
import {
  pollDeviceToken,
  requestDeviceCode,
  XaiAuthError,
  xaiAuthMessage,
  type DeviceCode,
} from "@/lib/ai/xai-auth/device";
import { XAI_OAUTH_NOTICE } from "@/lib/ai/xai-auth/config";
import {
  defaultAuthTransport,
  openVerificationPage,
} from "@/lib/ai/xai-auth/transport";
import {
  connectXaiAccount,
  disconnectXaiAccount,
  hasXaiAccount,
} from "@/lib/ai/xai-auth/session";

function loginError(message: string): ErrorCopy {
  return { kind: "unknown", title: "Login experimental", message };
}

/**
 * Login de conta xAI por device code (RFC 8628).
 *
 * Bloco recolhido, abaixo da chave xAI. A chave continua tendo prioridade; se
 * o login for recusado, o cliente mostra "Login de conta xAI recusado — use a
 * chave de API". Os tokens só entram no cofre seguro/sessão.
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
  const [code, setCode] = useState<DeviceCode | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<ErrorCopy | null>(null);
  const cancelled = useRef(false);

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

  function cancel() {
    cancelled.current = true;
    setCode(null);
    setStatus("");
    setStarting(false);
  }

  async function start() {
    if (starting) return;
    cancelled.current = false;
    setStarting(true);
    setError(null);
    setStatus("");
    setCode(null);
    try {
      const device = await requestDeviceCode(defaultAuthTransport());
      setCode(device);
      setStatus("Aguardando você autorizar no navegador…");
      openVerificationPage(device.verificationUriComplete);
      const tokens = await pollDeviceToken(defaultAuthTransport(), {
        deviceCode: device.deviceCode,
        intervalSeconds: device.intervalSeconds,
        expiresInSeconds: device.expiresInSeconds,
        isCancelled: () => cancelled.current,
        onSlowDown: () => setStatus("A xAI pediu para esperar um pouco mais…"),
      });
      if (cancelled.current) return;
      await connectXaiAccount(tokens);
      setConnected(true);
      setCode(null);
      setStatus("Conta xAI conectada. A chave de API continua tendo prioridade.");
      onConnected?.();
    } catch (err) {
      if (cancelled.current) return;
      const message =
        err instanceof XaiAuthError ? xaiAuthMessage(err.code) : xaiAuthMessage("unknown");
      setError(loginError(message));
      setStatus("");
      setCode(null);
    } finally {
      setStarting(false);
    }
  }

  async function signOut() {
    cancelled.current = true;
    setStarting(true);
    setError(null);
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
              O app usa o token no lugar da chave só quando não há chave xAI salva. Se a xAI
              recusar o login, cole a chave de API em Ajustes.
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
        ) : code ? (
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface-2 p-4">
            <p className="text-sm leading-relaxed text-muted">
              Abra a página da xAI e digite este código:
            </p>
            <p className="text-center font-mono text-3xl font-semibold tracking-[0.2em] text-primary">
              {code.userCode}
            </p>
            <a
              href={code.verificationUriComplete}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-12 items-center justify-center gap-1.5 text-sm font-semibold text-primary underline-offset-4 hover:underline"
            >
              Abrir a página de verificação
              <ExternalLink className="size-4" aria-hidden />
            </a>
            <p className="text-center text-xs leading-relaxed text-muted" role="status">
              {status || "Aguardando…"}
            </p>
            <Button variant="ghost" className="self-center" onClick={cancel}>
              Cancelar
            </Button>
          </div>
        ) : (
          <Button
            variant="surface"
            className="self-start"
            disabled={starting}
            onClick={() => void start()}
          >
            {starting ? (
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

        {status && !code ? (
          <p className="text-sm leading-relaxed text-muted" role="status">
            {status}
          </p>
        ) : null}
        {error ? <InlineError copy={error} /> : null}
        {!expanded ? null : (
          <p className="text-xs leading-relaxed text-muted">
            Nada depende deste login: com a chave de API tudo continua funcionando como antes.
          </p>
        )}
      </div>
    </details>
  );
}
