import { Capacitor, registerPlugin } from "@capacitor/core";

/**
 * Ponte para o plugin nativo mínimo (`BatteryOptimizationPlugin.java`).
 *
 * O Capacitor não tem API oficial para a otimização de bateria do Android,
 * por isso o plugin local expõe apenas o estado e a tela de configurações do
 * sistema. Não pedimos `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`: o usuário
 * escolhe o app na lista do próprio Android.
 */
export interface BatteryOptimizationPlugin {
  isIgnoringBatteryOptimizations(): Promise<{ ignoring: boolean }>;
  openBatteryOptimizationSettings(): Promise<void>;
}

const BatteryOptimization = registerPlugin<BatteryOptimizationPlugin>("BatteryOptimization");

export function isBatteryOptimizationAvailable(): boolean {
  return Capacitor.getPlatform() === "android";
}

/** `null` quando não é Android ou a ponte nativa falhou. */
export async function isIgnoringBatteryOptimizations(): Promise<boolean | null> {
  if (!isBatteryOptimizationAvailable()) return null;
  try {
    const result = await BatteryOptimization.isIgnoringBatteryOptimizations();
    return Boolean(result.ignoring);
  } catch {
    return null;
  }
}

/** Abre a lista "Bateria > Otimização de bateria" do Android. */
export async function openBatteryOptimizationSettings(): Promise<boolean> {
  if (!isBatteryOptimizationAvailable()) return false;
  try {
    await BatteryOptimization.openBatteryOptimizationSettings();
    return true;
  } catch {
    return false;
  }
}
