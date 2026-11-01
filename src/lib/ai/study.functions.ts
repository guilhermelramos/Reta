import { createServerFn } from "@tanstack/react-start";
import { isModernaBlock } from "@/lib/study/coverage";
import { validateDiagram } from "@/lib/study/diagrams";
import { buildHumanasPackage } from "@/lib/study/humanas-pack";
import type { Difficulty, ImageCredit, QuizItem, ResearcherId, SourceNote, StudyPackage } from "@/lib/study/types";
import { sanitizeSvg } from "@/lib/study/svg";

/**
 * Grok 4.5 / 4.7 gastam milhares de tokens de raciocínio numa questão curta
 * (15–45s). A sessão usa o Grok sem raciocínio, no mesmo endpoint oficial.
 * Pesquisa web, se ligada, vai em /v1/responses com grok-4.5 — uma chamada só.
 */
const FAST_MODEL = "grok-4.20-0309-non-reasoning";
const SEARCH_MODEL = "grok-4.5";

export type PackageBody = {
  essence: string[];
  development: string;
  concepts: { term: string; symbol: string; meaning: string }[];
  formulas: { expr: string; meaning: string }[];
  pitfalls: string[];
  sources: { title: string; url: string; note: string }[];
  images: ImageCredit[];
  diagramSvg: string;
  diagnostic: QuizItem;
  questions: QuizItem[];
  flashcards: { front: string; back: string }[];
  provider: string;
  webSearch: boolean;
  schemaVersion?: number;
  displayTitle?: string;
  codes?: string[];
  subtopics?: StudyPackage["subtopics"];
};

type Ok<T> = { ok: true; data: T };
type Err = { ok: false; error: string };

const SCHEMA = `Responda só com um JSON válido (sem markdown) neste formato:
{"essence":["","",""],"development":"","concepts":[{"term":"","symbol":"","meaning":""}],"formulas":[{"expr":"","meaning":""}],"pitfalls":[""],"sources":[{"title":"","url":"","note":""}],"imageQueries":["english commons query"],"diagramSvg":"","diagnostic":{"difficulty":"facil","prompt":"","choices":["","","",""],"correctIndex":0,"hint":"","explanation":"","altExplanation":"","diagramSvg":""},"questions":[{"difficulty":"facil","prompt":"","choices":["","","",""],"correctIndex":0,"hint":"","explanation":"","altExplanation":"","diagramSvg":""}],"flashcards":[{"front":"","back":""}]}
Regras: português do Brasil, nível vestibular. essence com 3 frases curtas. development com no máximo 700 caracteres. 4 a 6 concepts. formulas só se o tema tiver conta, senão []. 3 pitfalls reais. sources: não invente URL; use "" se não tiver certeza. imageQueries: 2 termos curtos em inglês para foto ou diagrama de licença aberta. diagramSvg: SVG simples com viewBox, só as tags svg g path rect circle line text polyline, sem script, até 1000 caracteres, ou "". diagnostic fácil, para ver o que a pessoa já sabe. questions: exatamente 4, dificuldades facil, medio, medio, dificil, quatro alternativas, uma correta, distratores que são erros comuns. hint não entrega a resposta. altExplanation explica por outro caminho. flashcards: 4, frente curta.`;

function clip(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : clean.slice(0, max);
}

function cleanError(status: number, body: string): string {
  const sliced = body.replace(/[A-Za-z0-9_-]{20,}/g, "•••").slice(0, 160);
  if (status === 401 || status === 403) return "Chave recusada. Confira em Ajustes.";
  if (status === 429) return "Limite de uso da IA agora. Espere um pouco e tente de novo.";
  if (status >= 500) return "A IA está indisponível. Tente de novo em instantes.";
  return sliced ? `Falha ${status}: ${sliced}` : `Falha ${status} ao falar com a IA.`;
}

function resolveXai(userKey: string): string | null {
  const personal = userKey.trim();
  if (personal) return personal;
  return process.env.XAI_API_KEY?.trim() || null;
}

function extractJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
    throw new Error("A resposta não veio em JSON.");
  }
}

function asString(value: unknown, max: number): string {
  return typeof value === "string" ? clip(value, max) : "";
}

function asQuiz(raw: unknown, fallback: Difficulty, id: string): QuizItem | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const choices = Array.isArray(row.choices) ? row.choices.map((c) => asString(c, 180)).filter(Boolean) : [];
  if (choices.length !== 4) return null;
  const correctIndex = Number(row.correctIndex);
  if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > 3) return null;
  const prompt = asString(row.prompt, 500);
  if (!prompt) return null;
  const difficulty = row.difficulty === "facil" || row.difficulty === "medio" || row.difficulty === "dificil" ? row.difficulty : fallback;
  return {
    id,
    difficulty,
    prompt,
    choices,
    correctIndex,
    hint: asString(row.hint, 300),
    explanation: asString(row.explanation, 700),
    altExplanation: asString(row.altExplanation, 700),
    diagramSvg: sanitizeSvg(asString(row.diagramSvg, 4000)),
  };
}

function coercePackage(raw: unknown, provider: string, webSearch: boolean): PackageBody | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const essence = Array.isArray(row.essence) ? row.essence.map((l) => asString(l, 180)).filter(Boolean).slice(0, 3) : [];
  while (essence.length < 3) essence.push("");
  const concepts = Array.isArray(row.concepts)
    ? row.concepts
        .map((c) => {
          const item = c as Record<string, unknown>;
          return { term: asString(item?.term, 80), symbol: asString(item?.symbol, 40), meaning: asString(item?.meaning, 240) };
        })
        .filter((c) => c.term && c.meaning)
        .slice(0, 6)
    : [];
  const diagnostic = asQuiz(row.diagnostic, "facil", "diag");
  const questions = (Array.isArray(row.questions) ? row.questions : [])
    .map((q, i) => asQuiz(q, i === 0 ? "facil" : i === 3 ? "dificil" : "medio", `q${i + 1}`))
    .filter((q): q is QuizItem => Boolean(q))
    .slice(0, 4);
  if (!diagnostic || questions.length < 2 || concepts.length < 2 || !essence[0]) return null;
  const formulas = Array.isArray(row.formulas)
    ? row.formulas
        .map((f) => {
          const item = f as Record<string, unknown>;
          return { expr: asString(item?.expr, 120), meaning: asString(item?.meaning, 240) };
        })
        .filter((f) => f.expr)
        .slice(0, 6)
    : [];
  const sources = Array.isArray(row.sources)
    ? row.sources
        .map((s) => {
          const item = s as Record<string, unknown>;
          const url = asString(item?.url, 300);
          return {
            title: asString(item?.title, 140),
            url: /^https?:\/\//i.test(url) ? url : "",
            note: asString(item?.note, 200),
          };
        })
        .filter((s) => s.title)
        .slice(0, 5)
    : [];
  const flashcards = Array.isArray(row.flashcards)
    ? row.flashcards
        .map((c) => {
          const item = c as Record<string, unknown>;
          return { front: asString(item?.front, 140), back: asString(item?.back, 240) };
        })
        .filter((c) => c.front && c.back)
        .slice(0, 6)
    : [];
  return {
    essence: essence.filter(Boolean),
    development: asString(row.development, 900),
    concepts,
    formulas,
    pitfalls: (Array.isArray(row.pitfalls) ? row.pitfalls : []).map((p) => asString(p, 200)).filter(Boolean).slice(0, 4),
    sources,
    images: [],
    diagramSvg: checkedSvg(asString(row.diagramSvg, 8000)),
    diagnostic,
    questions,
    flashcards,
    provider,
    webSearch,
  };
}

function imageQueries(raw: unknown): string[] {
  if (!raw || typeof raw !== "object") return [];
  const list = (raw as Record<string, unknown>).imageQueries;
  if (!Array.isArray(list)) return [];
  return list.map((q) => asString(q, 80)).filter(Boolean).slice(0, 2);
}

