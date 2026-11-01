/**
 * Retorno tátil do fim de bloco.
 *
 * `@capacitor/haptics` não faz parte das dependências do app, então usamos a
 * API de vibração do WebView (`navigator.vibrate`), disponível no Android com a
 * permissão normal `android.permission.VIBRATE`. Em aparelhos/navegadores sem
 * suporte a chamada é ignorada: o snackbar continua sendo o aviso principal.
 */
export function blockDoneHaptic(): Promise<void> {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate([30, 60, 30]);
    }
  } catch {
    // sem vibração: silencioso de propósito
  }
  return Promise.resolve();
}
