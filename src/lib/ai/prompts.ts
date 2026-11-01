import { clip } from "./text.ts";

/**
 * Montagem dos prompts. Nada aqui chama rede: o servidor (web) e o cliente
 * nativo (CapacitorHttp) enviam exatamente o mesmo texto para a IA.
 */

export type ProfessorMessage = { role: "assistant" | "user"; content: string };

export const STUDY_PACKAGE_SCHEMA = `Responda só com um JSON válido (sem markdown) neste formato:
{"essence":["","",""],"development":"","concepts":[{"term":"","symbol":"","meaning":""}],"formulas":[{"expr":"","meaning":""}],"pitfalls":[""],"sources":[{"title":"","url":"","note":""}],"imageQueries":["english commons query"],"diagramSvg":"","diagnostic":{"difficulty":"facil","prompt":"","choices":["","","",""],"correctIndex":0,"hint":"","explanation":"","altExplanation":"","diagramSvg":""},"questions":[{"difficulty":"facil","prompt":"","choices":["","","",""],"correctIndex":0,"hint":"","explanation":"","altExplanation":"","diagramSvg":""}],"flashcards":[{"front":"","back":""}]}
Regras: português do Brasil, nível vestibular. essence com 3 frases curtas. development com no máximo 700 caracteres. 4 a 6 concepts. formulas só se o tema tiver conta, senão []. 3 pitfalls reais. sources: não invente URL; use "" se não tiver certeza. imageQueries: 2 termos curtos em inglês para foto ou diagrama de licença aberta. diagramSvg: SVG simples com viewBox, só as tags svg g path rect circle line text polyline, sem script, até 1000 caracteres, ou "". diagnostic fácil, para ver o que a pessoa já sabe. questions: exatamente 4, dificuldades facil, medio, medio, dificil, quatro alternativas, uma correta, distratores que são erros comuns. hint não entrega a resposta. altExplanation explica por outro caminho. flashcards: 4, frente curta.`;

export function buildStudyPackagePrompt(input: {
  topic: string;
  minutes: number;
  gaps?: string;
}): string {
  const fix = input.gaps
    ? `\nA tentativa anterior foi recusada: ${input.gaps}\nReescreva ensinando de fato. Proibido texto que só descreva o escopo.`
    : "";
  return `Monte o pacote de estudo para um bloco de vestibular UTFPR.\nTema: ${input.topic}\nMinutos previstos: ${input.minutes || "não informado"}.\n${STUDY_PACKAGE_SCHEMA}\nEnsine causas, datas, consequências e o erro que cai na prova. Toda afirmação factual precisa caber numa fonte. Se houver controvérsia de periodização, diga.${fix}`;
}

export function buildResearchPrompt(input: { topic: string; question: string }): string {
  return `Pesquise e responda em português do Brasil, para vestibular. Tema do bloco: ${input.topic}\nDúvida: ${input.question}\nJSON: {"title":"","paragraphs":["",""],"concepts":[{"term":"","symbol":"","meaning":""}],"sources":[{"title":"","url":"","note":""}]}\nEnsine em parágrafos curtos. Não diga que o bloco aborda o tema. Inclua causa, fato com data quando houver, e consequência. Se for controverso, diga no note da fonte. URL só se você tiver aberto a página; senão "".`;
}

export function buildTutorReexplainPrompt(input: {
  topic: string;
  brief: string;
  previous?: string;
}): string {
  return `Você é o tutor. NÃO busque na web. Use só o pacote.\nTema: ${input.topic}\nPacote: ${input.brief}\nExplique de outro jeito, em até 90 palavras, sem dar lista de alternativas. Texto que já foi dito: ${input.previous || "nenhum"}\nResponda JSON: {"text":""}`;
}

export function buildTutorQuestionPrompt(input: {
  topic: string;
  brief: string;
  action: "question" | "diagnostic";
  difficulty: "facil" | "medio" | "dificil";
  avoid: string[];
}): string {
  return `Você é o tutor de vestibular. NÃO busque na web e NÃO use fato que não esteja no pacote.\nTema: ${input.topic}\nPacote: ${input.brief}\nCrie UMA questão ${input.action === "diagnostic" ? "bem básica, de diagnóstico" : `de dificuldade ${input.difficulty}`}.\nNão repita: ${input.avoid.join(" | ") || "nada"}.\nJSON: {"prompt":"","choices":["","","",""],"correctIndex":0,"hint":"","explanation":"","altExplanation":"","diagramSvg":""}\nHint não revela a resposta. diagramSvg só se um desenho ajudar, senão "".`;
}

export function buildBlockPackagePrompt(
  topic: string,
  minutes: number,
  rejection?: string,
): string {
  const base = [
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
  if (!rejection) return base;
  return `${base}\n\nA tentativa anterior foi recusada (${rejection}). Refaça o JSON inteiro: resumo com pelo menos 40 caracteres, exatamente 5 flashcards e 4 questões com 5 alternativas (A–E).`;
}

/** Contexto do chat do professor, já recortado como a rota de servidor fazia. */
export type ProfessorContext = {
  topic: string;
  subtopic: string;
  brief: string;
  question: string;
  holdAnswer: boolean;
  mistakes: string[];
  messages: ProfessorMessage[];
};

export function buildProfessorSystemPrompt(input: {
  topic?: unknown;
  subtopic?: unknown;
  brief?: unknown;
  question?: unknown;
  holdAnswer?: unknown;
  mistakes?: unknown;
}): string {
  const topic = clip(typeof input.topic === "string" ? input.topic : "", 200);
  const subtopic = clip(typeof input.subtopic === "string" ? input.subtopic : "", 120);
  const brief = clip(typeof input.brief === "string" ? input.brief : "", 6000);
  const question = clip(typeof input.question === "string" ? input.question : "", 600);
  const hold = Boolean(input.holdAnswer);
  const mistakes = Array.isArray(input.mistakes)
    ? input.mistakes.map((item) => clip(String(item), 180)).slice(0, 5)
    : [];
  return [
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
    mistakes.length
      ? `Erros recentes, só como tema, sem entregar resposta de questão aberta: ${mistakes.join(" | ")}`
      : "",
    `PACOTE:\n${brief || "vazio"}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Histórico do chat: papéis normalizados, 800 caracteres, últimas 8 falas. */
export function normalizeProfessorHistory(messages: unknown): ProfessorMessage[] {
  if (!Array.isArray(messages)) return [];
  return messages
    .map((item) => {
      const row = item as { role?: string; content?: string };
      const role = row.role === "assistant" ? "assistant" : "user";
      const content = clip(typeof row.content === "string" ? row.content : "", 800);
      return content ? { role, content } : null;
    })
    .filter((item): item is ProfessorMessage => Boolean(item))
    .slice(-8);
}

export const PING_PROMPT = 'Responda só este JSON: {"ok":true}';
