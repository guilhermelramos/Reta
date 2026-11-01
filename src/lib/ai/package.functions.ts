import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { BlockKind, Concept, Flashcard, Formula, QuizItem, StudyPackage, Subtopic } from "@/lib/study/types";

/**
 * Gerador dinâmico de pacote de estudo para qualquer tópico da planilha.
 * Usa a mesma chave da xAI e o mesmo modelo sem raciocínio do professor
 * (`src/routes/api/professor.ts` e `src/lib/ai/study.functions.ts`), mas pede
 * um JSON próprio: resumo de prova + 5 flashcards + 4 questões A–E.
 *
 * O resultado é validado com zod em duas camadas (formato tolerado do modelo e
 * formato final canônico) e adaptado ao `StudyPackage` já existente.
 */

const MODEL = "grok-4.20-0309-non-reasoning";
const LETTERS = ["A", "B", "C", "D", "E"] as const;

type Ok<T> = { ok: true; data: T };
type Err = { ok: false; error: string };

export type AiBlockPackage = {
  title: string;
  summary: string;
  essence: string[];
  concepts: Concept[];
  formulas: Formula[];
  pitfalls: string[];
  flashcards: Flashcard[];
  questions: QuizItem[];
  provider: string;
  webSearch: boolean;
  model: string;
};

/* ------------------------------- zod (entrada do modelo) ------------------------------- */

const AiOptionsSchema = z.object({
  A: z.string().optional(),
  B: z.string().optional(),
  C: z.string().optional(),
  D: z.string().optional(),
  E: z.string().optional(),
  a: z.string().optional(),
  b: z.string().optional(),
  c: z.string().optional(),
  d: z.string().optional(),
  e: z.string().optional(),
});

const AiQuestionSchema = z.object({
  prompt: z.string().min(10),
  explanation: z.string().min(10),
  options: z.union([z.array(z.string()), AiOptionsSchema]).optional(),
  choices: z.array(z.string()).optional(),
  correctOption: z.string().optional(),
  correctIndex: z.number().optional(),
  hint: z.string().optional(),
  difficulty: z.string().optional(),
});

const AiPackageSchema = z.object({
  title: z.string().optional(),
  summary: z.string().min(40),
  essence: z.array(z.string()).optional(),
  concepts: z
    .array(z.object({ term: z.string(), symbol: z.string().optional(), meaning: z.string() }))
    .optional(),
  formulas: z.array(z.object({ expr: z.string(), meaning: z.string().optional() })).optional(),
  pitfalls: z.array(z.string()).optional(),
  flashcards: z.array(z.object({ front: z.string(), back: z.string() })).min(5),
  questions: z.array(AiQuestionSchema).min(4),
});

/* ------------------------------- zod (formato final) ------------------------------- */

const FinalQuestionSchema = z.object({
  id: z.string(),
  difficulty: z.enum(["facil", "medio", "dificil"]),
  prompt: z.string().min(10),
  choices: z.array(z.string().min(1)).length(5),
  correctIndex: z.number().int().min(0).max(4),
  hint: z.string(),
  explanation: z.string().min(10),
  altExplanation: z.string(),
  diagramSvg: z.string(),
});

const FinalPackageSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(40),
  essence: z.array(z.string().min(2)).length(3),
  concepts: z.array(z.object({ term: z.string().min(1), symbol: z.string(), meaning: z.string().min(5) })).min(2),
  formulas: z.array(z.object({ expr: z.string().min(1), meaning: z.string() })),
  pitfalls: z.array(z.string().min(5)).min(1),
  flashcards: z.array(z.object({ front: z.string().min(2), back: z.string().min(2) })).length(5),
  questions: z.array(FinalQuestionSchema).length(4),
});

/* ------------------------------- helpers ------------------------------- */

function clip(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : clean.slice(0, max);
}

function cleanError(status: number, body: string): string {
  const sliced = body.replace(/[A-Za-z0-9_-]{20,}/g, "•••").slice(0, 160);
  if (status === 401 || status === 403) return "Chave da xAI recusada. Confira em Ajustes.";
  if (status === 429) return "Limite de uso da IA agora. Espere um pouco e tente de novo.";
  if (status >= 500) return "A IA está indisponível. Tente de novo em instantes.";
  return sliced ? `Falha ${status}: ${sliced}` : `Falha ${status} ao falar com a IA.`;
}

