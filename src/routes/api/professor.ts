import { createFileRoute } from "@tanstack/react-router";

/** Chat oficial: POST https://api.x.ai/v1/chat/completions. Sem raciocínio, para a resposta chegar em stream. */
const MODEL = "grok-4.20-0309-non-reasoning";

function clip(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : clean.slice(0, max);
}

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
          return Response.json({ error: "Sem chave da xAI neste aparelho. O resto da sessão continua." }, { status: 503 });
        }
        const topic = clip(typeof body.topic === "string" ? body.topic : "", 200);
        const subtopic = clip(typeof body.subtopic === "string" ? body.subtopic : "", 120);
        const brief = clip(typeof body.brief === "string" ? body.brief : "", 6000);
        const question = clip(typeof body.question === "string" ? body.question : "", 600);
        const hold = Boolean(body.holdAnswer);
        const mistakes = Array.isArray(body.mistakes) ? body.mistakes.map((item) => clip(String(item), 180)).slice(0, 5) : [];
        const history = Array.isArray(body.messages)
          ? body.messages
              .map((item) => {
                const row = item as { role?: string; content?: string };
                const role = row.role === "assistant" ? "assistant" : "user";
                const content = clip(typeof row.content === "string" ? row.content : "", 800);
                return content ? { role, content } : null;
              })
              .filter((item): item is { role: "assistant" | "user"; content: string } => Boolean(item))
              .slice(-8)
          : [];
        if (!history.length) return Response.json({ error: "Escreva a dúvida primeiro." }, { status: 400 });

        const system = [
          "Você é o professor de um app de vestibular, em português do Brasil. Didático e curto. Se a pessoa estiver perdida, comece pelo básico e explique o termo.",
          "Responda primeiro com o PACOTE. Cite a seção no formato «Conceitos › Nome», «Essência › Nome» ou «Pegadinhas › Nome».",
          "Se a dúvida não puder ser respondida com o pacote, a primeira linha deve ser só FORA. Se puder, a primeira linha deve ser só DENTRO.",
          "Não busque na web. Não invente data. Se não tiver certeza, diga que não tem certeza.",
          hold
            ? "HÁ UMA QUESTÃO EM ANDAMENTO. Proibido dizer a alternativa correta, eliminar todas as erradas ou entregar o gabarito. Dê uma pista e uma pergunta guiada."
            : "Não há questão aberta: pode explicar até o fim, em até 120 palavras, com parágrafos curtos.",
          `Bloco: ${topic}`,
          `Subtópico: ${subtopic || "não informado"}`,
          question ? `Questão na tela, sem revelar o gabarito: ${question}` : "Não há questão aberta.",
          mistakes.length ? `Erros recentes, só como tema, sem entregar resposta de questão aberta: ${mistakes.join(" | ")}` : "",
          `PACOTE:\n${brief || "vazio"}`,
        ]
          .filter(Boolean)
          .join("\n");

        let upstream: Response;
        try {
          upstream = await fetch("https://api.x.ai/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
            body: JSON.stringify({
              model: MODEL,
              stream: true,
              temperature: 0.3,
              max_tokens: 700,
              messages: [{ role: "system", content: system }, ...history],
            }),
            signal: AbortSignal.timeout(55000),
          });
        } catch {
          return Response.json({ error: "Sem internet ou a IA não respondeu. A sessão continua." }, { status: 503 });
        }
        if (!upstream.ok || !upstream.body) {
          const message =
            upstream.status === 429
              ? "Limite de uso da IA agora. Espere um pouco. A sessão continua."
              : upstream.status === 401 || upstream.status === 403
                ? "A chave da xAI foi recusada. A sessão continua."
                : "A IA falhou agora. A sessão continua.";
          return Response.json({ error: message }, { status: upstream.status || 502 });
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
                    const json = JSON.parse(payload) as { choices?: { delta?: { content?: string } }[] };
                    const t = json.choices?.[0]?.delta?.content ?? "";
                    if (t) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ t })}\n\n`));
                  } catch {
                    continue;
                  }
                }
              }
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            } catch {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "A resposta foi interrompida." })}\n\n`));
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
