import { Capacitor } from "@capacitor/core";
import type { PermissionState } from "@capacitor/core";
import { isIgnoringBatteryOptimizations } from "@/lib/native/battery";
import { alarmSchedulePlan } from "@/lib/study/exact-alarm";
import { buildReminderSchedule } from "@/lib/study/notification-schedule";
import type { ScheduledReminder } from "@/lib/study/notification-schedule";
import { formatClock } from "@/lib/study/time";
import type { PlanDay, Settings, StudySession } from "@/lib/study/types";

/**
 * Serviço de notificações locais do app nativo.
 *
 * No APK não existe servidor nem service worker: os lembretes são agendados no
 * próprio Android com `@capacitor/local-notifications`. Na web o módulo é
 * inerte (`native: false`), então o comportamento atual (Notification API +
 * service worker) continua sendo o único caminho.
 */

export type NotificationPermission = "granted" | "denied" | "prompt" | "unsupported";
export type ExactAlarmPermission = "granted" | "denied" | "unsupported";

export type NativeNotificationStatus = {
  native: boolean;
  permission: NotificationPermission;
  exactAlarms: ExactAlarmPermission;
  /** `null` quando não é Android ou a consulta falhou. */
  batteryOptimizationsIgnored: boolean | null;
  error?: string;
};

export type ReminderSnapshot = {
  settings: Settings;
  days: PlanDay[];
  sessions: StudySession[];
  log?: Record<string, string>;
  now?: Date;
};

export type NativeSyncResult = NativeNotificationStatus & {
  scheduled: number;
  cancelled: number;
  /** O Android negou alarmes exatos e os avisos foram agendados sem exatidão. */
  inexactFallback: boolean;
};

type LocalNotificationsModule = typeof import("@capacitor/local-notifications");
type LocalNotificationsApi = LocalNotificationsModule["LocalNotifications"];

export const REMINDER_CHANNELS = [
  {
    id: "estudo",
    name: "Estudo",
    description: "Início do bloco, revisão e bloco não iniciado",
    importance: 4,
    vibration: true,
  },
  {
    id: "questoes",
    name: "Questões",
    description: "Hora de resolver as questões do bloco",
    importance: 4,
    vibration: true,
  },
  {
    id: "timer",
    name: "Timer",
    description: "Fim do tempo do bloco",
    importance: 5,
    vibration: true,
  },
] as const;

/**
 * Canal próprio da notificação persistente do timer. Importância baixa e sem
 * vibração: ela fica parada na gaveta e é atualizada ao pausar/retomar, sem
 * tocar a cada mudança. O aviso de fim continua no canal `timer`.
 */
export const TIMER_ONGOING_CHANNEL = {
  id: "timer-progresso",
  name: "Timer em andamento",
  description: "Bloco e horário de término enquanto o timer roda",
  importance: 2,
  vibration: false,
} as const;

/**
 * Faixa 2.000.000+ reservada para o timer. Os lembretes do plano usam
 * 1.000.000+ (ver `notification-schedule.ts`), então não há colisão.
 */
export const TIMER_ALARM_ID = 2_000_001;
export const TIMER_ONGOING_ID = 2_000_002;
export const TIMER_ALARM_TITLE = "Tempo do bloco acabou";

export function isNativeNotificationService(): boolean {
  return Capacitor.isNativePlatform();
}

function isAndroid(): boolean {
  return Capacitor.getPlatform() === "android";
}

function permissionFrom(value: PermissionState | undefined): NotificationPermission {
  if (value === "granted" || value === "denied") return value;
  return value ? "prompt" : "unsupported";
}

