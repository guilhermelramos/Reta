export type FlowNode = { id: string; label: string };
export type FlowEdge = { from: string; to: string; label: string };

export type DiagramSpec =
  | { kind: "chain"; title: string; nodes: FlowNode[]; edges: FlowEdge[] }
  | { kind: "timeline"; title: string; events: FlowNode[] }
  | { kind: "compare"; title: string; leftTitle: string; rightTitle: string; rows: { left: string; right: string }[] }
  | { kind: "cycle"; title: string; nodes: FlowNode[]; edges: FlowEdge[] };

const FONT = "Source Sans 3, sans-serif";

function escapeXml(text: string): string {
  return text.replace(/[&<>"]/g, (ch) => {
    if (ch === "&") return "&" + "amp;";
    if (ch === "<") return "&" + "lt;";
    if (ch === ">") return "&" + "gt;";
    return "&" + "quot;";
  });
}

export function wrapLabel(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    const piece = word.length > maxChars ? word.slice(0, maxChars) : word;
    const next = cur ? `${cur} ${piece}` : piece;
    if (next.length > maxChars && cur) {
      lines.push(cur);
      cur = piece;
    } else {
      cur = next;
    }
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 3);
}

function textEl(lines: string[], x: number, yCenter: number, size: number, anchor: "middle" | "start" | "end"): string {
  const lineH = size + 3;
  const start = yCenter - ((lines.length - 1) * lineH) / 2;
  const spans = lines
    .map((line, i) => `<tspan x="${x.toFixed(1)}" y="${(start + i * lineH).toFixed(1)}">${escapeXml(line)}</tspan>`)
    .join("");
  return `<text text-anchor="${anchor}" font-size="${size}" font-family="${FONT}" fill="var(--color-fg)">${spans}</text>`;
}

function marker(id: string): string {
  return `<defs><marker id="${id}" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="var(--color-primary)"/></marker></defs>`;
}

function svgOpen(width: number, height: number, title: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(title)}"><title>${escapeXml(title)}</title>`;
}

function nodeGroup(id: string, x: number, y: number, w: number, h: number, lines: string[]): string {
  const cx = x + w / 2;
  const cy = y + h / 2;
  return `<g data-role="node" data-id="${escapeXml(id)}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="none" stroke="var(--color-border)" stroke-width="1.5"/>${textEl(lines, cx, cy, 12, "middle")}</g>`;
}

function edgeGroup(from: string, to: string, x1: number, y1: number, x2: number, y2: number, label: string, markerId: string): string {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2 - 11;
  return `<g data-role="edge" data-from="${escapeXml(from)}" data-to="${escapeXml(to)}"><line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="var(--color-primary)" stroke-width="1.5" marker-end="url(#${markerId})"/>${textEl(wrapLabel(label, 14), mx, my, 11, "middle")}</g>`;
}

function titleText(title: string, width: number): string {
  const lines = wrapLabel(title, Math.max(18, Math.floor((width - 32) / 8)));
  return textEl(lines, 16, 16, 13, "start");
}

export function renderChain(spec: Extract<DiagramSpec, { kind: "chain" }>, prefix: string): string {
  const nodes = spec.nodes.slice(0, 4);
  const nodeW = 148;
  const nodeH = 68;
  const gap = 112;
  const margin = 16;
  const top = 40;
  const width = margin * 2 + nodes.length * nodeW + Math.max(0, nodes.length - 1) * gap;
  const height = top + nodeH + 24;
  const mk = `mk${prefix}`;
  const parts = [svgOpen(width, height, spec.title), marker(mk), titleText(spec.title, width)];
  nodes.forEach((node, i) => {
    const x = margin + i * (nodeW + gap);
    parts.push(nodeGroup(node.id, x, top, nodeW, nodeH, wrapLabel(node.label, 16)));
  });
  for (const edge of spec.edges) {
    const a = nodes.findIndex((n) => n.id === edge.from);
    const b = nodes.findIndex((n) => n.id === edge.to);
    if (a < 0 || b < 0) continue;
    const forward = b === a + 1;
    if (!forward) continue;
    const x1 = margin + a * (nodeW + gap) + nodeW;
    const x2 = margin + b * (nodeW + gap);
    const y = top + nodeH / 2;
    parts.push(edgeGroup(edge.from, edge.to, x1, y, x2, y, edge.label, mk));
  }
  parts.push("</svg>");
  return parts.join("");
}

