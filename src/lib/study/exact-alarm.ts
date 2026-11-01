/**
 * Pedido contextual de alarmes exatos.
 *
 * O Android 12+ agenda o fim do bloco por `AlarmManager`. Sem a autorização
 * "Alarmes e lembretes" o aviso pode atrasar alguns minutos. Em vez de abrir a
 * tela de configurações sozinho, a sessão pergunta uma única vez, na primeira
 * vez que o timer começa a correr, e segue com alarme inexato se a pessoa
 * recusar.
 *
 * A decisão é pura para os testes; a lembrança do "já perguntei" fica em
 * `localStorage` (é uma flag de UI, não um dado de estudo).
 */

export const EXACT_ALARM_PROMPT =
  "Para o aviso tocar no minuto certo com a tela bloqueada, permita alarmes exatos";

export const EXACT_ALARM_ASKED_KEY = "reta:exactAlarmAsked";

export type ExactAlarmAskInput = {
  native: boolean;
  asked: boolean;
  started: boolean;
  permission: "granted" | "denied" | "prompt" | "unsupported";
  exactAlarms: "granted" | "denied" | "unsupported";
};

export function shouldAskExactAlarms(input: ExactAlarmAskInput): boolean {
  return (
    input.native &&
    !input.asked &&
    input.started &&
    input.permission === "granted" &&
    input.exactAlarms === "denied"
  );
}

export function exactAlarmsAlreadyAsked(): boolean {
  try {
    return globalThis.localStorage?.getItem(EXACT_ALARM_ASKED_KEY) === "1";
  } catch {
    return false;
  }
}

/** Marca antes de abrir o diálogo: fechar pelo voltar também conta como resposta. */
export function rememberExactAlarmsAsked(): void {
  try {
    globalThis.localStorage?.setItem(EXACT_ALARM_ASKED_KEY, "1");
  } catch {
    // WebView sem localStorage: o pedido pode voltar na próxima abertura.
  }
}