function exactFrom(value: PermissionState | undefined): ExactAlarmPermission {
  if (value === "granted" || value === "denied") return value;
  return "unsupported";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function loadPlugin(): Promise<LocalNotificationsApi> {
  const { LocalNotifications } = await import("@capacitor/local-notifications");
  return LocalNotifications;
}

/** Cria (ou atualiza) os canais Android. Silencioso em versões sem canais. */
async function ensureChannels(plugin: LocalNotificationsApi): Promise<void> {
  if (!isAndroid()) return;
  for (const channel of [...REMINDER_CHANNELS, TIMER_ONGOING_CHANNEL]) {
    try {
      await plugin.createChannel({ ...channel });
    } catch {
      // Android < 8 não usa canais; o agendamento segue no canal padrão.
    }
  }
}

async function checkExactAlarms(plugin: LocalNotificationsApi): Promise<ExactAlarmPermission> {
  if (!isAndroid()) return "unsupported";
  try {
    const status = await plugin.checkExactNotificationSetting();
    return exactFrom(status.exact_alarm);
  } catch {
    return "unsupported";
  }
}

export async function getNativeNotificationStatus(): Promise<NativeNotificationStatus> {
  const base: NativeNotificationStatus = {
    native: isNativeNotificationService(),
    permission: "unsupported",
    exactAlarms: "unsupported",
    batteryOptimizationsIgnored: null,
  };
  if (!base.native) return base;
  try {
    const plugin = await loadPlugin();
    const status = await plugin.checkPermissions();
    const exactAlarms = await checkExactAlarms(plugin);
    const batteryOptimizationsIgnored = await isIgnoringBatteryOptimizations();
    return {
      ...base,
      permission: permissionFrom(status.display),
      exactAlarms,
      batteryOptimizationsIgnored,
    };
  } catch (error) {
    return { ...base, error: errorMessage(error) };
  }
}

/**
 * Pede POST_NOTIFICATIONS (Android 13+) e, quando o usuário autorizou,
 * garante os canais. Com `askExact`, abre a tela "Alarmes e lembretes" do
 * Android se o alarme exato estiver negado — só deve ser chamado a partir de
 * um toque explícito (botão dos Ajustes).
 */
export async function requestNativeNotifications(options?: {
  askExact?: boolean;
}): Promise<NativeNotificationStatus> {
  const base: NativeNotificationStatus = {
    native: isNativeNotificationService(),
    permission: "unsupported",
    exactAlarms: "unsupported",
    batteryOptimizationsIgnored: null,
  };
  if (!base.native) return base;
  try {
    const plugin = await loadPlugin();
    let status = await plugin.checkPermissions();
    if (status.display !== "granted") {
      status = await plugin.requestPermissions();
    }
    const permission = permissionFrom(status.display);
    if (permission === "granted") await ensureChannels(plugin);

    let exactAlarms: ExactAlarmPermission = "unsupported";
    if (permission === "granted") {
      exactAlarms = await checkExactAlarms(plugin);
      if (exactAlarms === "denied" && options?.askExact && isAndroid()) {
        try {
          const changed = await plugin.changeExactNotificationSetting();
          exactAlarms = exactFrom(changed.exact_alarm);
        } catch {
          // O usuário pode ter saído da tela sem alterar; segue o fallback.
        }
      }
    }

    return {
      ...base,
      permission,
      exactAlarms,
      batteryOptimizationsIgnored: await isIgnoringBatteryOptimizations(),
    };
  } catch (error) {
    return { ...base, permission: "denied", error: errorMessage(error) };
  }
}

function isReminder(extra: unknown): boolean {
  if (!extra || typeof extra !== "object") return false;
  return (extra as { reta?: unknown }).reta === "reminder";
}

async function cancelReminders(plugin: LocalNotificationsApi): Promise<number> {
  try {
    const pending = await plugin.getPending();
    const ours = pending.notifications.filter((notification) => isReminder(notification.extra));
    if (!ours.length) return 0;
    await plugin.cancel({ notifications: ours.map((notification) => ({ id: notification.id })) });
    return ours.length;
  } catch {
    return 0;
  }
}

function schedulePayload(
  reminder: ScheduledReminder,
  exactAlarms: ExactAlarmPermission,
): Parameters<LocalNotificationsApi["schedule"]>[0]["notifications"][number] {
  const alarm = alarmSchedulePlan(exactAlarms);
  return {
    id: reminder.id,
    title: reminder.title,
    body: reminder.body,
    channelId: reminder.channelId,
    autoCancel: true,
    // Só pede alarme exato quando o Android autorizou. Negado (Android 12+/14+
    // com SCHEDULE_EXACT_ALARM revogado), o plugin agenda como inexato e não
    // abre a tela de configurações sozinho.
    isExactNotification: alarm.isExactNotification,
    extra: {
      reta: "reminder",
      key: reminder.key,
      date: reminder.date,
      tag: reminder.tag,
    },
    schedule: {
      at: reminder.at,
      allowWhileIdle: alarm.allowWhileIdle,
    },
  };
}

type NotificationPayload = Parameters<LocalNotificationsApi["schedule"]>[0]["notifications"][number];

/**
 * Agenda e, se um alarme exato falhar por corrida de permissão (o usuário
 * revogou entre o `check` e o `schedule`), refaz a mesma chamada como inexata.
 * Assim uma `SecurityException` nunca sobe e derruba o timer.
 */
async function scheduleWithFallback(
  plugin: LocalNotificationsApi,
  notifications: NotificationPayload[],
): Promise<{ result: Awaited<ReturnType<LocalNotificationsApi["schedule"]>>; fellBack: boolean }> {
  try {
    return { result: await plugin.schedule({ notifications }), fellBack: false };
  } catch (error) {
    if (!notifications.some((notification) => notification.isExactNotification)) throw error;
    const result = await plugin.schedule({
      notifications: notifications.map((notification) => ({
        ...notification,
        isExactNotification: false,
      })),
    });
    console.warn(
      `[notificações] alarme exato falhou; reagendado como inexato: ${errorMessage(error)}`,
    );
    return { result, fellBack: true };
  }
}

async function runSync(snapshot: ReminderSnapshot): Promise<NativeSyncResult> {
  const base: NativeSyncResult = {
    native: true,
    permission: "unsupported",
    exactAlarms: "unsupported",
    batteryOptimizationsIgnored: null,
    scheduled: 0,
    cancelled: 0,
    inexactFallback: false,
  };
  const reminders = buildReminderSchedule(snapshot);
  try {
    const plugin = await loadPlugin();
    const status = await plugin.checkPermissions();
    const permission = permissionFrom(status.display);
    const exactAlarms = await checkExactAlarms(plugin);

    // Modo silencioso, plano vazio ou permissão revogada: não deixa lembrete
    // antigo para trás.
    if (!reminders.length || permission !== "granted") {
      const cancelled = await cancelReminders(plugin);
      return {
        ...base,
        permission,
        exactAlarms,
        cancelled,
        inexactFallback: exactAlarms === "denied",
      };
    }

    await ensureChannels(plugin);
    const cancelled = await cancelReminders(plugin);
    const queued = reminders.map((reminder) => schedulePayload(reminder, exactAlarms));
    const { result, fellBack } = await scheduleWithFallback(plugin, queued);

    return {
      ...base,
      permission,
      exactAlarms,
      batteryOptimizationsIgnored: await isIgnoringBatteryOptimizations(),
      scheduled: result.notifications.length,
      cancelled,
      inexactFallback: exactAlarms === "denied" || fellBack,
    };
  } catch (error) {
    return { ...base, error: errorMessage(error), inexactFallback: false };
  }
}

let queuedSnapshot: ReminderSnapshot | null = null;
let runningSync: Promise<NativeSyncResult> | null = null;

/**
 * Reagenda a janela de lembretes (7 dias) a partir do retrato atual.
 *
 * Chamadas concorrentes são coalescidas: sempre vale o último retrato, o que
 * evita corrida entre abrir o app, salvar ajustes e trocar de plano.
 */
export function syncNativeNotifications(snapshot: ReminderSnapshot): Promise<NativeSyncResult> {
  const empty: NativeSyncResult = {
    native: isNativeNotificationService(),
    permission: "unsupported",
    exactAlarms: "unsupported",
    batteryOptimizationsIgnored: null,
    scheduled: 0,
    cancelled: 0,
    inexactFallback: false,
  };
  if (!empty.native) return Promise.resolve(empty);

  queuedSnapshot = snapshot;
  if (runningSync) return runningSync;

  runningSync = (async () => {
    let last = empty;
    try {
      while (queuedSnapshot) {
        const next = queuedSnapshot;
        queuedSnapshot = null;
        last = await runSync(next);
      }
    } finally {
      runningSync = null;
    }
    return last;
  })();

  return runningSync;
}

/** Cancela apenas os lembretes do plano (não toca no timer nem em outros). */
export async function cancelNativeNotificationReminders(): Promise<number> {
  if (!isNativeNotificationService()) return 0;
  try {
    return await cancelReminders(await loadPlugin());
  } catch {
    return 0;
  }
}

/* ------------------------------------------------------------------ *
 * Timer da sessão (alarme de término + notificação persistente)
 *
 * O plugin oficial já expõe `ongoing`/`autoCancel` (documentados desde a
 * versão 1.0), então não é preciso um foreground service em Kotlin: uma
 * notificação normal com `setOngoing(true)` mostra o bloco e o horário de
 * término sem pedir FOREGROUND_SERVICE/SPECIAL_USE no Android 14.
 * ------------------------------------------------------------------ */

export type TimerNotificationInput = {
  sessionId: string;
  /** Rótulo do bloco, ex.: "Bloco A · Biomas". */
  label: string;
  /** Sessão ainda aberta; `false` remove alarme e notificação persistente. */
  active: boolean;
  running: boolean;
  /** Fim previsto (epoch ms); `null` quando pausado. */
  endsAt: number | null;
  remainingMs: number;
  expired: boolean;
  now?: number;
};

export type TimerNotificationResult = {
  native: boolean;
  permission: NotificationPermission;
  alarmScheduled: boolean;
  ongoingShown: boolean;
  /** Android negou alarme exato: o fim foi agendado como inexato. */
  inexactFallback: boolean;
  error?: string;
};

function timerClock(at: number): string {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(at));
}

