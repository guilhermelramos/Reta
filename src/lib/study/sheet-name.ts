/**
 * Nome da planilha ativa.
 *
 * O nome vem do arquivo escolhido (sem extensão), não do nome da aba do
 * workbook: a aba costuma ser a genérica "Plano" e virava o rótulo do plano
 * inteiro. Planos antigos que já gravaram "Plano" continuam intactos no
 * IndexedDB; só a exibição troca pelo rótulo neutro.
 */

/** Rótulo usado quando o arquivo não tem nome aproveitável. */
export const DEFAULT_SHEET_NAME = "Minha planilha";

/** Nome genérico gravado por versões anteriores (só na exibição). */
const LEGACY_GENERIC_SHEET_NAME = "plano";

/**
 * `enem-reta-final.xlsx` → `enem-reta-final`.
 * `C:\fakepath\plano de estudo.xlsx` → `plano de estudo`.
 * Sem nome (ou só a extensão) → `Minha planilha`.
 */
export function sheetNameFromFile(fileName?: string | null): string {
  const base = (fileName ?? "").trim().split(/[\\/]/).pop() ?? "";
  const withoutExtension = base.replace(/\.[^.]+$/, "").trim();
  return withoutExtension || DEFAULT_SHEET_NAME;
}

/**
 * Nome que a interface mostra para uma planilha já salva. Vazio continua vazio
 * (a tela decide o rótulo neutro de "plano de exemplo"); `"Plano"` vira
 * `"Minha planilha"` sem migrar o dado.
 */
export function displaySheetName(name?: string | null): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return "";
  return trimmed.toLowerCase() === LEGACY_GENERIC_SHEET_NAME
    ? DEFAULT_SHEET_NAME
    : trimmed;
}
