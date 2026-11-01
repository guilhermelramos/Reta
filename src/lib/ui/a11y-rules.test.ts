import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { auditA11ySource } from "./a11y-rules.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, "..", "..");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    if (!/\.(ts|tsx)$/.test(entry.name)) return [];
    if (/\.test\.ts$/.test(entry.name)) return [];
    return [path];
  });
}

function ruleIds(source: string): string[] {
  return auditA11ySource("amostra.tsx", source).map((issue) => issue.rule);
}

describe("auditA11ySource: alvos de toque", () => {
  it("marca as classes de 44px que o app não pode mais usar", () => {
    assert.deepEqual(ruleIds('<button className="min-h-11 size-11" />'), [
      "touch-target",
      "touch-target",
    ]);
  });

  it("aceita as classes de 48px", () => {
    assert.deepEqual(ruleIds('<button className="min-h-12 size-12" />'), []);
  });
});

describe("auditA11ySource: opacidade do texto", () => {
  it("marca texto abaixo de /80, inclusive em placeholder", () => {
    assert.deepEqual(ruleIds('<p className="text-muted/60" />'), ["text-opacity"]);
    assert.deepEqual(ruleIds('<input className="placeholder:text-muted/50" />'), [
      "text-opacity",
    ]);
  });

  it("aceita /80 ou mais e ignora opacidade de fundo/borda", () => {
    assert.deepEqual(ruleIds('<p className="text-muted/80 text-fg" />'), []);
    assert.deepEqual(ruleIds('<p className="bg-primary/50 border-primary/60" />'), []);
  });
});

describe("auditA11ySource: metadados", () => {
  it("marca fonte abaixo de 12px", () => {
    assert.deepEqual(ruleIds('<span className="text-[11px]" />'), ["metadata-size"]);
  });

  it("aceita text-xs (12px)", () => {
    assert.deepEqual(ruleIds('<span className="text-xs" />'), []);
  });
});

describe("código-fonte do app", () => {
  it("não tem alvos de 44px, texto com opacidade baixa nem metadados < 12px", () => {
    const issues = sourceFiles(SRC).flatMap((file) =>
      auditA11ySource(relative(SRC, file), readFileSync(file, "utf8")),
    );

    assert.deepEqual(
      issues,
      [],
      issues.map((issue) => `${issue.file}:${issue.line} ${issue.message}`).join("\n"),
    );
  });
});