function remainingClock(ms: number): string {
  return formatClock(Math.ceil(Math.max(0, ms) / 1000));
}

function ongoingCopy(input: TimerNotificationInput): { title: string; body: string } {
  if (!input.running) {
    return {
      title: `${input.label} · ${remainingClock(input.remainingMs)} restantes`,
      body: input.expired
        ? "Tempo cumprido. Encerre ou retome quando quiser."
        : "Pausado · retome no app",
    };
  }
  if (input.expired) {
    return {
      title: `${input.label} · tempo cumprido`,
      body: "Encerre o bloco quando quiser.",
    };
  }
  if (input.endsAt != null) {
    return {
      title: `${input.label} · ${remainingClock(input.remainingMs)} restantes`,
      body: `Termina às ${timerClock(input.endsAt)}`,
    };
  }
  return {
    title: `${input.label} · ${remainingClock(input.remainingMs)} restantes`,
    body: "Estudando",
  };
}

async function removeTimerAlarm(plugin: LocalNotificationsApi): Promise<void> {
  try {
    await plugin.cancel({ notifications: [{ id: TIMER_ALARM_ID }] });
  } catch {
    // sem alarme pendente
  }
  try {
    // Se o alarme já disparou, some também da gaveta ao encerrar/pausar.
    await plugin.removeDeliveredNotificationsById({ ids: [TIMER_ALARM_ID] });
  } catch {
    // notificação não estava visível
  }
}

