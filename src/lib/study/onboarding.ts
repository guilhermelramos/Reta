/**
 * Regras do onboarding (4 telas de boas-vindas).
 *
 * Módulo puro: sem React, IndexedDB, Capacitor ou `fetch`. A tela
 * `/boas-vindas` e o desvio da primeira abertura usam estas funções; os testes
 * em `onboarding.test.ts` cobrem a decisão de mostrar a introdução e os textos
 * de erro da verificação da chave xAI.
 */

export const ONBOARDING_STEP_COUNT = 4;

/** 0 = Boas-vindas, 1 = Planilha, 2 = Professor IA, 3 = Lembretes. */
export type OnboardingStep = 0 | 1 | 2 | 3;

export type OnboardingSignals = {
  /** `meta.onboardingDone` no IndexedDB. */
  onboardingDone: boolean;
  /** Existe chave xAI no cofre (Keystore no Android, IndexedDB na web). */
  hasXaiKey: boolean;
  /** O plano veio de uma planilha importada (não é o modelo semeado). */
  hasImportedPlan: boolean;
};

/**
 * "Planilha importada" = a store `days` foi substituída por uma importação.
 * O app semeia um plano de exemplo na primeira abertura (marcando
 * `meta.seeded`), então `seeded` verdadeiro não conta como importação.
 */
export function hasImportedPlan(seeded: boolean, dayCount: number): boolean {
  return !seeded && dayCount > 0;
}

/**
 * A introdução aparece só quando nada disso aconteceu: ninguém concluiu o
 * onboarding, não há chave salva e o plano ainda é o semeado. Assim quem já
 * usava o app (ou restaura um backup com chave) não vê a tela de novo.
 */
export function shouldShowOnboarding(signals: OnboardingSignals): boolean {
  if (signals.onboardingDone) return false;
  if (signals.hasXaiKey) return false;
  if (signals.hasImportedPlan) return false;
  return true;
}

/** Passo anterior, nunca abaixo de 0 (usado pelo voltar do Android). */
export function previousOnboardingStep(step: number): OnboardingStep {
  const clamped = Math.min(ONBOARDING_STEP_COUNT - 1, Math.max(0, Math.trunc(step)));
  return (clamped > 0 ? clamped - 1 : 0) as OnboardingStep;
}

/* ------------------------- Verificação da chave xAI ------------------------- */

/**
 * Textos decididos pelo Consultor para a tela 3. São exatamente os mesmos na
 * web e no APK, independentemente de o erro vir do `fetch` ou do
 * `CapacitorHttp`.
 */
export const KEY_CHECK_INVALID_MESSAGE =
  "Chave inválida ou revogada. Confira se copiou inteira.";
export const KEY_CHECK_RATE_LIMIT_MESSAGE =
  "Limite da sua conta xAI atingido. Tente em alguns minutos.";
export const KEY_CHECK_OFFLINE_MESSAGE =
  "Sem internet. Você pode verificar depois em Ajustes.";
export const KEY_CHECK_UNKNOWN_MESSAGE =
  "Não consegui verificar a chave agora. Tente de novo.";

export type KeyCheckErrorKind = "invalid" | "rate-limit" | "offline" | "unknown";

export type KeyCheckErrorCopy = {
  kind: KeyCheckErrorKind;
  message: string;
};

/** O que a verificação pode devolver: `AiFailure`/`AiRequestError`/erro cru. */
export type KeyCheckFailure = {
  kind?: string | null;
  status?: number | null;
  message?: string | null;
} | null | undefined;

/**
 * 401/403 → chave inválida; 429 → limite da conta; offline/timeout → o texto
 * que lembra que dá para verificar depois em Ajustes. Qualquer outro erro
 * (5xx, resposta vazia) fica num texto neutro para não acusar a chave errada.
 */
export function keyCheckErrorCopy(
  failure: KeyCheckFailure,
  options: { online?: boolean } = {},
): KeyCheckErrorCopy {
  if (options.online === false) {
    return { kind: "offline", message: KEY_CHECK_OFFLINE_MESSAGE };
  }

  const kind = failure?.kind ?? undefined;
  const status = failure?.status ?? undefined;
  const message = failure?.message ?? "";

  if (status === 401 || status === 403 || kind === "unauthorized") {
    return { kind: "invalid", message: KEY_CHECK_INVALID_MESSAGE };
  }
  // A xAI responde 400 "Incorrect API key provided." para uma chave colada pela
  // metade (formato inválido), antes de chegar ao 401 de chave revogada.
  if (status === 400 && /api key|chave/i.test(message)) {
    return { kind: "invalid", message: KEY_CHECK_INVALID_MESSAGE };
  }
  if (status === 429 || kind === "rate-limit") {
    return { kind: "rate-limit", message: KEY_CHECK_RATE_LIMIT_MESSAGE };
  }
  if (kind === "offline" || kind === "timeout") {
    return { kind: "offline", message: KEY_CHECK_OFFLINE_MESSAGE };
  }
  if (kind === "missing-key") {
    return { kind: "invalid", message: "Cole a chave da xAI para verificar." };
  }
  return { kind: "unknown", message: KEY_CHECK_UNKNOWN_MESSAGE };
}

/** Chave digitada só com espaços não chega à API. */
export function isValidKeyDraft(draft: string): boolean {
  return draft.trim().length > 0;
}
