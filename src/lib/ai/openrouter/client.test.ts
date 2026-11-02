import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  OPENROUTER_API_BASE,
  OPENROUTER_APP_REFERER,
  OPENROUTER_APP_TITLE,
  buildChatBody,
  chatCompletion,
  completionText,
  imagePart,
  isFreeModel,
  listModels,
  normalizeModel,
  type HttpRequest,
  type HttpResponse,
  type HttpTransport,
  type OpenRouterMessage,
  type OpenRouterModel,
} from "./client.ts";
import { AiRequestError } from "../errors.ts";

function recorder(reply: HttpResponse | ((request: HttpRequest) => HttpResponse)) {
  const calls: HttpRequest[] = [];
  const transport: HttpTransport = async (request) => {
    calls.push(request);
    return typeof reply === "function" ? reply(request) : reply;
  };
  return { calls, transport };
}

const ok = (data: unknown, headers: Record<string, string> = {}): HttpResponse => ({
  status: 200,
  data,
  headers,
});

const catalog = (rows: unknown[]): OpenRouterModel[] =>
  rows
    .map((row) => normalizeModel(row))
    .filter((model): model is OpenRouterModel => model !== null);

const TEXT_MODEL_ROW = {
  id: "meta-llama/llama-3.3-70b-instruct:free",
  name: "Llama 3.3 70B",
  pricing: { prompt: "0", completion: "0" },
  context_length: 65536,
  architecture: { input_modalities: ["text"], output_modalities: ["text"] },
};

const VISION_MODEL_ROW = {
  id: "google/gemini-2.5-flash",
  name: "Gemini 2.5 Flash",
  pricing: { prompt: "0.0000003", completion: "0.0000025" },
  context_length: 1048576,
  architecture: {
    input_modalities: ["text", "image"],
    output_modalities: ["text"],
  },
};

const messages: OpenRouterMessage[] = [{ role: "user", content: "Explique mitose." }];

describe("normalizeModel", () => {
  it("converte preço por token para 1M e detecta grátis/visão", () => {
    const free = normalizeModel(TEXT_MODEL_ROW);
    assert.ok(free);
    assert.equal(free.id, "meta-llama/llama-3.3-70b-instruct:free");
    assert.equal(free.free, true);
    assert.equal(free.supportsImages, false);
    assert.equal(free.contextLength, 65536);
    assert.deepEqual(free.pricing, { promptPerMillion: 0, completionPerMillion: 0 });
    assert.deepEqual(free.inputModalities, ["text"]);

    const vision = normalizeModel(VISION_MODEL_ROW);
    assert.ok(vision);
    assert.equal(vision.free, false);
    assert.equal(vision.supportsImages, true);
    assert.deepEqual(vision.pricing, { promptPerMillion: 0.3, completionPerMillion: 2.5 });
    assert.equal(vision.contextLength, 1048576);
  });

  it("considera grátis o preço zerado mesmo sem o sufixo :free", () => {
    const model = normalizeModel({
      id: "exemplo/gratis",
      pricing: { prompt: "0", completion: "0" },
    });
    assert.ok(model);
    assert.equal(model.free, true);
  });

  it("não marca como grátis quando o preço não vem no catálogo", () => {
    const model = normalizeModel({ id: "exemplo/sem-preco", name: "" });
    assert.ok(model);
    assert.equal(model.free, false);
    assert.deepEqual(model.pricing, { promptPerMillion: null, completionPerMillion: null });
    assert.equal(model.name, "exemplo/sem-preco");
    assert.equal(model.supportsImages, false);
  });

  it("descarta linha sem id", () => {
    assert.equal(normalizeModel({ name: "sem id" }), null);
    assert.equal(normalizeModel("texto"), null);
  });

  it("isFreeModel também aceita o sufixo :free", () => {
    assert.equal(isFreeModel("x/y:free", 1, 1), true);
    assert.equal(isFreeModel("x/y", 0, 0.000001), false);
  });
});