async function removeTimerOngoing(plugin: LocalNotificationsApi): Promise<void> {
  try {
    // `cancel` remove o alarme; a persistente é imediata (sem `schedule`),
    // então precisa ser retirada da gaveta pelo id.
    await plugin.cancel({ notifications: [{ id: TIMER_ONGOING_ID }] });
  } catch {
    // sem alarme pendente
  }
  try {
    await plugin.removeDeliveredNotificationsById({ ids: [TIMER_ONGOING_ID] });
  } catch {
    // notificação não estava visível
  }
}

/** Cancela alarme de término e remove a notificação persistente do timer. */
async function cancelTimerNow(): Promise<void> {
  if (!isNativeNotificationService()) return;
  try {
    const plugin = await loadPlugin();
    await Promise.all([removeTimerAlarm(plugin), removeTimerOngoing(plugin)]);
  } catch {
    // plugin indisponível: a web segue com o comportamento antigo
  }
}

/**
 * Alinha o Android ao estado do cronômetro:
 *
 * - sessão fechada/pausada: cancela o alarme; pausada mantém a persistente
 *   informando o tempo restante;
 * - correndo: agenda (ou reagenda) o alarme para `endsAt` no canal `timer`
 *   com `allowWhileIdle`, e atualiza a persistente com bloco + término.
 *
 * `isExactNotification` só é `true` quando o Android autorizou alarmes exatos;
 * negado, o plugin agenda como inexato e o fallback é registrado no console.
 */
