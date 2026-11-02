/**
 * Sessão da conta xAI experimental.
 *
 * O access token só entra em cena quando **não existe chave de API**: a chave
 * sempre tem prioridade. Antes de usar, o token é renovado se estiver perto de
 * vencer. Falha de refresh que não seja `invalid_grant` mantém o token atual
 * (pode ainda estar válido); `invalid_grant` desconecta a conta.
 */

import {
  needsRefresh,
  refreshAccessToken,
  type XaiAuthError,
  type XaiTokens,
} from "./device.ts";
import { defaultAuthTransport } from "./transport.ts";
import { clearXaiTokens, loadXaiTokens, saveXaiTokens } from "../../secure/xai-tokens.ts";

export async function xaiAccountTokens(): Promise<XaiTokens | null> {
  return loadXaiTokens();
}

export async function connectXaiAccount(tokens: XaiTokens): Promise<void> {
  await saveXaiTokens(tokens);
}

export async function disconnectXaiAccount(): Promise<void> {
  await clearXaiTokens();
}

/** `true` quando há uma conta conectada (mesmo com token vencido). */
export async function hasXaiAccount(): Promise<boolean> {
  return (await loadXaiTokens()) != null;
}

/**
 * Access token válido para `Authorization: Bearer`. Devolve `""` quando não há
 * conta ou quando o refresh foi recusado. Nunca lança: a IA deve cair na
 * mensagem de chave ausente, não num crash.
 */
export async function currentXaiAccessToken(
  now: number = Date.now(),
): Promise<string> {
  const tokens = await loadXaiTokens();
  if (!tokens) return "";
  if (!needsRefresh(tokens, now)) return tokens.accessToken;
  if (!tokens.refreshToken) {
    await clearXaiTokens();
    return "";
  }
  try {
    const next = await refreshAccessToken(defaultAuthTransport(), tokens.refreshToken, { now });
    await saveXaiTokens(next);
    return next.accessToken;
  } catch (error) {
    const code = (error as XaiAuthError | undefined)?.code;
    if (code === "invalid_grant" || code === "expired_token") {
      await clearXaiTokens();
      return "";
    }
    // Rede instável/5xx: tenta o token atual; se estiver vencido, a xAI recusa
    // e a UI mostra a mensagem de login recusado.
    return tokens.accessToken;
  }
}