export function renderCycle(spec: Extract<DiagramSpec, { kind: "cycle" }>, prefix: string): string {
  const chain = renderChain({ kind: "chain", title: spec.title, nodes: spec.nodes, edges: spec.edges.filter((e, i, arr) => {
    const a = spec.nodes.findIndex((n) => n.id === e.from);
    const b = spec.nodes.findIndex((n) => n.id === e.to);
    return b === a + 1 || (i === arr.length - 1 && false);
  }) }, prefix);
  const nodeW = 148;
  const nodeH = 68;
  const gap = 112;
  const margin = 16;
  const top = 40;
  const nodes = spec.nodes.slice(0, 4);
  const width = margin * 2 + nodes.length * nodeW + Math.max(0, nodes.length - 1) * gap;
  const y = top + nodeH + 32;
  const height = y + 22;
  const mk = `mk${prefix}`;
  const first = nodes[0];
  const last = nodes[nodes.length - 1];
  if (!first || !last || nodes.length < 2) return chain;
  const x1 = margin + (nodes.length - 1) * (nodeW + gap) + nodeW / 2;
  const x2 = margin + nodeW / 2;
  const back = spec.edges.find((edge) => edge.from === last.id && edge.to === first.id);
  const label = back?.label || "fecha o ciclo";
  const body = chain.replace(/viewBox="0 0 [\d.]+ [\d.]+"/, `viewBox="0 0 ${width} ${height}"`).replace("</svg>", "");
  return `${body}${edgeGroup(last.id, first.id, x1, y, x2, y, label, mk)}</svg>`;
}

export function renderTimeline(spec: Extract<DiagramSpec, { kind: "timeline" }>, prefix: string): string {
  const events = spec.events.slice(0, 8);
  const slot = 108;
  const margin = 20;
  const width = margin * 2 + events.length * slot;
  const height = 176;
  const axis = 92;
  const mk = `mk${prefix}`;
  const parts = [svgOpen(width, height, spec.title), marker(mk), titleText(spec.title, width)];
  parts.push(`<line x1="${margin}" y1="${axis}" x2="${width - margin}" y2="${axis}" stroke="var(--color-border)" stroke-width="1.5"/>`);
  events.forEach((event, i) => {
    const x = margin + slot * i + slot / 2;
    parts.push(
      `<g data-role="node" data-id="${escapeXml(event.id)}"><circle cx="${x}" cy="${axis}" r="5" fill="var(--color-primary)"/>${textEl(wrapLabel(event.label, 13), x, 64, 11, "middle")}</g>`,
    );
    if (i > 0) {
      const prev = events[i - 1];
      if (!prev) return;
      const x1 = margin + slot * (i - 1) + slot / 2 + 8;
      const x2 = x - 8;
      parts.push(
        `<g data-role="edge" data-from="${escapeXml(prev.id)}" data-to="${escapeXml(event.id)}"><line x1="${x1}" y1="${axis}" x2="${x2}" y2="${axis}" stroke="var(--color-primary)" stroke-width="1.5" marker-end="url(#${mk})"/>${textEl(["depois"], (x1 + x2) / 2, axis + 22, 10, "middle")}</g>`,
      );
    }
  });
  parts.push("</svg>");
  return parts.join("");
}

export function renderCompare(spec: Extract<DiagramSpec, { kind: "compare" }>, _prefix: string): string {
  const colW = 248;
  const gap = 20;
  const margin = 16;
  const rows = spec.rows.slice(0, 5).map((row) => ({
    left: wrapLabel(row.left, 26),
    right: wrapLabel(row.right, 26),
  }));
  const rowH = rows.map((row) => Math.max(row.left.length, row.right.length, 1) * 16 + 20);
  const head = 36;
  const width = margin * 2 + colW * 2 + gap;
  const height = 36 + head + rowH.reduce((sum, h) => sum + h, 0) + 8;
  const parts = [svgOpen(width, height, spec.title), titleText(spec.title, width)];
  const headY = 40;
  parts.push(nodeGroup("head-l", margin, headY, colW, 32, wrapLabel(spec.leftTitle, 24)));
  parts.push(nodeGroup("head-r", margin + colW + gap, headY, colW, 32, wrapLabel(spec.rightTitle, 24)));
  let y = headY + 32;
  rows.forEach((row, i) => {
    const h = rowH[i] ?? 44;
    parts.push(nodeGroup(`l${i}`, margin, y, colW, h, row.left));
    parts.push(nodeGroup(`r${i}`, margin + colW + gap, y, colW, h, row.right));
    y += h;
  });
  parts.push("</svg>");
  return parts.join("");
}