async function runTimerSync(input: TimerNotificationInput): Promise<TimerNotificationResult> {
  const base: TimerNotificationResult = {
    native: isNativeNotificationService(),
    permission: "unsupported",
    alarmScheduled: false,
    ongoingShown: false,
    inexactFallback: false,
  };
  if (!base.native) return base;

  const now = input.now ?? Date.now();
  try {
    const plugin = await loadPlugin();
    let status = await plugin.checkPermissions();
    if (status.display === "prompt" && input.active) {
      // Início do timer é um toque explícito; o Android 13+ pede uma vez.
      // Sessão sem timer iniciado não dispara pedido nenhum.
      status = await plugin.requestPermissions();
    }
    const permission = permissionFrom(status.display);
    if (permission !== "granted") {
      await Promise.all([removeTimerAlarm(plugin), removeTimerOngoing(plugin)]);
      return { ...base, permission, error: "notificações não autorizadas" };
    }

    await ensureChannels(plugin);
    const exactAlarms = await checkExactAlarms(plugin);
    const inexactFallback = isAndroid() && exactAlarms === "denied";

    if (!input.active) {
      await Promise.all([removeTimerAlarm(plugin), removeTimerOngoing(plugin)]);
      return { ...base, permission, inexactFallback };
    }

    let alarmScheduled = false;
    let fellBack = false;
    const shouldAlarm =
      input.running && input.endsAt != null && input.endsAt > now && !input.expired;
    if (shouldAlarm && input.endsAt != null) {
      await removeTimerAlarm(plugin);
      const alarm = alarmSchedulePlan(exactAlarms);
      const scheduled = await scheduleWithFallback(plugin, [
        {
          id: TIMER_ALARM_ID,
          title: TIMER_ALARM_TITLE,
          body: `${input.label} · fim às ${timerClock(input.endsAt)}`,
          channelId: "timer",
          autoCancel: true,
          ongoing: false,
          isExactNotification: alarm.isExactNotification,
          schedule: { at: new Date(input.endsAt), allowWhileIdle: alarm.allowWhileIdle },
          extra: {
            reta: "timer",
            sessionId: input.sessionId,
            endsAt: input.endsAt,
            exact: alarm.exact,
          },
        },
      ]);
      fellBack = scheduled.fellBack;
      alarmScheduled = scheduled.result.notifications.some((item) => item.id === TIMER_ALARM_ID);
      if (inexactFallback || fellBack) {
        console.warn(
          `[timer] alarme exato negado pelo Android; "${TIMER_ALARM_TITLE}" agendado como inexato.`,
        );
      }
    } else {
      await removeTimerAlarm(plugin);
    }

    const copy = ongoingCopy(input);
    await plugin.schedule({
      notifications: [
        {
          id: TIMER_ONGOING_ID,
          title: copy.title,
          body: copy.body,
          channelId: TIMER_ONGOING_CHANNEL.id,
          // `setOngoing(true)`: não pode ser deslizada para fora da gaveta.
          ongoing: true,
          autoCancel: false,
          // Sem `schedule` = publica na hora. `isExactNotification: false`
          // evita que o plugin abra a tela de alarmes exatos por engano.
          isExactNotification: false,
          extra: {
            reta: "timer-progresso",
            sessionId: input.sessionId,
            endsAt: input.endsAt,
            running: input.running,
          },
        },
      ],
    });

    return {
      ...base,
      permission,
      alarmScheduled,
      ongoingShown: true,
      inexactFallback: inexactFallback || fellBack,
    };
  } catch (error) {
    return { ...base, error: errorMessage(error) };
  }
}

