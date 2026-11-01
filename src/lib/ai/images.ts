import type { ImageCredit } from "../study/types.ts";

/**
 * Fotos do Wikimedia Commons com licença aberta. A mesma função roda no
 * servidor (fetch) e no APK (CapacitorHttp), recebendo o buscador de JSON.
 */

export type JsonFetcher = (url: string, timeoutMs: number) => Promise<unknown>;

export function stripHtml(value: string): string {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function openLicense(license: string): boolean {
  const text = license.toLowerCase();
  if (!text) return false;
  if (/non-?commercial|\bnc\b|no derivatives|\bnd\b/.test(text)) return false;
  return /public domain|cc0|cc by|creative commons|attribution/.test(text);
}

type CommonsPage = {
  imageinfo?: {
    thumburl?: string;
    url?: string;
    mime?: string;
    descriptionurl?: string;
    extmetadata?: Record<string, { value?: string }>;
  }[];
};

/** Primeira imagem aceitável da resposta da API do Commons, ou `null`. */
export function parseCommonsPage(data: unknown, query: string): ImageCredit | null {
  const pages = (data as { query?: { pages?: Record<string, CommonsPage> } } | null)?.query?.pages;
  if (!pages) return null;
  for (const page of Object.values(pages)) {
    const info = page.imageinfo?.[0];
    if (!info) continue;
    const mime = info.mime ?? "";
    if (mime && !/^image\/(jpeg|png|gif|webp)$/.test(mime)) continue;
    const meta = info.extmetadata ?? {};
    const license = stripHtml(meta.LicenseShortName?.value ?? "");
    if (!openLicense(license)) continue;
    const src = info.thumburl || info.url || "";
    if (!src.startsWith("https://")) continue;
    return {
      src,
      alt: stripHtml(meta.ImageDescription?.value ?? query).slice(0, 180) || query,
      credit: stripHtml(meta.Artist?.value ?? "Wikimedia Commons").slice(0, 160),
      license,
      sourceUrl: info.descriptionurl || "https://commons.wikimedia.org/",
    };
  }
  return null;
}

function commonsUrl(query: string): string {
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  url.searchParams.set("action", "query");
  url.searchParams.set("format", "json");
  url.searchParams.set("generator", "search");
  url.searchParams.set("gsrsearch", query);
  url.searchParams.set("gsrnamespace", "6");
  url.searchParams.set("gsrlimit", "5");
  url.searchParams.set("prop", "imageinfo");
  url.searchParams.set("iiprop", "url|mime|extmetadata");
  url.searchParams.set("iiurlwidth", "800");
  return url.toString();
}

/** Até duas imagens; qualquer falha de rede só deixa o pacote sem foto. */
export async function commonsImages(
  queries: string[],
  getJson: JsonFetcher,
  timeoutMs = 8000,
): Promise<ImageCredit[]> {
  const images: ImageCredit[] = [];
  for (const query of queries) {
    if (images.length >= 2) break;
    try {
      const data = await getJson(commonsUrl(query), timeoutMs);
      const image = parseCommonsPage(data, query);
      if (image) images.push(image);
    } catch {
      continue;
    }
  }
  return images;
}
