import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { coverageProblems } from "./coverage.ts";
import { validateDiagram } from "./diagrams.ts";
import { buildHumanasPackage } from "./humanas-pack.ts";

describe("aula de humanas", () => {
  const pkg = buildHumanasPackage({ id: "2026-10-31:A", date: "2026-10-31", kind: "A" });

  it("cobre o bloco sem texto de escopo", () => {
    const problems = coverageProblems(pkg, pkg.topic);
    assert.deepEqual(problems, []);
  });

  it("soma 60 minutos e valida cada svg", () => {
    const minutes = (pkg.subtopics ?? []).reduce((sum, sub) => sum + sub.minutes, 0);
    assert.equal(minutes, 60);
    for (const sub of pkg.subtopics ?? []) {
      assert.equal(validateDiagram(sub.diagramSvg).ok, true, `${sub.id} diagrama ${validateDiagram(sub.diagramSvg).reasons.join("; ")}`);
      assert.equal(validateDiagram(sub.mapSvg).ok, true, `${sub.id} mapa ${validateDiagram(sub.mapSvg).reasons.join("; ")}`);
      assert.equal(sub.diagnostic.length, 3);
    }
    assert.match(pkg.displayTitle ?? "", /Moderna/);
    assert.equal(pkg.images.every((img) => img.caption && (img.watch?.length ?? 0) >= 2), true);
  });
});
