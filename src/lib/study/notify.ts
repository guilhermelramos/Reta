import type { PlanDay, Settings, StudySession } from "@/lib/study/types";
import { KIND_LABEL } from "@/lib/study/types";
import { formatMin, saoPauloParts, topicLine } from "@/lib/study/time";

export type Notice = { title: string; body: string; tag: string };

function inWindow(nowMin: number, at: number): boolean {
  return nowMin >= at && nowMin < at + 20;
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
  const studyBlocks = today.blocks.filter((b) => b.plannedMin > 0);
  const first = studyBlocks[0];
  if (!first) return [];
  const started = sessions.some((s) => s.date === parts.date && (s.running || s.elapsedSec > 0 || s.status === "done"));
  const out: Notice[] = [];
  const push = (tag: string, title: string, body: string, when: boolean) => {
    if (!when || log[tag] === parts.date) return;
    out.push({ tag, title, body });
  };
  push(
    "start",
    "Hora de estudar",
    `Hoje: A – ${topicLine(first.content, 70)} · ${formatMin(first.plannedMin)}`,
    settings.alerts.start && inWindow(nowMin, start),
  );
  push(
    "questions",
    "Hora das questões",
    `Resolva uma de cada vez: ${topicLine(first.content, 80)}`,
    settings.alerts.questions && inWindow(nowMin, start + 20),
  );
  const review = today.blocks.find((b) => b.kind === "R" && b.plannedMin > 0);
  const reviewAt = start + (today.blocks.find((b) => b.kind === "A")?.plannedMin ?? 40);
  push(
    "review",
    "Hora da revisão",
    review ? `${KIND_LABEL.R}: ${topicLine(review.content, 80)} · ${formatMin(review.plannedMin)}` : "Revisão do dia",
    settings.alerts.review && Boolean(review) && inWindow(nowMin, reviewAt),
  );
  push(
    "pending",
    "Bloco de hoje ainda não iniciado",
    `${KIND_LABEL[first.kind]} continua te esperando · ${formatMin(first.plannedMin)}`,
    settings.alerts.pending && !started && inWindow(nowMin, start + 45),
  );
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
