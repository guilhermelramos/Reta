import { readFileSync, writeFileSync } from "node:fs";
import { applyMap, guessMap, pickSheet, readWorkbook } from "../src/lib/study/parse-sheet.ts";

const buf = readFileSync(new URL("../attachments/UTFPR_Reta_Final_Simples.xlsx", import.meta.url));
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
const sheets = readWorkbook(ab);
const sheet = pickSheet(sheets);
if (!sheet) {
  console.error("no sheet");
  process.exit(1);
}
const map = guessMap(sheet.headers);
const { days, warnings } = applyMap(sheet.matrix, sheet.headerRow, map);
console.log(sheet.name, days.length, "days", warnings.length, "warnings");
console.log("map", JSON.stringify(map));
console.log("first", days[0]?.date, days[0]?.blocks.map((b) => b.kind + ":" + b.plannedMin).join(","));
console.log("todayish", days.find((d) => d.date === "2026-10-31")?.phase);
const body = `import type { PlanDay } from "@/lib/study/types";\n\n/** Plano UTFPR 2027 carregado da planilha anexa. Reimportar não apaga o histórico. */\nexport const SEED_DAYS: PlanDay[] = ${JSON.stringify(days, null, 2)};\n`;
writeFileSync(new URL("../src/lib/study/seed.ts", import.meta.url), body);