describe("buildChatBody", () => {
  it("manda model quando não há fallback", () => {
    const body = callBody({ model: "openrouter/auto" });
    assert.equal(body.model, "openrouter/auto");
    assert.equal("models" in body, false);
    assert.equal(body.stream, false);
  });

  it("com fallback manda models e omite model", () => {
    const body = callBody({
      model: "principal/modelo",
      fallbacks: ["fallback/um", "fallback/dois", "principal/modelo", " "],
    });
    assert.deepEqual(body.models, ["principal/modelo", "fallback/um", "fallback/dois"]);
    assert.equal("model" in body, false);
  });

  it("preserva partes de imagem e os limites numéricos", () => {
    const body = callBody({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: "Você é um professor." },
        {
          role: "user",
          content: [
            { type: "text", text: "Resolva a questão." },
            imagePart("data:image/jpeg;base64,AAAA"),
          ],
        },
      ],
      maxTokens: 999.6,
      temperature: 0.2,
      json: true,
    });
    assert.equal(body.max_tokens, 1000);
    assert.equal(body.temperature, 0.2);
    assert.deepEqual(body.response_format, { type: "json_object" });
    const sent = body.messages as OpenRouterMessage[];
    assert.deepEqual(sent[1]?.content, [
      { type: "text", text: "Resolva a questão." },
      { type: "image_url", image_url: { url: "data:image/jpeg;base64,AAAA" } },
    ]);
  });

  it("não envia response_format por padrão", () => {
    assert.equal("response_format" in callBody({ model: "x/y" }), false);
  });
});

function callBody(overrides: Partial<Parameters<typeof chatCompletion>[0]> = {}) {
  return buildChatBody({
    key: "sk-or-v1-teste",
    model: "x/y",
    messages,
    ...overrides,
  });
}

