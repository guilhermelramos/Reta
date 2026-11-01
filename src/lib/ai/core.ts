import { isModernaBlock } from "../study/coverage.ts";
import { buildHumanasPackage } from "../study/humanas-pack.ts";
import type { Difficulty, ImageCredit, QuizItem, ResearcherId } from "../study/types.ts";
import { parseBlockPackage, type AiBlockPackage } from "./block-package.ts";
import { mapFailure } from "./errors.ts";
import {
  imageQueries,
  asQuiz,
  coercePackage,
  coerceResearch,
  extractJson,
  tutorText,
  type PackageBody,
  type ResearchAddition,
} from "./parse.ts";
import { BLOCK_MODEL, FAST_MODEL } from "./models.ts";
import {
  buildBlockPackagePrompt,
  buildResearchPrompt,
  buildStudyPackagePrompt,
  buildTutorQuestionPrompt,
  buildTutorReexplainPrompt,
  PING_PROMPT,
} from "./prompts.ts";
import { clip } from "./text.ts";

/**
 * Orquestração compartilhada dos fluxos de IA: prompt → chamada → parse →
 * validação. O transporte é injetado (`CoreDeps`): na web ele fala com a xAI
 * pelo servidor; no APK, pelo `CapacitorHttp`. Assim não existem duas
 * implementações de prompt/parse que possam divergir.
 */

export type AiResult<T> = { ok: true; data: T } | { ok: false; error: string };

export type TextRequest = {
  provider: ResearcherId;
  key: string;
  prompt: string;
  maxTokens: number;
  webSearch: boolean;
};

export type CoreDeps = {
  /** Chave efetiva do provedor (servidor pode cair na chave de ambiente). */
  resolveKey: (provider: ResearcherId, userKey: string) => string | null;
  noKeyMessage: (provider: ResearcherId) => string;
  text: (request: TextRequest) => Promise<{ text: string; webSearch: boolean }>;
  images: (queries: string[]) => Promise<ImageCredit[]>;
  isOnline?: () => boolean;
};

export type GeneratePackageInput = {
  topic: string;
  minutes?: number;
  provider: ResearcherId;
  userKey?: string;
  webSearch?: boolean;
  gaps?: string;
};

export type GenerateBlockInput = { topic: string; minutes?: number; userKey?: string };

export type ResearchInput = { question: string; topic: string; userKey?: string };

export type TutorInput = {
  topic: string;
  brief: string;
  action?: string;
  difficulty?: string;
  avoid?: string[];
  userKey?: string;
  previous?: string;
};

export type PingInput = { provider: ResearcherId; userKey?: string };

const PROVIDERS: ResearcherId[] = ["grok", "perplexity", "gemini", "claude"];

export function isResearcherId(value: unknown): value is ResearcherId {
  return PROVIDERS.includes(value as ResearcherId);
}

function fail(error: unknown, deps: CoreDeps): { ok: false; error: string } {
  return { ok: false, error: mapFailure(error, { online: deps.isOnline?.() }) };
}

function providerKey(
  provider: ResearcherId,
  userKey: string | undefined,
  deps: CoreDeps,
): string | null {
  return deps.resolveKey(provider, (userKey ?? "").trim());
}

/** Pacote de aula completo (4 questões, flashcards) — o fluxo do `store`. */
export async function runGeneratePackage(
  input: GeneratePackageInput,
  deps: CoreDeps,
): Promise<AiResult<PackageBody>> {
  if (!isResearcherId(input.provider)) return { ok: false, error: "Provedor inválido." };
  const topic = (input.topic ?? "").trim();
  if (topic.length < 3 || topic.length > 2500) return { ok: false, error: "Tema inválido." };
  const rawMinutes = Number(input.minutes);
  const minutes = Number.isFinite(rawMinutes) ? Math.min(240, Math.max(0, rawMinutes)) : 0;
  const webSearch = Boolean(input.webSearch) && input.provider === "grok";
  const gaps = typeof input.gaps === "string" ? clip(input.gaps, 700) : "";

  if (isModernaBlock(topic)) {
    const full = buildHumanasPackage({ id: "local", date: "", kind: "A", topic });
    const { id: _id, date: _date, kind: _kind, topic: _topic, generatedAt: _at, ...body } = full;
    return { ok: true, data: body };
  }

  const key = providerKey(input.provider, input.userKey, deps);
  if (!key) return { ok: false, error: deps.noKeyMessage(input.provider) };

  try {
    const { text, webSearch: usedWeb } = await deps.text({
      provider: input.provider,
      key,
      prompt: buildStudyPackagePrompt({ topic, minutes, gaps }),
      maxTokens: 3200,
      webSearch,
    });
    const parsed = extractJson(text);
    const pack = coercePackage(parsed, usedWeb ? "grok-web" : input.provider, usedWeb);
    if (!pack)
      return { ok: false, error: "O pacote veio incompleto. Tente gerar de novo só este bloco." };

    try {
      pack.images = await deps.images(imageQueries(parsed));
    } catch {
      pack.images = [];
    }
    if (!pack.sources.length) {
      pack.sources.push({
        title: usedWeb ? "Pesquisa web do Grok" : "Currículo de vestibular, sem página citada",
        url: "",
        note: "URLs só entram quando o modelo informa uma fonte verificável.",
      });
    }
    return { ok: true, data: pack };
  } catch (error) {
    return fail(error, deps);
  }
}