function extractJson(text: string): unknown {
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
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
    throw new Error("A resposta não veio em JSON.");
  }
}

function paragraphsOf(summary: string): string[] {
  const parts = summary
    .split(/\n\s*\n|\n/)
    .map((part) => part.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean);
  if (parts.length > 1) return parts.slice(0, 6);
  // Sem quebras: corta em frases para a aula não virar um bloco único.
  const sentences = summary
    .replace(/([.!?])\s+/g, "$1\n")
    .split("\n")
    .map((part) => part.trim())
    .filter(Boolean);
  const chunks: string[] = [];
  for (let index = 0; index < sentences.length; index += 2) {
    chunks.push(sentences.slice(index, index + 2).join(" "));
  }
  return chunks.slice(0, 6);
}

function readChoices(row: z.infer<typeof AiQuestionSchema>): string[] {
  const fromArray = (list: string[] | undefined): string[] =>
    (list ?? []).map((item) => clip(item, 300)).filter(Boolean);

  if (Array.isArray(row.options)) return fromArray(row.options);
  if (row.options && typeof row.options === "object") {
    const source = row.options as Record<string, string | undefined>;
    return LETTERS.map((letter) => clip(source[letter] ?? source[letter.toLowerCase()] ?? "", 300)).filter(Boolean);
  }
  return fromArray(row.choices);
}

function readCorrectIndex(row: z.infer<typeof AiQuestionSchema>): number {
  const letter = clip(row.correctOption ?? "", 1).toUpperCase();
  const byLetter = LETTERS.indexOf(letter as (typeof LETTERS)[number]);
  if (byLetter >= 0) return byLetter;
  const index = Number(row.correctIndex);
  if (Number.isInteger(index) && index >= 0 && index < 5) return index;
  return -1;
}

function readDifficulty(raw: string | undefined, fallback: QuizItem["difficulty"]): QuizItem["difficulty"] {
  const text = (raw ?? "").toLowerCase();
  if (/facil|fácil|easy|básic|basic/.test(text)) return "facil";
  if (/dificil|difícil|hard|avan/.test(text)) return "dificil";
  if (/medio|médio|medium|intermedi/.test(text)) return "medio";
  return fallback;
}

function padEssence(essence: string[], summary: string): string[] {
  const sentences = summary
    .replace(/\s+/g, " ")
    .replace(/([.!?])\s+/g, "$1\n")
    .split("\n")
    .map((sentence) => clip(sentence, 200))
    .filter((sentence) => sentence.length > 3);
  const rows = [...essence];
  for (const sentence of sentences) {
    if (rows.length >= 3) break;
    if (!rows.includes(sentence)) rows.push(sentence);
  }
  while (rows.length < 3) rows.push(rows[0] ?? clip(summary, 200));
  return rows.slice(0, 3);
}

function buildPrompt(topic: string, minutes: number): string {
  return [
    "Você é professor de cursinho para vestibular/ENEM, em português do Brasil.",
    "Monte um mini-pacote de estudo sob demanda sobre o tópico abaixo, para a pessoa estudar hoje, no celular.",
    `Tema do bloco: ${topic}`,
    `Tempo previsto do bloco: ${minutes} minutos.`,
    "",
    "Regras:",
    "- summary: 2 a 4 parágrafos curtos e diretos, focados no que MAIS cai em vestibular/ENEM. Inclua as fórmulas/relações essenciais e as pegadinhas clássicas de prova. Proibido texto vazio do tipo “este bloco aborda”.",
    "- essence: exatamente 3 frases curtas de choque de memória.",
    "- concepts: 4 a 6 conceitos com termo, símbolo (vazio se não houver) e significado em uma frase.",
    "- formulas: fórmulas/relações essenciais; use [] se o tema não tiver conta.",
    "- pitfalls: 3 pegadinhas reais de prova.",
    "- flashcards: exatamente 5 cartões de revisão ativa, frente curta e verso com a resposta.",
    "- questions: exatamente 4 questões contextualizadas de vestibular, com 5 alternativas (A, B, C, D, E) e só uma correta. explanation precisa explicar por que a correta está certa e por que os distratores erram. hint não entrega o gabarito.",
    "",
    "Responda só com um JSON válido (sem markdown) neste formato:",
    '{"title":"","summary":"","essence":["","",""],"concepts":[{"term":"","symbol":"","meaning":""}],"formulas":[{"expr":"","meaning":""}],"pitfalls":[""],"flashcards":[{"front":"","back":""}],"questions":[{"prompt":"","options":{"A":"","B":"","C":"","D":"","E":""},"correctOption":"A","explanation":"","hint":"","difficulty":"medio"}]}',
  ].join("\n");
}

