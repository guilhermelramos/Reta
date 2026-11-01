import { validateDiagram } from "./diagrams.ts";
import type { StudyPackage } from "./types.ts";

export function fold(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function squash(value: string): string {
  return fold(value).replace(/[^a-z0-9]+/g, "");
}

const SHALLOW = /\b(o bloco|este bloco|o conteudo|este conteudo)\s+(aborda|trata|apresenta|abrange|fala)\b/;

const LEXICON = [
  "iluminismo",
  "inglesa",
  "francesa",
  "industrial",
  "independ",
  "neocolonial",
  "lateriza",
  "lixivia",
  "equatorial",
  "tropical",
  "semiarid",
  "subtropical",
  "bioma",
  "cerrado",
  "ciclohidrolog",
  "tempoatmosfer",
  "gloriosa",
  "berlim",
  "aquif",
  "latossolo",
  "maritim",
  "continental",
  "pantanal",
  "caatinga",
  "pampa",
  "amazonia",
  "presal",
  "absolutismo",
  "mercantil",
  "bastilha",
  "recurso",
  "reserva",
];

const MODERNA = ["iluminismo", "inglesa", "francesa", "industrial", "independ", "neocolonial", "lateriza", "lixivia", "equatorial", "semiarid", "bioma", "ciclohidrolog"];

export function isModernaBlock(topic: string): boolean {
  const text = fold(topic);
  return text.includes("h03") && text.includes("moderna") && (text.includes("g04") || text.includes("g08"));
}

function conceptBlob(pkg: StudyPackage): string {
  const parts = [...pkg.concepts.map((c) => c.term)];
  for (const sub of pkg.subtopics ?? []) {
    for (const concept of sub.concepts) parts.push(concept.term);
  }
  return squash(parts.join(" "));
}

function allText(pkg: StudyPackage): string {
  const parts = [pkg.essence.join(" "), pkg.development, pkg.pitfalls.join(" ")];
  for (const concept of pkg.concepts) parts.push(`${concept.term} ${concept.meaning}`);
  for (const sub of pkg.subtopics ?? []) {
    for (const beat of sub.beats) parts.push(beat.heading, beat.paragraphs.join(" "), beat.whyExam, beat.dispute ?? "");
    for (const concept of sub.concepts) parts.push(`${concept.term} ${concept.meaning}`);
    for (const pit of sub.pitfalls) parts.push(pit.mistake, pit.why);
  }
  return squash(parts.join(" "));
}

export function coverageProblems(pkg: StudyPackage, topic: string): string[] {
  const problems: string[] = [];
  const blob = allText(pkg);
  const defined = conceptBlob(pkg);
  if (SHALLOW.test(fold(`${pkg.essence.join(" ")} ${pkg.development}`))) problems.push("Essência só descreve o escopo.");
  for (const sub of pkg.subtopics ?? []) {
    for (const beat of sub.beats) {
      if (SHALLOW.test(fold(beat.paragraphs.join(" ")))) problems.push(`Texto de escopo em ${sub.code}.`);
      if (beat.paragraphs.some((p) => p.trim().length < 50)) problems.push(`Parágrafo curto em ${sub.title}.`);
    }
    if (sub.diagnostic.length < 3) problems.push(`Diagnóstico incompleto em ${sub.code}.`);
    for (const concept of sub.concepts) {
      if (concept.meaning.trim().length < 40) problems.push(`Conceito raso: ${concept.term}.`);
    }
    if (sub.diagramSvg && !validateDiagram(sub.diagramSvg).ok) problems.push(`Diagrama inválido em ${sub.code}.`);
    if (sub.mapSvg && !validateDiagram(sub.mapSvg).ok) problems.push(`Mapa inválido em ${sub.code}.`);
    for (const image of sub.images) {
      if (!image.caption || (image.watch?.length ?? 0) < 2) problems.push(`Imagem sem legenda didática em ${sub.code}.`);
    }
  }
  if (pkg.diagramSvg && !validateDiagram(pkg.diagramSvg).ok) problems.push("Diagrama do bloco inválido.");
  const needed = isModernaBlock(topic) ? MODERNA : [];
  for (const stem of needed) {
    if (!defined.includes(stem)) problems.push(`Falta conceito: ${stem}.`);
  }
  for (const stem of LEXICON) {
    if (blob.includes(stem) && !defined.includes(stem)) problems.push(`Termo sem definição: ${stem}.`);
  }
  return problems;
}
