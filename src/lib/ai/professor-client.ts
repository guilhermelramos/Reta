import { previewPathPrefix } from "@/lib/preview-path-prefix";
import { AiRequestError, failureOf, type AiErrorKind } from "./errors.ts";
import { isNativeAi, nativeProfessorReply, type ProfessorInput } from "./xai-client";

/**
 * Chat do professor nos dois ambientes.
 *
 * - Web: `POST /api/professor` com stream SSE (comportamento de sempre).
 * - APK: CapacitorHttp não suporta SSE; a resposta vem completa e é entregue
 *   de uma vez ao callback. O texto final é idêntico.
 */

function apiPath(path: string): string {
  if (typeof window === "undefined") return path;
  const prefix = previewPathPrefix(window.location.hostname, window.location.pathname);
  return `${prefix ?? ""}${path}`;
}

function isOnline(): boolean {
  return typeof navigator === "undefined" || navigator.onLine !== false;
}

const KINDS: AiErrorKind[] = [
  "offline",
  "timeout",
  "unauthorized",
  "missing-key",
  "rate-limit",
  "server",
  "bad-request",
  "empty",
  "unknown",
];

function asKind(value: unknown): AiErrorKind {
  return typeof value === "string" && KINDS.includes(value as AiErrorKind)
    ? (value as AiErrorKind)
    : "unknown";
}

/** Mantém `kind`/status até a UI, que escolhe o texto e a ação do erro. */
function structured(error: unknown): AiRequestError {
  if (error instanceof AiRequestError) return error;
  const failure = failureOf(error, { online: isOnline() });
  return new AiRequestError(failure.message, failure.kind, {
    status: failure.status,
    retryAfterSeconds: failure.retryAfterSeconds,
  });
}

export type AskProfessorResult = { text: string; streamed: boolean };

export async function askProfessor(
  input: ProfessorInput,
  onRaw: (raw: string) => void,
): Promise<AskProfessorResult> {
  if (isNativeAi()) {
    const text = await nativeProfessorReply(input);
    onRaw(text);
    return { text, streamed: false };
  }
  try {
    return await webProfessor(input, onRaw);
  } catch (error) {
    // "Failed to fetch" e timeout do navegador viram o mesmo erro estruturado
    // usado no caminho nativo.
    throw structured(error);
  }
}

async function webProfessor(
  input: ProfessorInput,
  onRaw: (raw: string) => void,
): Promise<AskProfessorResult> {
  const res = await fetch(apiPath("/api/professor"), {
    method: "POST",
    signal: AbortSignal.timeout(15000),
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: input.messages,
      brief: input.brief,
      topic: input.topic,
      subtopic: input.subtopic,
      holdAnswer: input.holdAnswer,
      question: input.question,
      mistakes: input.mistakes,
      userKey: input.userKey,
    }),
  });

  if (!res.ok || !res.body) {
    const fail = (await res.json().catch(() => null)) as {
      error?: string;
      kind?: string;
      retryAfterSeconds?: number | null;
    } | null;
    throw new AiRequestError(
      fail?.error || "O professor não respondeu. A sessão continua.",
      asKind(fail?.kind),
      {
        status: res.status,
        retryAfterSeconds: fail?.retryAfterSeconds ?? null,
      },
    );
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let raw = "";
  let buf = "";
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    buf += decoder.decode(chunk.value, { stream: true });
    const parts = buf.split("\n\n");
    buf = parts.pop() ?? "";
    for (const part of parts) {
      const line = part
        .split("\n")
        .filter((item) => item.startsWith("data:"))
        .map((item) => item.slice(5).trim())
        .join("");
      if (!line || line === "[DONE]") continue;
      const json = JSON.parse(line) as { t?: string; error?: string };
      if (json.error) throw new AiRequestError(json.error, "server");
      if (json.t) raw += json.t;
    }
    onRaw(raw);
  }

  if (!raw.trim()) throw new Error("A resposta veio vazia. Tente de novo. A sessão continua.");
  return { text: raw, streamed: true };
}