describe("chatCompletion", () => {
  it("envia cabeçalhos de atribuição e devolve o texto", async () => {
    const { calls, transport } = recorder(
      ok({
        model: "fallback/dois",
        usage: { total_tokens: 12 },
        choices: [{ message: { content: "  A resposta.  " } }],
      }),
    );
    const result = await chatCompletion(
      { key: " sk-or-v1-teste ", model: "principal/modelo", messages },
      transport,
    );

    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.method, "POST");
    assert.equal(calls[0]?.url, `${OPENROUTER_API_BASE}/chat/completions`);
    assert.equal(calls[0]?.headers.Authorization, "Bearer sk-or-v1-teste");
    assert.equal(calls[0]?.headers["Content-Type"], "application/json");
    assert.equal(calls[0]?.headers["HTTP-Referer"], OPENROUTER_APP_REFERER);
    assert.equal(calls[0]?.headers["X-Title"], OPENROUTER_APP_TITLE);
    assert.deepEqual(result, {
      text: "  A resposta.  ",
      model: "fallback/dois",
      usage: { total_tokens: 12 },
    });
  });

  it("junta conteúdo em partes de texto", () => {
    assert.equal(
      completionText({
        choices: [{ message: { content: [{ type: "text", text: "a" }, { text: "b" }] } }],
      }),
      "ab",
    );
    assert.equal(completionText(null), "");
  });

  it("recusa chave vazia antes da rede", async () => {
    const { calls, transport } = recorder(ok({}));
    await assert.rejects(
      () => chatCompletion({ key: "   ", model: "x/y", messages }, transport),
      (error: unknown) => error instanceof AiRequestError && error.kind === "missing-key",
    );
    assert.equal(calls.length, 0);
  });

  it("recusa resposta vazia com erro 'empty'", async () => {
    const { transport } = recorder(ok({ choices: [{ message: { content: "   " } }] }));
    await assert.rejects(
      () => chatCompletion({ key: "k", model: "x/y", messages }, transport),
      (error: unknown) => error instanceof AiRequestError && error.kind === "empty",
    );
  });

  it("bloqueia imagem em modelo sem visão ANTES de enviar", async () => {
    const { calls, transport } = recorder(ok({}));
    const withImage: OpenRouterMessage[] = [
      { role: "user", content: [imagePart("data:image/png;base64,AAAA")] },
    ];
    await assert.rejects(
      () =>
        chatCompletion(
          {
            key: "k",
            model: "meta-llama/llama-3.3-70b-instruct:free",
            messages: withImage,
            catalog: catalog([TEXT_MODEL_ROW]),
          },
          transport,
        ),
      (error: unknown) =>
        error instanceof AiRequestError &&
        error.kind === "vision" &&
        /não lê imagens/.test(error.message),
    );
    assert.equal(calls.length, 0);
  });

  it("deixa passar imagem quando o catálogo diz que o modelo tem visão", async () => {
    const { calls, transport } = recorder(ok({ choices: [{ message: { content: "ok" } }] }));
    await chatCompletion(
      {
        key: "k",
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: [imagePart("data:image/png;base64,AAAA")] }],
        catalog: catalog([VISION_MODEL_ROW]),
      },
      transport,
    );
    assert.equal(calls.length, 1);
  });

  it("não bloqueia quando o modelo não está no catálogo", async () => {
    const { calls, transport } = recorder(ok({ choices: [{ message: { content: "ok" } }] }));
    await chatCompletion(
      {
        key: "k",
        model: "desconhecido/modelo",
        messages: [{ role: "user", content: [imagePart("data:image/png;base64,AAAA")] }],
        catalog: catalog([TEXT_MODEL_ROW]),
      },
      transport,
    );
    assert.equal(calls.length, 1);
  });

  it("mapeia cada status de erro documentado", async () => {
    const cases: {
      status: number;
      headers?: Record<string, string>;
      kind: string;
      message: RegExp;
    }[] = [
      { status: 401, kind: "unauthorized", message: /chave do OpenRouter foi recusada/i },
      { status: 402, kind: "no-credits", message: /Sem créditos/i },
      { status: 403, kind: "unauthorized", message: /bloqueada ou atingiu o limite/i },
      { status: 429, headers: { "retry-after": "12" }, kind: "rate-limit", message: /12 s/ },
      { status: 408, kind: "timeout", message: /demorou demais/i },
      { status: 502, kind: "server", message: /indisponível/i },
      { status: 503, kind: "server", message: /503/ },
      { status: 400, kind: "bad-request", message: /recusou o pedido/i },
    ];

    for (const item of cases) {
      const { transport } = recorder({
        status: item.status,
        data: { error: { code: item.status, message: "corpo do erro" } },
        headers: item.headers ?? {},
      });
      await assert.rejects(
        () => chatCompletion({ key: "k", model: "x/y", messages }, transport),
        (error: unknown) => {
          assert.ok(error instanceof AiRequestError);
          assert.equal(error.kind, item.kind);
          assert.match(error.message, item.message);
          if (item.status === 429) assert.equal(error.retryAfterSeconds, 12);
          return true;
        },
      );
    }
  });
});

describe("listModels", () => {
  it("lê o catálogo e normaliza as linhas", async () => {
    const { calls, transport } = recorder(
      ok({ data: [TEXT_MODEL_ROW, VISION_MODEL_ROW, { name: "sem id" }, null] }),
    );
    const models = await listModels(transport);

    assert.equal(calls[0]?.method, "GET");
    assert.equal(calls[0]?.url, `${OPENROUTER_API_BASE}/models`);
    assert.equal(calls[0]?.headers["X-Title"], OPENROUTER_APP_TITLE);
    assert.deepEqual(
      models.map((model) => model.id),
      ["meta-llama/llama-3.3-70b-instruct:free", "google/gemini-2.5-flash"],
    );
  });

  it("lista vazia ou inválida vira erro 'empty'", async () => {
    for (const data of [{ data: [] }, {}, { data: "x" }]) {
      const { transport } = recorder(ok(data));
      await assert.rejects(
        () => listModels(transport),
        (error: unknown) => error instanceof AiRequestError && error.kind === "empty",
      );
    }
  });

  it("erro HTTP do catálogo é traduzido", async () => {
    const { transport } = recorder({ status: 503, data: {}, headers: {} });
    await assert.rejects(
      () => listModels(transport),
      (error: unknown) => error instanceof AiRequestError && error.kind === "server",
    );
  });
});
