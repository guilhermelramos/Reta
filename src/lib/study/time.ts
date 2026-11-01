import type { BlockKind, PlanBlock, PlanDay } from "./types.ts";

const TZ = "America/Sao_Paulo";

export function saoPauloToday(now = new Date()): string {
  return saoPauloParts(now).date;
}

export function saoPauloParts(now = new Date()): {
  date: string;
  hour: number;
  minute: number;
} {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  let hour = Number(get("hour"));
  if (hour === 24) hour = 0;
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    hour,
    minute: Number(get("minute")),
  };
}

export function formatLongDate(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  if (!y || !m || !d) return dateKey;
  const dt = new Date(Date.UTC(y, m - 1, d, 15));
  const text = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: TZ,
  }).format(dt);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function formatShortDate(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  if (!y || !m || !d) return dateKey;
  const dt = new Date(Date.UTC(y, m - 1, d, 15));
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    timeZone: TZ,
  }).format(dt);
}

export function formatWeekday(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  if (!y || !m || !d) return "";
  const dt = new Date(Date.UTC(y, m - 1, d, 15));
  const text = new Intl.DateTimeFormat("pt-BR", { weekday: "short", timeZone: TZ }).format(dt);
  return text.replace(".", "");
}

export function addDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function daysBetween(fromKey: string, toKey: string): number {
  const [fy, fm, fd] = fromKey.split("-").map(Number);
  const [ty, tm, td] = toKey.split("-").map(Number);
  const a = Date.UTC(fy, fm - 1, fd);
  const b = Date.UTC(ty, tm - 1, td);
  return Math.round((b - a) / 86400000);
}

export function formatMin(min: number): string {
  const rounded = Math.max(0, Math.round(min));
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  if (h && m) return `${h}h${String(m).padStart(2, "0")}`;
  if (h) return `${h}h`;
  return `${m} min`;
}

export function formatClock(totalSec: number): string {
  const sec = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  if (h > 0) return `${h}:${mm}:${ss}`;
  return `${mm}:${ss}`;
}

/** "40min", "1h30", "90", "01:30" → minutos. null se ilegível. */
export function parseDuration(raw: string): number | null {
  const text = raw.trim().toLowerCase().replace(/\s+/g, "");
  if (!text) return null;
  if (/^\d+([.,]\d+)?$/.test(text)) {
    const n = Number(text.replace(",", "."));
    if (!Number.isFinite(n) || n < 0 || n > 24 * 60) return null;
    return Math.round(n);
  }
  const clock = text.match(/^(\d{1,2}):(\d{2})$/);
  if (clock) {
    const h = Number(clock[1]);
    const m = Number(clock[2]);
    if (m > 59) return null;
    return h * 60 + m;
  }
  const hm = text.match(/^(\d+)h(\d{1,2})(?:min)?$/);
  if (hm) return Number(hm[1]) * 60 + Number(hm[2]);
  const hOnly = text.match(/^(\d+)h$/);
  if (hOnly) return Number(hOnly[1]) * 60;
  const mins = text.match(/^(\d+)(?:min|m)$/);
  if (mins) return Number(mins[1]);
  return null;
}

export function utcKeyFromDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseDateKey(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const y = Number(iso[1]);
    const m = Number(iso[2]);
    const d = Number(iso[3]);
    if (m < 1 || m > 12 || d < 1 || d > 31) return null;
    return `${iso[1]}-${iso[2]}-${iso[3]}`;
  }
  const br = text.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})/);
  if (br) {
    const d = Number(br[1]);
    const m = Number(br[2]);
    let y = Number(br[3]);
    if (y < 100) y += 2000;
    if (m < 1 || m > 12 || d < 1 || d > 31) return null;
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  const serial = Number(text);
  if (Number.isFinite(serial) && serial > 20000 && serial < 80000) {
    const ms = Date.UTC(1899, 11, 30) + Math.round(serial) * 86400000;
    return utcKeyFromDate(new Date(ms));
  }
  return null;
}

export function topicLine(content: string, max = 88): string {
  const clean = content.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trimEnd()}…`;
}

export function sheetMinutes(day: PlanDay | undefined, kind: BlockKind): number {
  return day?.blocks.find((b) => b.kind === kind)?.plannedMin ?? 0;
}

export function blockOf(day: PlanDay | undefined, kind: BlockKind): PlanBlock | undefined {
  return day?.blocks.find((b) => b.kind === kind);
}

export function dayLoad(day: PlanDay): number {
  return day.blocks.reduce((sum, b) => sum + b.plannedMin, 0);
}

export function examDate(days: PlanDay[]): string | null {
  const marked = days.find((d) => /prova/i.test(d.phase) && !/simulado/i.test(d.phase));
  if (marked) return marked.date;
  return days.length ? days[days.length - 1].date : null;
}