/** Pacote sob demanda de um bloco (aula + 5 flashcards + 4 questões A–E). */
export async function runGenerateBlockPackage(
  input: GenerateBlockInput,
  deps: CoreDeps,
): Promise<AiResult<AiBlockPackage>> {
  const topic = clip(typeof input.topic === "string" ? input.topic : "", 1200);
  if (topic.length < 3) return { ok: false, error: "Tema inválido." };
  const rawMinutes = Number(input.minutes);
  const minutes = Number.isFinite(rawMinutes) ? Math.min(240, Math.max(5, rawMinutes)) : 30;

  const key = providerKey("grok", input.userKey, deps);
  if (!key) return { ok: false, error: deps.noKeyMessage("grok") };

  let rejection = "estrutura incompleta";
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let text: string;
    try {
      const response = await deps.text({
        provider: "grok",
        key,
        prompt: buildBlockPackagePrompt(topic, minutes, attempt === 0 ? undefined : rejection),
        maxTokens: 4000,
        webSearch: false,
      });
      text = response.text;
    } catch (error) {
      return fail(error, deps);
    }
    const parsed = parseBlockPackage(text);
    if (parsed) {
      return {
        ok: true,
        data: {
          title: parsed.title,
          summary: parsed.summary,
          essence: parsed.essence,
          concepts: parsed.concepts,
          formulas: parsed.formulas,
          pitfalls: parsed.pitfalls,
          flashcards: parsed.flashcards,
          questions: parsed.questions,
          provider: "grok",
          webSearch: false,
          model: BLOCK_MODEL,
        },
      };
    }
    rejection = "o JSON não passou na validação (resumo, 5 flashcards ou 4 questões A–E)";
  }
  return { ok: false, error: "A IA devolveu um pacote incompleto. Tente gerar de novo." };
}

/** Pesquisa do professor: acrescenta um trecho ao pacote, com fontes. */
export async function runResearchAdd(
  input: ResearchInput,
  deps: CoreDeps,
): Promise<AiResult<ResearchAddition>> {
  const question = clip(typeof input.question === "string" ? input.question : "", 500);
  const topic = clip(typeof input.topic === "string" ? input.topic : "", 300);
  if (question.length < 5 || !topic) return { ok: false, error: "Dúvida incompleta." };

  const key = providerKey("grok", input.userKey, deps);
  if (!key) return { ok: false, error: deps.noKeyMessage("grok") };

  try {
    const { text } = await deps.text({
      provider: "grok",
      key,
      prompt: buildResearchPrompt({ topic, question }),
      maxTokens: 3500,
      webSearch: true,
    });
    const research = coerceResearch(extractJson(text));
    if (!research) return { ok: false, error: "A pesquisa não trouxe um texto utilizável." };
    return { ok: true, data: research };
  } catch (error) {
    return fail(error, deps);
  }
}

/** Turno do tutor: nova questão ou outra explicação, sempre só com o pacote. */
export async function runTutorTurn(
  input: TutorInput,
  deps: CoreDeps,
): Promise<AiResult<{ item?: QuizItem; text?: string }>> {
  const topic = clip(typeof input.topic === "string" ? input.topic : "", 400);
  const brief = clip(typeof input.brief === "string" ? input.brief : "", 4000);
  if (!topic || !brief) return { ok: false, error: "Pacote ausente." };
  const action =
    input.action === "reexplain" || input.action === "diagnostic" ? input.action : "question";
  const difficulty: Difficulty =
    input.difficulty === "facil" || input.difficulty === "dificil" ? input.difficulty : "medio";
  const avoid = Array.isArray(input.avoid)
    ? input.avoid.map((item) => clip(String(item), 180)).slice(0, 8)
    : [];
  const previous = clip(typeof input.previous === "string" ? input.previous : "", 800);

  const key = providerKey("grok", input.userKey, deps);
  if (!key) return { ok: false, error: deps.noKeyMessage("grok") };

  try {
    if (action === "reexplain") {
      const { text } = await deps.text({
        provider: "grok",
        key,
        prompt: buildTutorReexplainPrompt({ topic, brief, previous }),
        maxTokens: 400,
        webSearch: false,
      });
      const out = tutorText(extractJson(text));
      if (!out) return { ok: false, error: "Não consegui outra explicação." };
      return { ok: true, data: { text: out } };
    }
    const { text } = await deps.text({
      provider: "grok",
      key,
      prompt: buildTutorQuestionPrompt({
        topic,
        brief,
        action: action === "diagnostic" ? "diagnostic" : "question",
        difficulty,
        avoid,
      }),
      maxTokens: 900,
      webSearch: false,
    });
    const item = asQuiz(extractJson(text), difficulty, `live-${newId()}`);
    if (!item) return { ok: false, error: "A questão veio incompleta. Tente de novo." };
    return { ok: true, data: { item } };
  } catch (error) {
    return fail(error, deps);
  }
}

/** Teste de conexão de Ajustes. Sempre devolve um resultado; nunca fica pendurado. */
export async function runPingAi(
  input: PingInput,
  deps: CoreDeps,
): Promise<AiResult<{ text: string }>> {
  if (!isResearcherId(input.provider)) return { ok: false, error: "Provedor inválido." };
  const key = providerKey(input.provider, input.userKey, deps);
  if (!key) return { ok: false, error: deps.noKeyMessage(input.provider) };
  try {
    const { text } = await deps.text({
      provider: input.provider,
      key,
      prompt: PING_PROMPT,
      maxTokens: 40,
      webSearch: false,
    });
    if (!text.trim()) return { ok: false, error: "A IA voltou vazia. Confira a chave em Ajustes." };
    return { ok: true, data: { text: text.slice(0, 80) } };
  } catch (error) {
    return fail(error, deps);
  }
}

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function")
    return crypto.randomUUID();
  return `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
}
