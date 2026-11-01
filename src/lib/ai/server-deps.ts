import type { ResearcherId } from "../study/types.ts";
import type { CoreDeps, TextRequest } from "./core.ts";
import { emptyError, httpError, transportFailure } from "./errors.ts";
import { commonsImages, type JsonFetcher } from "./images.ts";
import { FAST_MODEL, SEARCH_MODEL } from "./models.ts";

/**
 * Transporte da IA quando existe servidor (web/Vercel): fala com a xAI e com
 * os outros pesquisadores por `fetch`, usando a chave do usuário ou a chave de
 * ambiente. No APK, `xai-client.ts` usa CapacitorHttp e este módulo não roda.
 */

const LABELS: Record<ResearcherId, string> = {
  grok: "xAI",
  perplexity: "Perplexity",
  gemini: "Gemini",
  claude: "Claude",
};

function authHeader(key: string): Record<string, string> {
  return { "Content-Type": "application/json", Authorization: `Bearer ${key}` };
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    throw transportFailure(error, { online: true });
  }
}

async function failure(response: Response, provider: ResearcherId) {
  const body = await response.text().catch(() => "");
  return httpError(response.status, body, {
    retryAfter: response.headers.get("retry-after"),
    providerLabel: LABELS[provider],
  });
}

async function xaiChat(
  key: string,
  prompt: string,
  maxTokens: number,
  timeoutMs: number,
): Promise<string> {
  const response = await fetchWithTimeout(
    "https://api.x.ai/v1/chat/completions",
    {
      method: "POST",
      headers: authHeader(key),
      body: JSON.stringify({
        model: FAST_MODEL,
        temperature: 0.3,
        max_tokens: maxTokens,
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: prompt }],
      }),
    },
    timeoutMs,
  );
  if (!response.ok) throw await failure(response, "grok");
  const body = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  const text = body.choices?.[0]?.message?.content ?? "";
  if (!text.trim()) throw emptyError();
  return text;
}

async function xaiSearch(key: string, prompt: string): Promise<string> {
  const response = await fetchWithTimeout(
    "https://api.x.ai/v1/responses",
    {
      method: "POST",
      headers: authHeader(key),
      body: JSON.stringify({
        model: SEARCH_MODEL,
        reasoning: { effort: "low" },
        max_output_tokens: 3500,
        tools: [{ type: "web_search" }],
        text: { format: { type: "json_object" } },
        input: [{ role: "user", content: prompt }],
      }),
    },
    90000,
  );
  if (!response.ok) throw await failure(response, "grok");
  const body = (await response.json()) as {
    output?: { content?: { type?: string; text?: string }[] }[];
  };
  let text = "";
  for (const item of body.output ?? []) {
    for (const part of item.content ?? []) {
      if (part.type === "output_text" && part.text) text += part.text;
    }
  }
  if (!text.trim()) throw emptyError("A pesquisa não devolveu texto.");
  return text;
}

async function providerChat(
  provider: ResearcherId,
  key: string,
  prompt: string,
  maxTokens: number,
  timeoutMs: number,
): Promise<string> {
  if (provider === "perplexity") {
    const response = await fetchWithTimeout(
      "https://api.perplexity.ai/chat/completions",
      {
        method: "POST",
        headers: authHeader(key),
        body: JSON.stringify({
          model: "sonar",
          temperature: 0.3,
          max_tokens: maxTokens,
          messages: [{ role: "user", content: prompt }],
        }),
      },
      timeoutMs,
    );
    if (!response.ok) throw await failure(response, provider);
    const body = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const text = body.choices?.[0]?.message?.content ?? "";
    if (!text.trim()) throw emptyError();
    return text;
  }

  if (provider === "gemini") {
    const response = await fetchWithTimeout(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: maxTokens,
            responseMimeType: "application/json",
          },
        }),
      },
      timeoutMs,
    );
    if (!response.ok) throw await failure(response, provider);
    const body = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text =
      body.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
    if (!text.trim()) throw emptyError();
    return text;
  }

  const response = await fetchWithTimeout(
    "https://api.anthropic.com/v1/messages",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: maxTokens,
        messages: [{ role: "user", content: prompt }],
      }),
    },
    timeoutMs,
  );
  if (!response.ok) throw await failure(response, provider);
  const body = (await response.json()) as { content?: { text?: string }[] };
  const text = body.content?.map((part) => part.text ?? "").join("") ?? "";
  if (!text.trim()) throw emptyError();
  return text;
}

const fetchJson: JsonFetcher = async (url, timeoutMs) => {
  const response = await fetchWithTimeout(url, {}, timeoutMs);
  if (!response.ok) throw httpError(response.status, "", { providerLabel: "Wikimedia" });
  return response.json();
};

async function serverText(request: TextRequest): Promise<{ text: string; webSearch: boolean }> {
  if (request.webSearch) {
    try {
      return { text: await xaiSearch(request.key, request.prompt), webSearch: true };
    } catch {
      // Mesmo comportamento de antes: se a pesquisa falhar, tenta o chat normal.
    }
  }
  if (request.provider === "grok") {
    return {
      text: await xaiChat(request.key, request.prompt, request.maxTokens, 75000),
      webSearch: false,
    };
  }
  return {
    text: await providerChat(
      request.provider,
      request.key,
      request.prompt,
      request.maxTokens,
      70000,
    ),
    webSearch: false,
  };
}

export const serverDeps: CoreDeps = {
  resolveKey(provider, userKey) {
    const personal = userKey.trim();
    if (provider === "grok") return personal || process.env.XAI_API_KEY?.trim() || null;
    return personal || null;
  },
  noKeyMessage(provider) {
    if (provider === "grok") return "Sem chave da xAI. Cole a sua chave em Ajustes.";
    return `Sem chave do ${LABELS[provider]}. Coloque a chave em Ajustes.`;
  },
  text: serverText,
  images: (queries) => commonsImages(queries, fetchJson),
  isOnline: () => true,
};
