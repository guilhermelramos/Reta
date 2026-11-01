import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

/**
 * Entrega um arquivo gerado no aparelho.
 *
 * No Android o `<a download>` do WebView não baixa nada: o arquivo é gravado
 * no cache do app e entregue pelo share sheet nativo. Na web continua o
 * download normal do navegador.
 */
export async function deliverFile(input: {
  name: string;
  bytes: ArrayBuffer;
  mime: string;
  title: string;
}): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const written = await Filesystem.writeFile({
      path: `reta/${input.name}`,
      data: base64(input.bytes),
      directory: Directory.Cache,
      recursive: true,
    });
    await Share.share({
      title: input.title,
      dialogTitle: input.title,
      files: [written.uri],
    });
    return;
  }
  downloadInBrowser(input);
}

function base64(bytes: ArrayBuffer): string {
  const view = new Uint8Array(bytes);
  let binary = "";
  const chunk = 0x8000;
  for (let index = 0; index < view.length; index += chunk) {
    binary += String.fromCharCode(...view.subarray(index, index + chunk));
  }
  return btoa(binary);
}

function downloadInBrowser(input: { name: string; bytes: ArrayBuffer; mime: string }): void {
  const blob = new Blob([input.bytes], { type: input.mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = input.name;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}
