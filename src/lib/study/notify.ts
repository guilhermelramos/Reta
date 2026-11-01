import type { PlanDay, Settings, StudySession } from "./types.ts";
import type { BlockKind, SessionMode } from "./types.ts";
import { KIND_LABEL } from "./types.ts";
import { formatMin, saoPauloParts, topicLine } from "./time.ts";

export type NoticeTag = "start" | "questions" | "review" | "pending";

export type Notice = { title: string; body: string; tag: string };

function inWindow(nowMin: number, at: number): boolean {
  return nowMin >= at && nowMin < at + 20;
}

/**
 * Texto do aviso de um bloco do dia. É a única fonte dos títulos/corpos:
 * o lembrete dentro do app (`dueNotices`) e o agendamento nativo usam esta
 * mesma função, então os dois nunca divergem.
 */
export function noticeForTag(tag: NoticeTag, day: PlanDay): Notice | null {
  const first = day.blocks.find((b) => b.plannedMin > 0);
  if (!first) return null;
  switch (tag) {
    case "start":
      return {
        tag,
        title: "Hora de estudar",
        body: `Hoje: A – ${topicLine(first.content, 70)} · ${formatMin(first.plannedMin)}`,
      };
    case "questions":
      return {
        tag,
        title: "Hora das questões",
        body: `Resolva uma de cada vez: ${topicLine(first.content, 80)}`,
      };
    case "review": {
      const review = day.blocks.find((b) => b.kind === "R" && b.plannedMin > 0);
      if (!review) return null;
      return {
        tag,
        title: "Hora da revisão",
        body: `${KIND_LABEL.R}: ${topicLine(review.content, 80)} · ${formatMin(review.plannedMin)}`,
      };
    }
    case "pending":
      return {
        tag,
        title: "Bloco de hoje ainda não iniciado",
        body: `${KIND_LABEL[first.kind]} continua te esperando · ${formatMin(first.plannedMin)}`,
      };
  }
}

export function dueNotices(input: {
  settings: Settings;
  today: PlanDay | undefined;
  sessions: StudySession[];
  log: Record<string, string>;
  now?: Date;
}): Notice[] {
  const { settings, today, sessions, log } = input;
  if (settings.quiet || !today) return [];
  const parts = saoPauloParts(input.now ?? new Date());
  const nowMin = parts.hour * 60 + parts.minute;
  const start = settings.studyHour * 60 + settings.studyMinute;
  if (!today.blocks.some((b) => b.plannedMin > 0)) return [];
  const started = sessions.some((s) => s.date === parts.date && (s.running || s.elapsedSec > 0 || s.status === "done"));
  const reviewAt = start + (today.blocks.find((b) => b.kind === "A")?.plannedMin ?? 40);
  const when: Record<NoticeTag, boolean> = {
    start: settings.alerts.start && inWindow(nowMin, start),
    questions: settings.alerts.questions && inWindow(nowMin, start + 20),
    review: settings.alerts.review && inWindow(nowMin, reviewAt),
    pending: settings.alerts.pending && !started && inWindow(nowMin, start + 45),
  };
  const out: Notice[] = [];
  for (const tag of ["start", "questions", "review", "pending"] as const) {
    if (!when[tag] || log[tag] === parts.date) continue;
    const notice = noticeForTag(tag, today);
    if (notice) out.push(notice);
  }
  return out;
}

export function registerWorker(): void {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
}

export async function showNotice(notice: Notice): Promise<void> {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) {
      await reg.showNotification(notice.title, { body: notice.body, tag: notice.tag, icon: "/favicon.svg" });
      return;
    }
  } catch {
    /* segue para a API direta */
  }
  try {
    new Notification(notice.title, { body: notice.body, tag: notice.tag });
  } catch {
    /* permissão ou iframe sem Notification */
  }
}

/* ------------------------------------------------------------------ *
 * Fim do tempo de bloco / Revisão Relâmpago
 * ------------------------------------------------------------------ */

/** Vibração curta; aparelhos sem suporte (ou desktop) ficam em silêncio. */
export function vibrateDone(pattern: number | number[] = [200, 100, 200]): void {
  if (typeof navigator === "undefined") return;
  const api = navigator as Navigator & { vibrate?: (input: number | number[]) => boolean };
  try {
    api.vibrate?.(pattern);
  } catch {
    /* sem motor de vibração */
  }
}

export function blockDoneNotice(input: {
  kind: BlockKind;
  topic: string;
  minutes: number;
  mode?: SessionMode;
}): Notice {
  const quick = input.mode === "15";
  return {
    tag: `bloco-fim:${Date.now()}`,
    title: quick ? "Revisão Relâmpago concluída" : "Tempo do bloco cumprido",
    body: `${quick ? "Revisão Relâmpago" : KIND_LABEL[input.kind]} · ${formatMin(input.minutes)} — ${
      topicLine(input.topic, 70) || "bloco do dia"
    }. Feche o bloco e marque o que ficou.`,
  };
}

/** Feedback tátil + notificação local quando o tempo do bloco acaba. */
export async function notifyBlockDone(input: {
  kind: BlockKind;
  topic: string;
  minutes: number;
  mode?: SessionMode;
}): Promise<void> {
  vibrateDone([200, 100, 200]);
  await showNotice(blockDoneNotice(input));
}
