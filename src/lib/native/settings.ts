import { Capacitor } from "@capacitor/core";
import { AndroidSettings, IOSSettings, NativeSettings } from "capacitor-native-settings";

/**
 * Abre as configurações do app no sistema (Android: tela de detalhes do app,
 * onde ficam as permissões de notificação; iOS: Ajustes › Reta).
 *
 * Na web não existe equivalente: devolve `false` para a tela mostrar a
 * orientação do navegador em vez de fingir que abriu.
 */
export async function openAppSettings(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const result = await NativeSettings.open({
      optionAndroid: AndroidSettings.ApplicationDetails,
      optionIOS: IOSSettings.App,
    });
    return result.status !== false;
  } catch {
    return false;
  }
}
