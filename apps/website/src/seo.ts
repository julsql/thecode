export const SITE_ORIGIN = "https://thecode.julsql.fr";

/** Aligne `<html lang>` et `<link rel="canonical">` sur la route courante (SPA). */
export function syncHead(path: string, lang: string, doc: Document = document): void {
  doc.documentElement.lang = lang;
  let link = doc.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = doc.createElement("link");
    link.rel = "canonical";
    doc.head.appendChild(link);
  }
  const clean = (path.split(/[?#]/)[0] ?? "").replace(/\/+$/, "");
  link.href = SITE_ORIGIN + (clean || "/");
}