export function renderMap(title: string, nodes: FlowNode[], edges: FlowEdge[], prefix: string): string {
  return renderChain({ kind: "chain", title, nodes, edges }, prefix);
}

export function simplestChain(a: string, b: string, label: string, prefix: string): string {
  return renderChain(
    {
      kind: "chain",
      title: "Relação",
      nodes: [
        { id: "a", label: a },
        { id: "b", label: b },
      ],
      edges: [{ from: "a", to: "b", label }],
    },
    prefix,
  );
}

function tagAttrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const match of tag.matchAll(/([\w:-]+)="([^"]*)"/g)) {
    const key = match[1];
    const value = match[2];
    if (key && value != null) out[key] = value;
  }
  return out;
}

/** Valida o SVG do gabarito: texto dentro do viewBox, nó com rótulo, seta com pontas. */
export function validateDiagram(svg: string): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const box = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
  const width = Number(box?.[1] ?? 0);
  const height = Number(box?.[2] ?? 0);
  if (!svg.includes("<svg") || !(width > 0) || !(height > 0)) reasons.push("svg sem viewBox");
  if (/<rect\b[^>]*fill="(?:#fff(?:fff)?|white|#f[0-9a-f]{5}|#eee|#ddd|#ccc)"/i.test(svg)) reasons.push("fundo claro");

  const nodeIds = new Set<string>();
  for (const match of svg.matchAll(/<g\b([^>]*\bdata-role="node"[^>]*)>([\s\S]*?)<\/g>/g)) {
    const attrs = tagAttrs(match[1] ?? "");
    const id = attrs["data-id"] ?? "";
    const text = (match[2] ?? "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    if (!id || !text) reasons.push(`nó sem rótulo${id ? `: ${id}` : ""}`);
    else nodeIds.add(id);
  }
  if (!nodeIds.size) reasons.push("nenhum nó");

  let edgeTags = 0;
  for (const match of svg.matchAll(/<g\b([^>]*\bdata-role="edge"[^>]*)>/g)) {
    edgeTags += 1;
    const attrs = tagAttrs(match[1] ?? "");
    const from = attrs["data-from"] ?? "";
    const to = attrs["data-to"] ?? "";
    if (!from || !to || !nodeIds.has(from) || !nodeIds.has(to)) reasons.push("seta solta");
  }
  if ((svg.match(/data-role="edge"/g) ?? []).length !== edgeTags) reasons.push("seta mal formada");

  for (const match of svg.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)) {
    const attrs = tagAttrs(match[1] ?? "");
    const size = Number(attrs["font-size"] ?? 12);
    const anchor = attrs["text-anchor"] ?? "start";
    const inner = match[2] ?? "";
    const tspans = [...inner.matchAll(/<tspan\b([^>]*)>([\s\S]*?)<\/tspan>/g)];
    const chunks = tspans.length
      ? tspans.map((t) => ({ attrs: tagAttrs(t[1] ?? ""), text: (t[2] ?? "").replace(/<[^>]+>/g, "") }))
      : [{ attrs, text: inner.replace(/<[^>]+>/g, "") }];
    for (const chunk of chunks) {
      const x = Number(chunk.attrs.x ?? attrs.x);
      const y = Number(chunk.attrs.y ?? attrs.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        reasons.push("texto sem posição");
        continue;
      }
      const tw = [...chunk.text].length * size * 0.62;
      let left = x;
      let right = x + tw;
      if (anchor === "middle") {
        left = x - tw / 2;
        right = x + tw / 2;
      } else if (anchor === "end") {
        left = x - tw;
        right = x;
      }
      if (left < 0 || right > width + 0.5 || y - size < -1 || y > height - 1) {
        reasons.push(`texto fora: ${chunk.text.slice(0, 32)}`);
      }
    }
  }

  for (const match of svg.matchAll(/<line\b([^>]*)\/?>/g)) {
    const attrs = tagAttrs(match[1] ?? "");
    const nums = ["x1", "y1", "x2", "y2"].map((key) => Number(attrs[key]));
    if (nums.some((n) => !Number.isFinite(n))) reasons.push("linha incompleta");
    else if (nums[0]! < -1 || nums[2]! > width + 1 || nums[1]! < -1 || nums[3]! > height + 1 || nums[2]! < -1 || nums[1]! > height + 1) {
      reasons.push("linha fora");
    }
  }

  return { ok: reasons.length === 0, reasons };
}

export function renderChecked(svg: string, fallback: string): string {
  const first = validateDiagram(svg);
  if (first.ok) return svg;
  const second = validateDiagram(fallback);
  return second.ok ? fallback : "";
}
