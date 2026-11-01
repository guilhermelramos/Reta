export type BlockKind = "A" | "B" | "R" | "L";

export type PlanBlock = {
  kind: BlockKind;
  content: string;
  plannedMin: number;
};

export type PlanDay = {
  date: string;
  phase: string;
  blocks: PlanBlock[];
};

export type Difficulty = "facil" | "medio" | "dificil";

export type QuizItem = {
  id: string;
  difficulty: Difficulty;
  prompt: string;
  choices: string[];
  correctIndex: number;
  hint: string;
  explanation: string;
  altExplanation: string;
  diagramSvg: string;
};

export type Concept = { term: string; symbol: string; meaning: string };
export type Formula = { expr: string; meaning: string };
export type SourceNote = { title: string; url: string; note: string };
export type Flashcard = { front: string; back: string };

export type ImageCredit = {
  src: string;
  alt: string;
  credit: string;
  license: string;
  sourceUrl: string;
  /** Legenda didática em português. */
  caption?: string;
  /** Dois ou três pontos do que observar. */
  watch?: string[];
  relatedTerm?: string;
};

export type LessonBeat = {
  heading: string;
  paragraphs: string[];
  whyExam: string;
  dispute?: string;
};

export type Pitfall = {
  id: string;
  mistake: string;
  why: string;
  trap: QuizItem;
};

export type Subtopic = {
  id: string;
  code: string;
  subject: string;
  title: string;
  minutes: number;
  beats: LessonBeat[];
  concepts: Concept[];
  diagramSvg: string;
  mapSvg: string;
  images: ImageCredit[];
  pitfalls: Pitfall[];
  diagnostic: QuizItem[];
  practice: QuizItem[];
  mastery: QuizItem;
};

export type FlowPhase = "diag" | "aula" | "pratica" | "checagem" | "fecho" | "bloco";

export type SessionFlow = {
  sub: number;
  phase: FlowPhase;
  q: number;
  practiceAsked: string[];
  practiceLevel: Difficulty;
  diagMiss: boolean;
  checks: Record<string, "ok" | "later">;
};

export type ChatMsg = {
  role: "user" | "professor";
  text: string;
  outside?: boolean;
  cite?: string;
  svg?: string;
};

export type Doubt = {
  id: string;
  blockId: string;
  title: string;
  status: "aberta" | "resolvida" | "revisar";
  updatedAt: number;
  messages: ChatMsg[];
};

export type StudyPackage = {
  id: string;
  date: string;
  kind: BlockKind;
  topic: string;
  essence: string[];
  development: string;
  concepts: Concept[];
  formulas: Formula[];
  pitfalls: string[];
  sources: SourceNote[];
  images: ImageCredit[];
  diagramSvg: string;
  diagnostic: QuizItem;
  questions: QuizItem[];
  flashcards: Flashcard[];
  generatedAt: number;
  provider: string;
  webSearch: boolean;
  schemaVersion?: number;
  displayTitle?: string;
  codes?: string[];
  subtopics?: Subtopic[];
};

export type SessionMode = "cheio" | "15";

export type StudySession = {
  id: string;
  date: string;
  kind: BlockKind;
  mode: SessionMode;
  sheetMin: number;
  budgetMin: number;
  bonusMin: number;
  elapsedSec: number;
  running: boolean;
  runStartedAt: number | null;
  status: "active" | "done";
  step: "aula" | "diag" | "pratica" | "dominio";
  diagCorrect: boolean | null;
  asked: string[];
  correct: number;
  wrong: number;
  difficulty: Difficulty;
  missed: string[];
  startedAt: number;
  endedAt: number | null;
  flow?: SessionFlow;
};

export type Mistake = {
  id: string;
  sessionId: string;
  date: string;
  kind: BlockKind;
  topic: string;
  prompt: string;
  choices: string[];
  correctIndex: number;
  userIndex: number;
  explanation: string;
  createdAt: number;
  reviewed: boolean;
};

export type ResearcherId = "grok" | "perplexity" | "gemini" | "claude";

export type Settings = {
  studyHour: number;
  studyMinute: number;
  alerts: {
    start: boolean;
    review: boolean;
    questions: boolean;
    pending: boolean;
  };
  quiet: boolean;
  researcher: ResearcherId;
  /** Chaves só neste aparelho. Vazio em Grok = chave do app, no servidor. */
  keys: { xai: string; perplexity: string; gemini: string; claude: string };
  webSearch: boolean;
};

export type ColumnKey =
  | "date"
  | "phase"
  | "contentA"
  | "minA"
  | "contentB"
  | "minB"
  | "contentR"
  | "minR"
  | "contentL"
  | "minL";

export type ColumnMap = Record<ColumnKey, number | null>;

export type RowWarning = { row: number; message: string };

export type SheetTable = {
  name: string;
  headers: string[];
  headerRow: number;
  matrix: string[][];
};

export type ParsePreview = {
  sheetName: string;
  headers: string[];
  headerRow: number;
  map: ColumnMap;
  days: PlanDay[];
  warnings: RowWarning[];
};

export const KIND_LABEL: Record<BlockKind, string> = {
  A: "Bloco A",
  B: "Bloco B",
  R: "Revisão",
  L: "Leitura",
};

export const EMPTY_SETTINGS: Settings = {
  studyHour: 14,
  studyMinute: 0,
  alerts: { start: true, review: true, questions: true, pending: true },
  quiet: false,
  researcher: "grok",
  keys: { xai: "", perplexity: "", gemini: "", claude: "" },
  webSearch: false,
};