async function chat(key: string, prompt: string, maxTokens: number): Promise<string> {
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: FAST_MODEL,
      temperature: 0.3,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
    }),
    signal: AbortSignal.timeout(70000),
  });
  if (!res.ok) throw new Error(cleanError(res.status, await res.text().catch(() => "")));
  const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = body.choices?.[0]?.message?.content ?? "";
  if (!text) throw new Error("A IA voltou vazia.");
  return text;
}

async function searchChat(key: string, prompt: string): Promise<string> {
  const res = await fetch("https://api.x.ai/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: SEARCH_MODEL,
      reasoning: { effort: "low" },
      max_output_tokens: 3500,
      tools: [{ type: "web_search" }],
      text: { format: { type: "json_object" } },
      input: [{ role: "user", content: prompt }],
    }),
    signal: AbortSignal.timeout(90000),
  });
  if (!res.ok) throw new Error(cleanError(res.status, await res.text().catch(() => "")));
  const body = (await res.json()) as {
    output?: { content?: { type?: string; text?: string }[] }[];
  };
  let text = "";
  for (const item of body.output ?? []) {
    for (const part of item.content ?? []) {
      if (part.type === "output_text" && part.text) text += part.text;
    }
  }
  if (!text) throw new Error("A pesquisa não devolveu texto.");
  return text;
}

async function providerChat(provider: ResearcherId, key: string, prompt: string): Promise<string> {
  if (provider === "grok") return chat(key, prompt, 3200);
  if (provider === "perplexity") {
    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "sonar",
        temperature: 0.3,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(70000),
    });
    if (!res.ok) throw new Error(cleanError(res.status, await res.text().catch(() => "")));
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return body.choices?.[0]?.message?.content ?? "";
  }
  if (provider === "gemini") {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 3200, responseMimeType: "application/json" },
        }),
        signal: AbortSignal.timeout(70000),
      },
    );
    if (!res.ok) throw new Error(cleanError(res.status, await res.text().catch(() => "")));
    const body = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    return body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  }
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: 3200,
      messages: [{ role: "user", content: prompt }],
    }),
    signal: AbortSignal.timeout(70000),
  });
  if (!res.ok) throw new Error(cleanError(res.status, await res.text().catch(() => "")));
  const body = (await res.json()) as { content?: { text?: string }[] };
  return body.content?.map((p) => p.text ?? "").join("") ?? "";
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function openLicense(license: string): boolean {
  const text = license.toLowerCase();
  if (!text) return false;
  if (/non-?commercial|\bnc\b|no derivatives|\bnd\b/.test(text)) return false;
  return /public domain|cc0|cc by|creative commons|attribution/.test(text);
}

async function commonsImages(queries: string[]): Promise<ImageCredit[]> {
  const images: ImageCredit[] = [];
  for (const query of queries) {
    if (images.length >= 2) break;
    const url = new URL("https://commons.wikimedia.org/w/api.php");
    url.searchParams.set("action", "query");
    url.searchParams.set("format", "json");
    url.searchParams.set("generator", "search");
    url.searchParams.set("gsrsearch", query);
    url.searchParams.set("gsrnamespace", "6");
    url.searchParams.set("gsrlimit", "5");
    url.searchParams.set("prop", "imageinfo");
    url.searchParams.set("iiprop", "url|mime|extmetadata");
    url.searchParams.set("iiurlwidth", "800");
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) continue;
      const data = (await res.json()) as {
        query?: { pages?: Record<string, { imageinfo?: { thumburl?: string; url?: string; mime?: string; descriptionurl?: string; extmetadata?: Record<string, { value?: string }> }[] }> };
      };
      for (const page of Object.values(data.query?.pages ?? {})) {
        const info = page.imageinfo?.[0];
        if (!info) continue;
        const mime = info.mime ?? "";
        if (mime && !/^image\/(jpeg|png|gif|webp)$/.test(mime)) continue;
        const meta = info.extmetadata ?? {};
        const license = stripHtml(meta.LicenseShortName?.value ?? "");
        if (!openLicense(license)) continue;
        const src = info.thumburl || info.url || "";
        if (!src.startsWith("https://")) continue;
        images.push({
          src,
          alt: stripHtml(meta.ImageDescription?.value ?? query).slice(0, 180) || query,
          credit: stripHtml(meta.Artist?.value ?? "Wikimedia Commons").slice(0, 160),
          license,
          sourceUrl: info.descriptionurl || "https://commons.wikimedia.org/",
        });
        break;
      }
    } catch {
      continue;
    }
  }
  return images;
}

