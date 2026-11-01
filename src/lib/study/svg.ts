import type { Concept } from "@/lib/study/types";

const ALLOWED = new Set([
  "svg",
  "g",
  "path",
  "rect",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
  "text",
  "tspan",
  "title",
  "desc",
  "defs",
  "marker",
]);

/** Tira script, eventos e links externos antes de desenhar um SVG da IA. */
export function sanitizeSvg(input: string): string {
  if (!input || input.length > 12000) return "";
  const match = input.match(/<svg\b[\s\S]*<\/svg>/i);
  if (!match) return "";
  if (typeof DOMParser !== "undefined") {
    const doc = new DOMParser().parseFromString(match[0], "image/svg+xml");
    const svg = doc.querySelector("svg");
    if (!svg || doc.querySelector("parsererror")) return "";
    if (!walk(svg)) return "";
    svg.setAttribute("role", "img");
    if (!svg.getAttribute("xmlns")) svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    return svg.outerHTML;
  }
  return regexSanitize(match[0]);
}

function walk(el: Element): boolean {
  const tag = el.tagName.toLowerCase().replace(/^svg:/, "");
  if (!ALLOWED.has(tag)) return false;
  for (const attr of [...el.attributes]) {
    const name = attr.name.toLowerCase();
    const value = attr.value.trim().toLowerCase();
    if (name.startsWith("on")) return false;
    if ((name === "href" || name.endsWith(":href")) && !attr.value.startsWith("#")) {
      el.removeAttribute(attr.name);
      continue;
    }
    if (value.includes("javascript:") || value.includes("data:")) return false;
  }
  for (const child of [...el.children]) {
    if (!walk(child)) child.remove();
  }
  return true;
}

function regexSanitize(svg: string): string {
  let out = svg
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript:/gi, "");
  out = out.replace(/\s(?:href|xlink:href)\s*=\s*("([^"]*)"|'([^']*)')/gi, (full, _q, a, b) => {
    const v = String(a ?? b ?? "");
    return v.startsWith("#") ? full : "";
  });
  if (/<script|foreignobject|javascript:/i.test(out)) return "";
  return out;
}

function escapeXml(text: string): string {
  return text.replace(/[&<>"]/g, (ch) => {
    if (ch === "&") return "&" + "amp;";
    if (ch === "<") return "&" + "lt;";
    if (ch === ">") return "&" + "gt;";
    return "&" + "quot;";
  });
}

/** Mapa mental simples a partir dos conceitos — sempre local, sem nova chamada. */
export function conceptMapSvg(concepts: Concept[]): string {
  const items = concepts.slice(0, 6).filter((c) => c.term.trim());
  if (!items.length) return "";
  const width = 640;
  const height = 220;
  const gap = width / items.length;
  const nodes = items
    .map((c, i) => {
      const x = gap * i + gap / 2;
      const y = i % 2 === 0 ? 78 : 148;
      const label = escapeXml(c.term.slice(0, 28));
      return `<g>
        <circle cx="${x}" cy="${y}" r="34" fill="#1a1f18" stroke="#e4a04a" stroke-width="1.5"/>
        <text x="${x}" y="${y + 4}" text-anchor="middle" fill="#f3efe4" font-size="11" font-family="Source Sans 3, sans-serif">${label}</text>
      </g>`;
    })
    .join("");
  const lines = items
    .slice(1)
    .map((_, i) => {
      const x1 = gap * i + gap / 2;
      const y1 = i % 2 === 0 ? 78 : 148;
      const x2 = gap * (i + 1) + gap / 2;
      const y2 = (i + 1) % 2 === 0 ? 78 : 148;
      return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#343c31" stroke-width="1.5"/>`;
    })
    .join("");
  return sanitizeSvg(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%">${lines}${nodes}</svg>`,
  );
}