async function askModel(key: string, prompt: string): Promise<string> {
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.3,
      max_tokens: 4000,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
    }),
    signal: AbortSignal.timeout(75000),
  });
  if (!res.ok) throw new Error(cleanError(res.status, await res.text().catch(() => "")));
  const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = body.choices?.[0]?.message?.content ?? "";
  if (!text.trim()) throw new Error("A IA voltou vazia.");
  return text;
}

/** Valida o JSON do modelo (zod) e normaliza para o formato final (zod de novo). */
function parsePackage(text: string): z.infer<typeof FinalPackageSchema> | null {
  let raw: unknown;
  try {
    raw = extractJson(text);
  } catch {
    return null;
  }
  const loose = AiPackageSchema.safeParse(raw);
  if (!loose.success) return null;
  const row = loose.data;

  const summary = clip(row.summary.replace(/[ \t]+/g, " ").trim(), 4000);
  if (summary.length < 40) return null;

  const essence = padEssence(
    (row.essence ?? []).map((line) => clip(line, 200)).filter((line) => line.length > 3),
    summary,
  );

  const concepts: Concept[] = (row.concepts ?? [])
    .map((concept) => ({
      term: clip(concept.term, 80),
      symbol: clip(concept.symbol ?? "", 40),
      meaning: clip(concept.meaning, 320),
    }))
    .filter((concept) => concept.term && concept.meaning.length >= 5)
    .slice(0, 6);

  const formulas: Formula[] = (row.formulas ?? [])
    .map((formula) => ({ expr: clip(formula.expr, 140), meaning: clip(formula.meaning ?? "", 280) }))
    .filter((formula) => formula.expr)
    .slice(0, 6);

  const pitfalls = (row.pitfalls ?? [])
    .map((pitfall) => clip(pitfall, 260))
    .filter((pitfall) => pitfall.length >= 5)
    .slice(0, 4);
  if (!pitfalls.length) pitfalls.push("Leia o comando até o fim: a pegadinha clássica é trocar o conceito na última linha.");

  const questions: QuizItem[] = [];
  row.questions.forEach((question, index) => {
    const choices = readChoices(question);
    const correctIndex = readCorrectIndex(question);
    if (choices.length !== 5 || correctIndex < 0) return;
    const prompt = clip(question.prompt, 600);
    const explanation = clip(question.explanation, 900);
    if (!prompt || explanation.length < 10) return;
    questions.push({
      id: `ia-q${index + 1}`,
      difficulty: readDifficulty(question.difficulty, index === 0 ? "facil" : index === 3 ? "dificil" : "medio"),
      prompt,
      choices,
      correctIndex,
      hint: clip(question.hint ?? "", 320),
      explanation,
      altExplanation: explanation,
      diagramSvg: "",
    });
  });

  const flashcards: Flashcard[] = row.flashcards
    .map((card) => ({ front: clip(card.front, 160), back: clip(card.back, 300) }))
    .filter((card) => card.front.length >= 2 && card.back.length >= 2)
    .slice(0, 5);

  const final = FinalPackageSchema.safeParse({
    title: clip(row.title ?? "", 90) || "Aula gerada por IA",
    summary,
    essence,
    concepts,
    formulas,
    pitfalls,
    flashcards,
    questions: questions.slice(0, 4),
  });
  return final.success ? final.data : null;
}

/* ------------------------------- adaptação ao StudyPackage ------------------------------- */

/** Pacote "rico" = já tem aula estruturada, cartões e questões salvas no aparelho. */
export function isRichPackage(pkg: StudyPackage | null | undefined): boolean {
  if (!pkg) return false;
  const subs = pkg.subtopics ?? [];
  return subs.length > 0 && pkg.flashcards.length >= 3 && pkg.questions.length >= 2 && pkg.essence.length > 0;
}