function keyFor(provider: ResearcherId, userKey: string): string | null {
  if (provider === "grok") return resolveXai(userKey);
  return userKey.trim() || null;
}

function checkedSvg(raw: string): string {
  const clean = sanitizeSvg(raw);
  if (!clean) return "";
  return validateDiagram(clean).ok ? clean : "";
}

export const pingAi = createServerFn({ method: "POST" })
  .validator((input: { provider?: string; userKey?: string }) => {
    const provider = input?.provider;
    const allowed: ResearcherId[] = ["grok", "perplexity", "gemini", "claude"];
    if (!allowed.includes(provider as ResearcherId)) throw new Error("Provedor inválido.");
    const userKey = typeof input?.userKey === "string" ? input.userKey.trim() : "";
    if (userKey.length > 400) throw new Error("Chave inválida.");
    return { provider: provider as ResearcherId, userKey };
  })
  .handler(async ({ data }): Promise<Ok<{ text: string }> | Err> => {
    try {
      const key = keyFor(data.provider, data.userKey);
      if (!key) return { ok: false, error: data.provider === "grok" ? "IA indisponível neste ambiente." : "Falta a chave desse provedor." };
      const text =
        data.provider === "grok"
          ? await chat(key, 'Responda só este JSON: {"ok":true}', 40)
          : await providerChat(data.provider, key, 'Responda só este JSON: {"ok":true}');
      return { ok: true, data: { text: text.slice(0, 80) } };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha no teste.";
      if (/timeout|aborted/i.test(message)) return { ok: false, error: "O teste demorou demais. Sem internet ou a IA não respondeu." };
      return { ok: false, error: message };
    }
  });

