import type { StudyPackage, Subtopic } from "./types.ts";

export function blockHeading(content: string): { title: string; codes: string[] } {
  const text = content.toLowerCase();
  if (text.includes("h03") && text.includes("moderna")) {
    return { title: "Humanas · Moderna e revoluções", codes: ["H03", "H04/H05", "G04–G08"] };
  }
  const codes = content.match(/\b[A-Z]{1,3}\d{2}(?:\s*[–/-]\s*(?:[A-Z]{1,3})?\d{2})?/g) ?? [];
  const title = content.split(/[.:]/)[0]?.replace(/\s+/g, " ").trim() || "Bloco";
  return { title: title.slice(0, 72), codes: [...new Set(codes)].slice(0, 6) };
}

export function subtopicMinutes(subs: Subtopic[]): number {
  return subs.reduce((sum, sub) => sum + sub.minutes, 0);
}

export type ResearchAddition = {
  title: string;
  paragraphs: string[];
  concepts: { term: string; symbol: string; meaning: string }[];
  sources: { title: string; url: string; note: string }[];
};

export function mergeAddition(pkg: StudyPackage, subId: string, add: ResearchAddition): StudyPackage {
  const beat = {
    heading: add.title || "Acrescentado agora",
    paragraphs: add.paragraphs.filter((p) => p.trim().length > 40).slice(0, 4),
    whyExam: "Entrou porque você pediu para pesquisar fora do pacote.",
  };
  const subs = (pkg.subtopics ?? []).map((sub) =>
    sub.id !== subId
      ? sub
      : {
          ...sub,
          beats: [...sub.beats, beat],
          concepts: [...sub.concepts, ...add.concepts.filter((c) => c.term && c.meaning)].slice(0, 24),
        },
  );
  return {
    ...pkg,
    subtopics: subs.length ? subs : pkg.subtopics,
    concepts: [...pkg.concepts, ...add.concepts].slice(0, 40),
    sources: [...pkg.sources, ...add.sources].slice(0, 12),
  };
}
