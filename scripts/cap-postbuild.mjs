#!/usr/bin/env node
/**
 * Pós-processamento do build SPA usado pelo Capacitor (`npm run build:cap`).
 *
 * O bundle SSR que pré-renderiza o shell do SPA referencia o CSS com o hash
 * calculado no ambiente de servidor (ex. `styles-C90li_7p.css`), enquanto o
 * build do cliente emite o arquivo com outro hash (`styles-D_v_mJSN.css`).
 * Resultado: o `index.html` do app nativo abriria sem CSS.
 *
 * Aqui só ajustamos o `<link rel="stylesheet">` para o CSS que realmente existe
 * em `dist-cap/client/assets`. O build web/Vercel não passa por este script.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CLIENT_DIR = join(ROOT, "dist-cap/client");
const ASSETS_DIR = join(CLIENT_DIR, "assets");
const INDEX = join(CLIENT_DIR, "index.html");

function fail(message) {
  console.error(`[build:cap] ${message}`);
  process.exit(1);
}

if (!existsSync(INDEX)) {
  fail("dist-cap/client/index.html não foi gerado — o modo SPA do TanStack Start falhou.");
}

const cssFiles = readdirSync(ASSETS_DIR).filter(
  (file) => file.startsWith("styles-") && file.endsWith(".css"),
);
if (cssFiles.length !== 1) {
  fail(`esperava exatamente um CSS em assets/, achei: ${cssFiles.join(", ") || "nenhum"}`);
}

let html = readFileSync(INDEX, "utf8");

// Todo href de CSS aponta para o único CSS emitido.
html = html.replace(/\/assets\/styles-[A-Za-z0-9_-]+\.css/g, `/assets/${cssFiles[0]}`);

// Falha cedo se algum asset referenciado pelo shell não existir (JS quebrado no APK).
const missing = [...html.matchAll(/(?:href|src)="(\/assets\/[^"]+)"/g)]
  .map((match) => match[1])
  .filter((assetPath) => !existsSync(join(CLIENT_DIR, assetPath.replace(/^\//, ""))));
if (missing.length > 0) {
  fail(`assets referenciados pelo index.html não existem: ${[...new Set(missing)].join(", ")}`);
}

writeFileSync(INDEX, html);
console.log(`[build:cap] index.html -> ${cssFiles[0]}`);