export const generatePackage = createServerFn({ method: "POST" })
  .validator((input: { topic?: string; minutes?: number; provider?: string; userKey?: string; webSearch?: boolean; gaps?: string }) => {
    const topic = typeof input?.topic === "string" ? input.topic.trim() : "";
    if (topic.length < 3 || topic.length > 2500) throw new Error("Tema inválido.");
    const provider = input?.provider;
    const allowed: ResearcherId[] = ["grok", "perplexity", "gemini", "claude"];
    if (!allowed.includes(provider as ResearcherId)) throw new Error("Provedor inválido.");
    const userKey = typeof input?.userKey === "string" ? input.userKey.trim() : "";
    if (userKey.length > 400) throw new Error("Chave inválida.");
    const minutes = Number(input?.minutes);
    return {
      topic,
      minutes: Number.isFinite(minutes) ? Math.min(240, Math.max(0, minutes)) : 0,
      provider: provider as ResearcherId,
      userKey,
      webSearch: Boolean(input?.webSearch) && provider === "grok",
      gaps: typeof input?.gaps === "string" ? clip(input.gaps, 700) : "",
    };
  })
  .handler(async ({ data }): Promise<Ok<PackageBody> | Err> => {
    if (isModernaBlock(data.topic)) {
      const full = buildHumanasPackage({ id: "local", date: "", kind: "A", topic: data.topic });
      const { id: _id, date: _date, kind: _kind, topic: _topic, generatedAt: _at, ...body } = full;
      return { ok: true, data: body };
    }
    try {
      const key = keyFor(data.provider, data.userKey);
      if (!key) {
        return {
          ok: false,
          error: data.provider === "grok" ? "IA indisponível neste ambiente." : "Coloque a chave do pesquisador em Ajustes.",
        };
      }
      const fix = data.gaps ? `\nA tentativa anterior foi recusada: ${data.gaps}\nReescreva ensinando de fato. Proibido texto que só descreva o escopo.` : "";
      const prompt = `Monte o pacote de estudo para um bloco de vestibular UTFPR.\nTema: ${data.topic}\nMinutos previstos: ${data.minutes || "não informado"}.\n${SCHEMA}\nEnsine causas, datas, consequências e o erro que cai na prova. Toda afirmação factual precisa caber numa fonte. Se houver controvérsia de periodização, diga.${fix}`;
      let text = "";
      let usedWeb = false;
      if (data.webSearch) {
        const xai = resolveXai(data.userKey);
        if (!xai) return { ok: false, error: "Pesquisa web precisa da chave da xAI." };
        try {
          text = await searchChat(xai, prompt);
          usedWeb = true;
        } catch {
          text = await chat(xai, prompt, 3200);
        }
      } else {
        text = await providerChat(data.provider, key, prompt);
      }
      const parsed = extractJson(text);
      const pack = coercePackage(parsed, usedWeb ? "grok-web" : data.provider, usedWeb);
      if (!pack) return { ok: false, error: "O pacote veio incompleto. Tente gerar de novo só este bloco." };
      pack.images = await commonsImages(imageQueries(parsed));
      if (!pack.sources.length) {
        pack.sources.push({
          title: usedWeb ? "Pesquisa web do Grok" : "Currículo de vestibular, sem página citada",
          url: "",
          note: "URLs só entram quando o modelo informa uma fonte verificável.",
        });
      }
      return { ok: true, data: pack };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao montar o pacote.";
      if (/timeout|aborted/i.test(message)) return { ok: false, error: "Sem resposta a tempo. Veja a internet e tente este bloco de novo." };
      return { ok: false, error: message };
    }
  });

