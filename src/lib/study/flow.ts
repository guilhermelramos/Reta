import type { Difficulty, QuizItem, SessionFlow, Subtopic } from "./types.ts";

const ORDER: Difficulty[] = ["facil", "medio", "dificil"];

export function emptyFlow(): SessionFlow {
  return { sub: 0, phase: "diag", q: 0, practiceAsked: [], practiceLevel: "facil", diagMiss: false, checks: {} };
}

export function bumpLevel(level: Difficulty, up: boolean): Difficulty {
  const index = ORDER.indexOf(level);
  return ORDER[Math.min(2, Math.max(0, index + (up ? 1 : -1)))] ?? level;
}

export function pickPractice(sub: Subtopic, flow: SessionFlow): QuizItem | null {
  const used = new Set(flow.practiceAsked);
  const pool = sub.practice.filter((item) => !used.has(item.id));
  return pool.find((item) => item.difficulty === flow.practiceLevel) ?? pool[0] ?? null;
}

export function questionFor(sub: Subtopic, flow: SessionFlow): QuizItem | null {
  if (flow.phase === "diag") return sub.diagnostic[flow.q] ?? null;
  if (flow.phase === "pratica") return pickPractice(sub, flow);
  if (flow.phase === "checagem") return sub.mastery;
  return null;
}
