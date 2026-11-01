/**
 * Regras de acessibilidade do Reta que dá para verificar direto no código.
 *
 * O APK roda no WebView do Android, então o alvo de toque efetivo é o mesmo
 * que o CSS declara. Estas regras impedem que alguém volte a introduzir alvos
 * de 44px (classes terminadas em 11), texto com opacidade abaixo de 80% ou
 * metadados menores que 12px.
 */

export type A11yRule = "touch-target" | "text-opacity" | "metadata-size";

export type A11yIssue = {
  file: string;
  line: number;
  rule: A11yRule;
  value: string;
  message: string;
};

/** Classes de 44px: o mínimo do app é 48px (`-12`). */
const TOUCH_TARGET_44 = /\b(?:min-h|min-w|h|w|size)-11\b/g;

/** Cor de texto com modificador de opacidade (ex.: `text-muted` abaixo de /80). */
const TEXT_OPACITY = /\btext-[a-z0-9-]+\/(\d{1,3})\b/g;

/** Tamanho explícito de fonte abaixo de 12px. */
const SMALL_TEXT = /\btext-\[(?:[0-9]|1[0-1])px\]/g;

/**
 * Audita um arquivo-fonte e devolve os problemas encontrados, com a linha
 * original. Função pura para poder ser testada sem tocar no disco.
 */
export function auditA11ySource(file: string, source: string): A11yIssue[] {
  const issues: A11yIssue[] = [];

  source.split(/\r?\n/).forEach((line, index) => {
    const lineNumber = index + 1;

    for (const match of line.matchAll(TOUCH_TARGET_44)) {
      issues.push({
        file,
        line: lineNumber,
        rule: "touch-target",
        value: match[0],
        message: `alvo de toque de 44px (${match[0]}); use 48px`,
      });
    }

    for (const match of line.matchAll(TEXT_OPACITY)) {
      const opacity = Number(match[1]);
      if (opacity >= 80) continue;
      issues.push({
        file,
        line: lineNumber,
        rule: "text-opacity",
        value: match[0],
        message: `texto com opacidade ${opacity}% (${match[0]}); mínimo 80%`,
      });
    }

    for (const match of line.matchAll(SMALL_TEXT)) {
      issues.push({
        file,
        line: lineNumber,
        rule: "metadata-size",
        value: match[0],
        message: `texto abaixo de 12px (${match[0]})`,
      });
    }
  });

  return issues;
}
