import { validateDiagram } from "../study/diagrams.ts";
import { sanitizeSvg } from "../study/svg.ts";
import type { Difficulty, ImageCredit, QuizItem, SourceNote, Subtopic } from "../study/types.ts";
import { clip } from "./text.ts";

/**
 * Parse e validação das respostas da IA. Nada aqui depende de servidor ou de
 * `window`: roda na web (server function) e no APK (chamada direta à xAI).
 * A sanitização de SVG é a mesma de `src/lib/study/svg.ts`.
 */

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
  subtopics?: Subtopic[];
};

export type ResearchAddition = {
  title: string;
  paragraphs: string[];
  concepts: { term: string; symbol: string; meaning: string }[];
  sources: SourceNote[];
};

/** Extrai JSON mesmo quando o modelo cerca a resposta com ``` ou texto. */
export function extractJson(text: string): unknown {
  const trimmed = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        throw new Error("A resposta não veio em JSON.");
      }
    }
    throw new Error("A resposta não veio em JSON.");
  }
}

export function asString(value: unknown, max: number): string {
  return typeof value === "string" ? clip(value, max) : "";
}

export function checkedSvg(raw: string): string {
  const clean = sanitizeSvg(raw);
  if (!clean) return "";
  return validateDiagram(clean).ok ? clean : "";
}

/**
 * Normaliza uma questão da IA. Devolve `null` quando não dá para usar:
 * são exigidas 4 alternativas e um índice válido.
 */
export function asQuiz(raw: unknown, fallback: Difficulty, id: string): QuizItem | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const choices = Array.isArray(row.choices)
    ? row.choices.map((c) => asString(c, 180)).filter(Boolean)
    : [];
  if (choices.length !== 4) return null;
  const correctIndex = Number(row.correctIndex);
  if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > 3) return null;
  const prompt = asString(row.prompt, 500);
  if (!prompt) return null;
  const difficulty =
    row.difficulty === "facil" || row.difficulty === "medio" || row.difficulty === "dificil"
      ? row.difficulty
      : fallback;
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

/** Formato canônico do pacote de aula (4 questões de 4 alternativas etc.). */
export function coercePackage(
  raw: unknown,
  provider: string,
  webSearch: boolean,
): PackageBody | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const essence = Array.isArray(row.essence)
    ? row.essence
        .map((l) => asString(l, 180))
        .filter(Boolean)
        .slice(0, 3)
    : [];
  while (essence.length < 3) essence.push("");
  const concepts = Array.isArray(row.concepts)
    ? row.concepts
        .map((c) => {
          const item = c as Record<string, unknown>;
          return {
            term: asString(item?.term, 80),
            symbol: asString(item?.symbol, 40),
            meaning: asString(item?.meaning, 240),
          };
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
    pitfalls: (Array.isArray(row.pitfalls) ? row.pitfalls : [])
      .map((p) => asString(p, 200))
      .filter(Boolean)
      .slice(0, 4),
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

export function imageQueries(raw: unknown): string[] {
  if (!raw || typeof raw !== "object") return [];
  const list = (raw as Record<string, unknown>).imageQueries;
  if (!Array.isArray(list)) return [];
  return list
    .map((q) => asString(q, 80))
    .filter(Boolean)
    .slice(0, 2);
}

/** Acréscimo de pesquisa do professor. Exige ao menos um parágrafo útil. */
export function coerceResearch(raw: unknown): ResearchAddition | null {
  if (!raw || typeof raw !== "object") return null;
  const parsed = raw as Record<string, unknown>;
  const paragraphs = Array.isArray(parsed.paragraphs)
    ? parsed.paragraphs
        .map((p) => asString(p, 500))
        .filter((p) => p.length > 40)
        .slice(0, 4)
    : [];
  if (!paragraphs.length) return null;
  const concepts = Array.isArray(parsed.concepts)
    ? parsed.concepts
        .map((c) => {
          const item = c as Record<string, unknown>;
          return {
            term: asString(item?.term, 80),
            symbol: asString(item?.symbol, 40),
            meaning: asString(item?.meaning, 320),
          };
        })
        .filter((c) => c.term && c.meaning.length > 40)
        .slice(0, 4)
    : [];
  const sources = Array.isArray(parsed.sources)
    ? parsed.sources
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
        .slice(0, 4)
    : [];
  return {
    title: asString(parsed.title, 80) || "Fora do pacote",
    paragraphs,
    concepts,
    sources,
  };
}

/** Texto do tutor no modo "explique de outro jeito". */
export function tutorText(raw: unknown): string {
  if (!raw || typeof raw !== "object") return "";
  return asString((raw as { text?: unknown }).text, 700);
}