export const researchAdd = createServerFn({ method: "POST" })
  .validator((input: { question?: string; topic?: string; userKey?: string }) => {
    const question = typeof input?.question === "string" ? clip(input.question, 500) : "";
    const topic = typeof input?.topic === "string" ? clip(input.topic, 300) : "";
    if (question.length < 5 || !topic) throw new Error("Dúvida incompleta.");
    const userKey = typeof input?.userKey === "string" ? input.userKey.trim() : "";
    if (userKey.length > 400) throw new Error("Chave inválida.");
    return { question, topic, userKey };
  })
  .handler(async ({ data }): Promise<Ok<{ title: string; paragraphs: string[]; concepts: { term: string; symbol: string; meaning: string }[]; sources: SourceNote[] }> | Err> => {
    try {
      const key = resolveXai(data.userKey);
      if (!key) return { ok: false, error: "Sem chave da xAI. A sessão segue; só o acréscimo fica para depois." };
      const text = await searchChat(
        key,
        `Pesquise e responda em português do Brasil, para vestibular. Tema do bloco: ${data.topic}\nDúvida: ${data.question}\nJSON: {"title":"","paragraphs":["",""],"concepts":[{"term":"","symbol":"","meaning":""}],"sources":[{"title":"","url":"","note":""}]}\nEnsine em parágrafos curtos. Não diga que o bloco aborda o tema. Inclua causa, fato com data quando houver, e consequência. Se for controverso, diga no note da fonte. URL só se você tiver aberto a página; senão "".`,
      );
      const parsed = extractJson(text) as Record<string, unknown>;
      const paragraphs = Array.isArray(parsed.paragraphs) ? parsed.paragraphs.map((p) => asString(p, 500)).filter((p) => p.length > 40).slice(0, 4) : [];
      const concepts = Array.isArray(parsed.concepts)
        ? parsed.concepts
            .map((c) => {
              const item = c as Record<string, unknown>;
              return { term: asString(item?.term, 80), symbol: asString(item?.symbol, 40), meaning: asString(item?.meaning, 320) };
            })
            .filter((c) => c.term && c.meaning.length > 40)
            .slice(0, 4)
        : [];
      const sources = Array.isArray(parsed.sources)
        ? parsed.sources
            .map((s) => {
              const item = s as Record<string, unknown>;
              const url = asString(item?.url, 300);
              return { title: asString(item?.title, 140), url: /^https?:\/\//i.test(url) ? url : "", note: asString(item?.note, 200) };
            })
            .filter((s) => s.title)
            .slice(0, 4)
        : [];
      if (!paragraphs.length) return { ok: false, error: "A pesquisa não trouxe um texto utilizável." };
      return { ok: true, data: { title: asString(parsed.title, 80) || "Fora do pacote", paragraphs, concepts, sources } };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha na pesquisa.";
      if (/timeout|aborted/i.test(message)) return { ok: false, error: "Sem internet ou a pesquisa não respondeu." };
      return { ok: false, error: message };
    }
  });

export const tutorTurn = createServerFn({ method: "POST" })
  .validator(
    (input: {
      topic?: string;
      brief?: string;
      action?: string;
      difficulty?: string;
      avoid?: string[];
      userKey?: string;
      previous?: string;
    }) => {
      const topic = typeof input?.topic === "string" ? clip(input.topic, 400) : "";
      const brief = typeof input?.brief === "string" ? clip(input.brief, 4000) : "";
      if (!topic || !brief) throw new Error("Pacote ausente.");
      const action = input?.action === "reexplain" || input?.action === "diagnostic" ? input.action : "question";
      const difficulty: Difficulty = input?.difficulty === "facil" || input?.difficulty === "dificil" ? input.difficulty : "medio";
      const avoid = Array.isArray(input?.avoid) ? input.avoid.map((p) => asString(p, 180)).slice(0, 8) : [];
      const userKey = typeof input?.userKey === "string" ? input.userKey.trim() : "";
      if (userKey.length > 400) throw new Error("Chave inválida.");
      const previous = typeof input?.previous === "string" ? clip(input.previous, 800) : "";
      return { topic, brief, action, difficulty, avoid, userKey, previous };
    },
  )
  .handler(async ({ data }): Promise<Ok<{ item?: QuizItem; text?: string }> | Err> => {
    try {
      const key = resolveXai(data.userKey);
      if (!key) return { ok: false, error: "IA indisponível neste ambiente." };
      if (data.action === "reexplain") {
        const text = await chat(
          key,
          `Você é o tutor. NÃO busque na web. Use só o pacote.\nTema: ${data.topic}\nPacote: ${data.brief}\nExplique de outro jeito, em até 90 palavras, sem dar lista de alternativas. Texto que já foi dito: ${data.previous || "nenhum"}\nResponda JSON: {"text":""}`,
          400,
        );
        const parsed = extractJson(text) as { text?: unknown };
        const out = asString(parsed?.text, 700);
        if (!out) return { ok: false, error: "Não consegui outra explicação." };
        return { ok: true, data: { text: out } };
      }
      const text = await chat(
        key,
        `Você é o tutor de vestibular. NÃO busque na web e NÃO use fato que não esteja no pacote.\nTema: ${data.topic}\nPacote: ${data.brief}\nCrie UMA questão ${data.action === "diagnostic" ? "bem básica, de diagnóstico" : `de dificuldade ${data.difficulty}`}.\nNão repita: ${data.avoid.join(" | ") || "nada"}.\nJSON: {"prompt":"","choices":["","","",""],"correctIndex":0,"hint":"","explanation":"","altExplanation":"","diagramSvg":""}\nHint não revela a resposta. diagramSvg só se um desenho ajudar, senão "".`,
        900,
      );
      const item = asQuiz(extractJson(text), data.difficulty, `live-${crypto.randomUUID()}`);
      if (!item) return { ok: false, error: "A questão veio incompleta. Tente de novo." };
      return { ok: true, data: { item } };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha na questão.";
      if (/timeout|aborted/i.test(message)) return { ok: false, error: "Sem internet ou a IA não respondeu." };
      return { ok: false, error: message };
    }
  });
