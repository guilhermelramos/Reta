/**
 * Permissão de notificação do app.
 *
 * No WebView do Android a API `Notification` não existe; nesse caso o estado é
 * `unsupported` e a tela mostra o mesmo aviso de lembrete desativado. Quando o
 * app passar a usar notificações locais nativas, é este módulo que muda.
 */

export type NotificationPermissionState =
  | "granted"
  | "denied"
  | "default"
  | "unsupported";

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
