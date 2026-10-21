import { LANGS, OG_LOCALE, PAGE_META, SITE_ORIGIN, pageUrl, resolvePage } from "./seoMeta";

export { SITE_ORIGIN };

function upsert(doc: Document, selector: string, create: () => HTMLElement): HTMLElement {
  let el = doc.head.querySelector<HTMLElement>(selector);
  if (!el) {
    el = create();
    doc.head.appendChild(el);
  }
  return el;
}

function setMeta(doc: Document, attr: "name" | "property", key: string, content: string): void {
  const el = upsert(doc, `meta[${attr}="${key}"]`, () => {
    const m = doc.createElement("meta");
    m.setAttribute(attr, key);
    return m;
  });
  el.setAttribute("content", content);
}

/**
 * Aligne le <head> sur la route courante (SPA) : lang, canonical, et pour les
 * pages publiques title, description, Open Graph, Twitter et hreflang.
 */
export function syncHead(path: string, lang: string, doc: Document = document): void {
  doc.documentElement.lang = lang;

  const clean = (path.split(/[?#]/)[0] ?? "").replace(/\/+$/, "");
  const canonical = upsert(doc, 'link[rel="canonical"]', () => {
    const l = doc.createElement("link");
    l.rel = "canonical";
    return l;
  }) as HTMLLinkElement;
  canonical.href = SITE_ORIGIN + (clean || "/");

  const resolved = resolvePage(clean || "/");
  if (!resolved) return;
  const { lang: l, page } = resolved;
  const meta = PAGE_META[page]![l];

  doc.title = meta.title;
  setMeta(doc, "name", "description", meta.description);
  setMeta(doc, "property", "og:title", meta.title);
  setMeta(doc, "property", "og:description", meta.description);
  setMeta(doc, "property", "og:url", pageUrl(l, page));
  setMeta(doc, "property", "og:locale", OG_LOCALE[l]);
  doc.head.querySelectorAll('meta[property="og:locale:alternate"]').forEach((m) => m.remove());
  for (const other of LANGS.filter((x) => x !== l)) {
    const m = doc.createElement("meta");
    m.setAttribute("property", "og:locale:alternate");
    m.setAttribute("content", OG_LOCALE[other]);
    doc.head.appendChild(m);
  }
  setMeta(doc, "name", "twitter:title", meta.title);
  setMeta(doc, "name", "twitter:description", meta.description);

  for (const alt of [...LANGS, "x-default"] as const) {
    const link = upsert(doc, `link[rel="alternate"][hreflang="${alt}"]`, () => {
      const a = doc.createElement("link");
      a.rel = "alternate";
      a.hreflang = alt;
      return a;
    }) as HTMLLinkElement;
    link.href = pageUrl(alt === "x-default" ? "en" : alt, page);
  }
}
