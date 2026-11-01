import { noticeForTag } from "./notify.ts";
import type { NoticeTag } from "./notify.ts";
import { addDays, daysBetween, saoPauloParts } from "./time.ts";
import type { PlanDay, Settings, StudySession } from "./types.ts";

/**
 * Agendamento dos lembretes do plano no aparelho.
 *
 * A lógica daqui é pura (sem Capacitor, sem DOM): recebe o mesmo retrato que o
 * `dueNotices` usa e devolve os avisos com data/hora absoluta para os próximos
 * dias. O serviço nativo só entrega essa lista ao plugin.
 */

export type ReminderChannel = "estudo" | "questoes" | "timer";

export type ScheduledReminder = {
  /** Identificador estável de plano + dia, usado para deduplicar. */
  key: string;
  /** Id numérico (32 bits) exigido pelo plugin de notificações. */
  id: number;
  /** Dia do plano (`YYYY-MM-DD`, fuso de São Paulo). */
  date: string;
  tag: NoticeTag;
  at: Date;
  title: string;
  body: string;
  channelId: ReminderChannel;
};

/** Quantos dias à frente reagendar. Sete cobre a semana do plano com folga. */
export const REMINDER_HORIZON_DAYS = 7;

export const REMINDER_CHANNEL: Record<NoticeTag, ReminderChannel> = {
  start: "estudo",
  review: "estudo",
  pending: "estudo",
  questions: "questoes",
};

const TZ = "America/Sao_Paulo";
const ID_EPOCH = "2024-01-01";
const TAG_SLOT: Record<NoticeTag, number> = { start: 0, questions: 1, review: 2, pending: 3 };

/** Fuso (ms) do horário de São Paulo num instante UTC. */
function zoneOffsetMs(instantMs: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(instantMs));
  const value = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  let hour = value("hour");
  if (hour === 24) hour = 0;
  const asUtc = Date.UTC(
    value("year"),
    value("month") - 1,
    value("day"),
    hour,
    value("minute"),
    value("second"),
  );
  return asUtc - Math.floor(instantMs / 1000) * 1000;
}

/**
 * Converte um horário de parede de São Paulo (`dateKey` + hora/minuto) para o
 * instante absoluto correspondente. Horas fora de 0–23 rolam para o dia
 * seguinte, como o `Date.UTC` faz.
 */
export function saoPauloDateTime(dateKey: string, hour: number, minute: number): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  const first = zoneOffsetMs(wall);
  let instant = wall - first;
  const second = zoneOffsetMs(instant);
  if (second !== first) instant = wall - second;
  return new Date(instant);
}

/**
 * Id determinístico no intervalo aceito pelo Android. Reservamos a faixa
 * 1.000.000+ para os lembretes do plano, sem colidir com notificações de
 * outros fluxos do app (timer, por exemplo).
 */
export function reminderNotificationId(dateKey: string, tag: NoticeTag): number {
  const day = daysBetween(ID_EPOCH, dateKey);
  const slot = ((day % 1000) + 1000) % 1000;
  return 1_000_000 + slot * 10 + TAG_SLOT[tag];
}

export function buildReminderSchedule(input: {
  settings: Settings;
  days: PlanDay[];
  sessions: StudySession[];
  log?: Record<string, string>;
  now?: Date;
  horizonDays?: number;
}): ScheduledReminder[] {
  const { settings, days, sessions } = input;
  if (settings.quiet) return [];
  const now = input.now ?? new Date();
  const today = saoPauloParts(now).date;
  const horizon = Math.max(0, Math.floor(input.horizonDays ?? REMINDER_HORIZON_DAYS));
  const byDate = new Map(days.map((day) => [day.date, day]));
  const start = settings.studyHour * 60 + settings.studyMinute;
  const out: ScheduledReminder[] = [];

  for (let offset = 0; offset < horizon; offset += 1) {
    const date = addDays(today, offset);
    const day = byDate.get(date);
    if (!day) continue;
    if (!day.blocks.some((block) => block.plannedMin > 0)) continue;
    const startedToday =
      offset === 0 &&
      sessions.some(
        (session) =>
          session.date === date &&
          (session.running || session.elapsedSec > 0 || session.status === "done"),
      );
    const reviewAt = start + (day.blocks.find((block) => block.kind === "A")?.plannedMin ?? 40);
    const candidates: { tag: NoticeTag; at: number; enabled: boolean }[] = [
      { tag: "start", at: start, enabled: settings.alerts.start },
      { tag: "questions", at: start + 20, enabled: settings.alerts.questions },
      { tag: "review", at: reviewAt, enabled: settings.alerts.review },
      { tag: "pending", at: start + 45, enabled: settings.alerts.pending && !startedToday },
    ];

    for (const candidate of candidates) {
      if (!candidate.enabled) continue;
      if (input.log?.[candidate.tag] === date) continue;
      const notice = noticeForTag(candidate.tag, day);
      if (!notice) continue;
      const at = saoPauloDateTime(date, Math.floor(candidate.at / 60), candidate.at % 60);
      // Aviso que já passou não é reagendado: o tick do app mostra na janela
      // atual e o dia seguinte entra normalmente.
      if (at.getTime() <= now.getTime()) continue;
      out.push({
        key: `${date}:${candidate.tag}`,
        id: reminderNotificationId(date, candidate.tag),
        date,
        tag: candidate.tag,
        at,
        title: notice.title,
        body: notice.body,
        channelId: REMINDER_CHANNEL[candidate.tag],
      });
    }
  }

  return out.sort((a, b) => a.at.getTime() - b.at.getTime() || a.id - b.id);
}
