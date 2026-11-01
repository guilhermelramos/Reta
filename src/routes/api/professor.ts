import { createFileRoute } from "@tanstack/react-router";
import { httpError } from "@/lib/ai/errors";
import { FAST_MODEL } from "@/lib/ai/models";
import { buildProfessorSystemPrompt, normalizeProfessorHistory } from "@/lib/ai/prompts";

/**
 * Chat oficial (web): POST https://api.x.ai/v1/chat/completions em stream.
 * No APK não existe esta rota; `src/lib/ai/professor-client.ts` chama a xAI
 * direto pelo CapacitorHttp, sem stream, com o mesmo prompt e o mesmo modelo.
 */
export const Route = createFileRoute("/api/professor")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: Record<string, unknown> = {};
        try {
          body = (await request.json()) as Record<string, unknown>;
        } catch {
          return Response.json({ error: "Pedido inválido." }, { status: 400 });
        }
        const userKey = typeof body.userKey === "string" ? body.userKey.trim() : "";
        const key = (userKey || process.env.XAI_API_KEY?.trim() || "").slice(0, 400);
        if (!key) {
          return Response.json(
            { error: "Sem chave da xAI neste aparelho. O resto da sessão continua." },
            { status: 503 },
          );
        }
        const history = normalizeProfessorHistory(body.messages);
        if (!history.length)
          return Response.json({ error: "Escreva a dúvida primeiro." }, { status: 400 });
        const system = buildProfessorSystemPrompt(body);

        let upstream: Response;
        try {
          upstream = await fetch("https://api.x.ai/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
            body: JSON.stringify({
              model: FAST_MODEL,
              stream: true,
              temperature: 0.3,
              max_tokens: 700,
              messages: [{ role: "system", content: system }, ...history],
            }),
            signal: AbortSignal.timeout(55000),
          });
        } catch {
          return Response.json(
            { error: "Sem internet ou a IA não respondeu. A sessão continua." },
            { status: 503 },
          );
        }
        if (!upstream.ok || !upstream.body) {
          const mapped = httpError(upstream.status, await upstream.text().catch(() => ""), {
            retryAfter: upstream.headers.get("retry-after"),
            providerLabel: "xAI",
          });
          return Response.json({ error: mapped.message }, { status: upstream.status || 502 });
        }

        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          async start(controller) {
            const reader = upstream.body!.getReader();
            const decoder = new TextDecoder();
            let buf = "";
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buf += decoder.decode(value, { stream: true });
                const lines = buf.split("\n");
                buf = lines.pop() ?? "";
                for (const line of lines) {
                  const trimmed = line.trim();
                  if (!trimmed.startsWith("data:")) continue;
                  const payload = trimmed.slice(5).trim();
                  if (!payload || payload === "[DONE]") continue;
                  try {
                    const json = JSON.parse(payload) as {
                      choices?: { delta?: { content?: string } }[];
                    };
                    const text = json.choices?.[0]?.delta?.content ?? "";
                    if (text)
                      controller.enqueue(
                        encoder.encode(`data: ${JSON.stringify({ t: text })}\n\n`),
                      );
                  } catch {
                    continue;
                  }
                }
              }
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            } catch {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ error: "A resposta foi interrompida." })}\n\n`,
                ),
              );
            } finally {
              controller.close();
            }
          },
        });
        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
          },
        });
      },
    },
  },
});
