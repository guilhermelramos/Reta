import { Capacitor } from "@capacitor/core";
import type { PermissionState } from "@capacitor/core";
import { isIgnoringBatteryOptimizations } from "@/lib/native/battery";
import { buildReminderSchedule } from "@/lib/study/notification-schedule";
import type { ScheduledReminder } from "@/lib/study/notification-schedule";
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
  for (const channel of REMINDER_CHANNELS) {
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
  return {
    id: reminder.id,
    title: reminder.title,
    body: reminder.body,
    channelId: reminder.channelId,
    autoCancel: true,
    // Se o alarme exato foi negado, este campo evita que o plugin abra a
    // tela de configurações sozinho e agenda como alarme inexato.
    isExactNotification: exactAlarms === "granted",
    extra: {
      reta: "reminder",
      key: reminder.key,
      date: reminder.date,
      tag: reminder.tag,
    },
    schedule: {
      at: reminder.at,
      allowWhileIdle: true,
    },
  };
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
      return { ...base, permission, exactAlarms, cancelled, inexactFallback: exactAlarms === "denied" };
    }

    await ensureChannels(plugin);
    const cancelled = await cancelReminders(plugin);
    const result = await plugin.schedule({
      notifications: reminders.map((reminder) => schedulePayload(reminder, exactAlarms)),
    });

    return {
      ...base,
      permission,
      exactAlarms,
      batteryOptimizationsIgnored: await isIgnoringBatteryOptimizations(),
      scheduled: result.notifications.length,
      cancelled,
      inexactFallback: exactAlarms === "denied",
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
