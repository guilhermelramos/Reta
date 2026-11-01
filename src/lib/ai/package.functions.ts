import { createServerFn } from "@tanstack/react-start";
import { runGenerateBlockPackage } from "./core.ts";
import { serverDeps } from "./server-deps.ts";
import { clip } from "./text.ts";

/**
 * Server function do pacote sob demanda (`generateBlockPackage`) para a web.
 * A lógica de prompt/parse mora em `block-package.ts` e `core.ts`, usada tanto
 * aqui quanto no APK via `xai-client.ts`.
 */

export type { AiBlockPackage } from "./block-package.ts";
export { isRichPackage, toStudyPackage } from "./block-package.ts";

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
  .handler(({ data }) => runGenerateBlockPackage(data, serverDeps));
