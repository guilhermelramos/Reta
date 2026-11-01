import { createServerFn } from "@tanstack/react-start";
import { runGeneratePackage, runPingAi, runResearchAdd, runTutorTurn } from "./core.ts";
import { type PackageBody } from "./parse.ts";
import { serverDeps } from "./server-deps.ts";
import type { Difficulty, ResearcherId } from "../study/types.ts";
import { clip } from "./text.ts";

/**
 * Server functions da IA para a web/Vercel. O APK não tem servidor: lá o
 * `xai-client.ts` executa exatamente os mesmos prompts/parsers de `core.ts`
 * chamando a xAI direto pelo CapacitorHttp.
 *
 * As chaves nunca ficam no código: na web vale a chave do usuário (Ajustes) ou
 * `XAI_API_KEY` do ambiente; no APK, só a chave guardada no cofre do aparelho.
 */

export type { PackageBody };

const PROVIDERS: ResearcherId[] = ["grok", "perplexity", "gemini", "claude"];

export const pingAi = createServerFn({ method: "POST" })
  .validator((input: { provider?: string; userKey?: string }) => {
    const provider = input?.provider;
    if (!PROVIDERS.includes(provider as ResearcherId)) throw new Error("Provedor inválido.");
    const userKey = typeof input?.userKey === "string" ? input.userKey.trim() : "";
    if (userKey.length > 400) throw new Error("Chave inválida.");
    return { provider: provider as ResearcherId, userKey };
  })
  .handler(({ data }) => runPingAi(data, serverDeps));

export const generatePackage = createServerFn({ method: "POST" })
  .validator(
    (input: {
      topic?: string;
      minutes?: number;
      provider?: string;
      userKey?: string;
      webSearch?: boolean;
      gaps?: string;
    }) => {
      const topic = typeof input?.topic === "string" ? input.topic.trim() : "";
      if (topic.length < 3 || topic.length > 2500) throw new Error("Tema inválido.");
      const provider = input?.provider;
      if (!PROVIDERS.includes(provider as ResearcherId)) throw new Error("Provedor inválido.");
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
    },
  )
  .handler(({ data }) => runGeneratePackage(data, serverDeps));

export const researchAdd = createServerFn({ method: "POST" })
  .validator((input: { question?: string; topic?: string; userKey?: string }) => {
    const question = typeof input?.question === "string" ? clip(input.question, 500) : "";
    const topic = typeof input?.topic === "string" ? clip(input.topic, 300) : "";
    if (question.length < 5 || !topic) throw new Error("Dúvida incompleta.");
    const userKey = typeof input?.userKey === "string" ? input.userKey.trim() : "";
    if (userKey.length > 400) throw new Error("Chave inválida.");
    return { question, topic, userKey };
  })
  .handler(({ data }) => runResearchAdd(data, serverDeps));

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
      const action =
        input?.action === "reexplain" || input?.action === "diagnostic" ? input.action : "question";
      const difficulty: Difficulty =
        input?.difficulty === "facil" || input?.difficulty === "dificil"
          ? input.difficulty
          : "medio";
      const avoid = Array.isArray(input?.avoid)
        ? input.avoid.map((p) => clip(String(p), 180)).slice(0, 8)
        : [];
      const userKey = typeof input?.userKey === "string" ? input.userKey.trim() : "";
      if (userKey.length > 400) throw new Error("Chave inválida.");
      const previous = typeof input?.previous === "string" ? clip(input.previous, 800) : "";
      return { topic, brief, action, difficulty, avoid, userKey, previous };
    },
  )
  .handler(({ data }) => runTutorTurn(data, serverDeps));