export function toStudyPackage(
  ai: AiBlockPackage,
  meta: { date: string; kind: BlockKind; topic: string; minutes: number },
): StudyPackage {
  const topic = meta.topic.trim();
  const title = ai.title || clip(topic.split(/[.:]/)[0] ?? "", 72) || "Bloco";
  const subject = clip((topic.split(":")[0] ?? "").trim(), 40) || "Geral";
  const minutes = Math.max(5, Math.min(240, meta.minutes || 30));
  const questions = ai.questions;
  const first = questions[0];
  const second = questions[1] ?? first;
  const third = questions[2] ?? second;
  const last = questions[3] ?? third;
  if (!first || !second || !third || !last) throw new Error("O pacote veio sem questões.");
  const trap = (item: QuizItem, index: number): QuizItem => ({
    ...item,
    id: `${meta.date}:${meta.kind}:ia-trap-${index + 1}`,
  });

  const sub: Subtopic = {
    id: `${meta.date}:${meta.kind}:ia`,
    code: "IA",
    subject,
    title,
    minutes,
    beats: [
      {
        heading: "Resumo focado na prova",
        paragraphs: paragraphsOf(ai.summary),
        whyExam: ai.essence[0] ?? "O que mais cai no vestibular está resumido acima.",
      },
    ],
    concepts: ai.concepts,
    diagramSvg: "",
    mapSvg: "",
    images: [],
    pitfalls: ai.pitfalls.map((mistake, index) => ({
      id: `${meta.date}:${meta.kind}:ia-pit-${index + 1}`,
      mistake,
      why: "Pegadinha clássica de prova: leia o comando com atenção antes de marcar.",
      trap: trap(questions[index % questions.length] ?? first, index),
    })),
    diagnostic: [first],
    practice: [second, third],
    mastery: last,
  };

  const codes = [...new Set(topic.match(/\b[A-Z]{1,3}\d{2}\b/g) ?? [])].slice(0, 6);

  return {
    id: `${meta.date}:${meta.kind}`,
    date: meta.date,
    kind: meta.kind,
    topic,
    displayTitle: title,
    codes,
    essence: ai.essence,
    development: ai.summary,
    concepts: ai.concepts,
    formulas: ai.formulas,
    pitfalls: ai.pitfalls,
    sources: [],
    images: [],
    diagramSvg: "",
    diagnostic: first,
    questions: questions.slice(0, 4),
    flashcards: ai.flashcards,
    generatedAt: Date.now(),
    provider: ai.provider,
    webSearch: ai.webSearch,
    schemaVersion: 3,
    subtopics: [sub],
  };
}

/* ------------------------------- server function ------------------------------- */

export const generateBlockPackage = createServerFn({ method: "POST" })
  .validator((input: { topic?: string; minutes?: number; userKey?: string }) => {
    const topic = typeof input?.topic === "string" ? clip(input.topic, 1200) : "";
    if (topic.length < 3) throw new Error("Tema inválido.");
    const minutes = Number(input?.minutes);
    const userKey = typeof input?.userKey === "string" ? input.userKey.trim() : "";
    if (userKey.length > 400) throw new Error("Chave inválida.");
    return {
      topic,
      minutes: Number.isFinite(minutes) ? Math.min(240, Math.max(5, minutes)) : 30,
      userKey,
    };
  })
  .handler(async ({ data }): Promise<Ok<AiBlockPackage> | Err> => {
    const key = data.userKey || process.env.XAI_API_KEY?.trim() || "";
    if (!key) {
      return {
        ok: false,
        error: "Sem chave da xAI neste aparelho. Cole a sua chave do Grok em Ajustes e tente de novo.",
      };
    }
    const prompt = buildPrompt(data.topic, data.minutes);
    let rejection = "estrutura incompleta";
    for (let attempt = 0; attempt < 2; attempt += 1) {
      let text: string;
      try {
        text = await askModel(
          key,
          attempt === 0
            ? prompt
            : `${prompt}\n\nA tentativa anterior foi recusada (${rejection}). Refaça o JSON inteiro: resumo com pelo menos 40 caracteres, exatamente 5 flashcards e 4 questões com 5 alternativas (A–E).`,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "Falha ao gerar o pacote.";
        if (/timeout|aborted/i.test(message)) {
          return { ok: false, error: "A IA demorou demais para responder. Tente de novo; o resto do app continua." };
        }
        return { ok: false, error: message };
      }
      const parsed = parsePackage(text);
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
            model: MODEL,
          },
        };
      }
      rejection = "o JSON não passou na validação (resumo, 5 flashcards ou 4 questões A–E)";
    }
    return { ok: false, error: "A IA devolveu um pacote incompleto. Tente gerar de novo." };
  });