function emptyTimerResult(): TimerNotificationResult {
  return {
    native: isNativeNotificationService(),
    permission: "unsupported",
    alarmScheduled: false,
    ongoingShown: false,
    inexactFallback: false,
  };
}

type TimerCommand = { type: "sync"; input: TimerNotificationInput } | { type: "cancel" };

let queuedTimerCommand: TimerCommand | null = null;
let runningTimerCommand: Promise<TimerNotificationResult> | null = null;

/**
 * Fila de comandos do timer. Começar, pausar e encerrar podem acontecer antes
 * de a chamada anterior ao plugin terminar; sem a fila, um agendamento atrasado
 * poderia ressuscitar o alarme depois da pausa. Só vale o último comando.
 */
function flushTimerCommands(): Promise<TimerNotificationResult> {
  if (runningTimerCommand) return runningTimerCommand;

  runningTimerCommand = (async () => {
    let last = emptyTimerResult();
    try {
      while (queuedTimerCommand) {
        const command = queuedTimerCommand;
        queuedTimerCommand = null;
        if (command.type === "cancel") {
          await cancelTimerNow();
          last = emptyTimerResult();
        } else {
          last = await runTimerSync(command.input);
        }
      }
    } finally {
      runningTimerCommand = null;
    }
    return last;
  })();

  return runningTimerCommand;
}

/** Alinha alarme + notificação persistente ao estado atual (último comando vence). */
export function syncTimerNotifications(
  input: TimerNotificationInput,
): Promise<TimerNotificationResult> {
  if (!isNativeNotificationService()) return Promise.resolve(emptyTimerResult());
  queuedTimerCommand = { type: "sync", input };
  return flushTimerCommands();
}

/** Cancela alarme e notificação persistente na mesma fila do timer. */
export function cancelTimerNotifications(): Promise<void> {
  if (!isNativeNotificationService()) return Promise.resolve();
  queuedTimerCommand = { type: "cancel" };
  return flushTimerCommands().then(() => undefined);
}

/* ------------------------------------------------------------------ *
 * Permissão na web (Notification API + service worker)
 *
 * No WebView do Android a API `Notification` não existe, então a permissão
 * real vem do plugin nativo (acima). Estes dois helpers mantêm o caminho web
 * do app (e o de versões antigas) funcionando sem mudar a tela de Ajustes.
 * ------------------------------------------------------------------ */

export type NotificationPermissionState = "granted" | "denied" | "default" | "unsupported";

export function notificationPermission(): NotificationPermissionState {
  if (typeof Notification === "undefined") return "unsupported";
  const permission = Notification.permission;
  if (permission === "granted" || permission === "denied" || permission === "default") {
    return permission;
  }
  return "unsupported";
}

export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  if (typeof Notification === "undefined") return "unsupported";
  try {
    const permission = await Notification.requestPermission();
    if (permission === "granted" || permission === "denied" || permission === "default") {
      return permission;
    }
    return "unsupported";
  } catch {
    return "denied";
  }
}

/**
 * Permissão efetiva do aparelho: no nativo lê o plugin (sem abrir diálogo) e
 * na web cai na `Notification` do navegador. Serve para a tela mostrar o aviso
 * de "lembretes desativados" logo ao abrir.
 */
export async function getNotificationPermissionState(): Promise<NotificationPermissionState> {
  if (!isNativeNotificationService()) return notificationPermission();
  const status = await getNativeNotificationStatus();
  if (status.permission === "prompt") return "default";
  return status.permission;
}
