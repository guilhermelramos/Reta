import { Capacitor } from "@capacitor/core";
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

/**
 * Salvar e compartilhar arquivos no Reta.
 *
 * No Android (Capacitor/WebView) `navigator.share` e `<a download>` não
 * funcionam como no navegador: o arquivo é gravado no sistema de arquivos do
 * app (`Directory.Cache`) e compartilhado pelo plugin Share. Na web o
 * comportamento antigo continua: Web Share com arquivo quando disponível e
 * `<a download>` como fallback.
 */

export type SaveMode =
  /** Abriu a folha de compartilhamento do sistema. */
  | "shared"
  /** Baixou pela web ou gravou em Documents no aparelho. */
  | "downloaded"
  /** Usuário fechou a folha de compartilhamento sem escolher destino. */
  | "canceled";

export type SaveResult = {
  mode: SaveMode;
  fileName: string;
  /** URI `file://` do arquivo gravado no aparelho (só no nativo). */
  uri?: string;
};

/** Nome seguro para o sistema de arquivos (sem barras nem `..`). */
export function safeFileName(name: string): string {
  const withoutControls = Array.from(name)
    .filter((ch) => ch.charCodeAt(0) > 31 && ch.charCodeAt(0) !== 127)
    .join("");
  const cleaned = withoutControls
    .replace(/[\\/]+/g, "-")
    .replace(/^\.+/, "")
    .trim();
  return cleaned || "reta-arquivo";
}

export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

/** Blob → base64 (o Filesystem exige base64 para dados binários). */
export async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function isCanceled(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError"
    ? true
    : /cancel/i.test(err instanceof Error ? err.message : String(err));
}

/**
 * Grava no aparelho e abre o compartilhamento. Se a folha não abrir, tenta
 * deixar o arquivo em Documents para o usuário encontrar pelo gerenciador.
 */
async function saveAndShareNative(
  fileName: string,
  data: Blob | string,
): Promise<SaveResult> {
  const payload =
    typeof data === "string"
      ? { data, encoding: Encoding.UTF8 }
      : { data: await blobToBase64(data), encoding: undefined };

  const written = await Filesystem.writeFile({
    path: fileName,
    data: payload.data,
    directory: Directory.Cache,
    encoding: payload.encoding,
    recursive: true,
  });

  try {
    await Share.share({
      title: fileName,
      url: written.uri,
      dialogTitle: "Salvar ou compartilhar",
    });
    return { mode: "shared", fileName, uri: written.uri };
  } catch (err) {
    if (isCanceled(err)) return { mode: "canceled", fileName, uri: written.uri };
    // Sem app de compartilhamento: tenta um destino que o usuário alcança.
    try {
      const saved = await Filesystem.writeFile({
        path: fileName,
        data: payload.data,
        directory: Directory.Documents,
        encoding: payload.encoding,
        recursive: true,
      });
      return { mode: "downloaded", fileName, uri: saved.uri };
    } catch {
      return { mode: "downloaded", fileName, uri: written.uri };
    }
  }
}

function downloadOnWeb(fileName: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

async function saveAndShareWeb(
  fileName: string,
  mime: string,
  data: Blob | string,
): Promise<SaveResult> {
  const blob = typeof data === "string" ? new Blob([data], { type: mime }) : data;
  const file = new File([blob], fileName, { type: mime || blob.type });

  if (typeof navigator !== "undefined" && typeof navigator.share === "function" && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: fileName });
      return { mode: "shared", fileName };
    } catch (err) {
      if (isCanceled(err)) return { mode: "canceled", fileName };
      // Web Share recusado na prática: cai para o download abaixo.
    }
  }

  downloadOnWeb(fileName, blob);
  return { mode: "downloaded", fileName };
}

/**
 * Grava e compartilha um arquivo. No Capacitor usa Filesystem + Share; na web
 * mantém Web Share / `<a download>`.
 */
export async function saveAndShare(
  nome: string,
  mime: string,
  data: Blob | string,
): Promise<SaveResult> {
  const fileName = safeFileName(nome);
  if (isNativePlatform()) return saveAndShareNative(fileName, data);
  return saveAndShareWeb(fileName, mime, data);
}
