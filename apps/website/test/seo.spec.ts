import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { syncHead } from "@/seo";
import {
  LANGS,
  PAGE_META,
  SEO_PLACEHOLDER,
  prerenderTargets,
  renderPageHtml,
  resolvePage,
} from "@/seoMeta";

const indexHtml = readFileSync(resolve(__dirname, "../index.html"), "utf8");

describe("PAGE_META", () => {
  for (const [page, byLang] of Object.entries(PAGE_META)) {
    for (const lang of LANGS) {
      const { title, description } = byLang[lang];
      it(`${lang}/${page || "home"} has SEO-sized title and description`, () => {
        expect(title.length).toBeGreaterThanOrEqual(45);
        expect(title.length).toBeLessThanOrEqual(60);
        expect(description.length).toBeGreaterThanOrEqual(140);
        expect(description.length).toBeLessThanOrEqual(160);
      });
    }
  }

  it("titles and descriptions are unique", () => {
    const all = Object.values(PAGE_META).flatMap((b) => LANGS.map((l) => b[l]));
    expect(new Set(all.map((m) => m.title)).size).toBe(all.length);
    expect(new Set(all.map((m) => m.description)).size).toBe(all.length);
  });

  it("does not expose private pages", () => {
    expect(resolvePage("/en/vault")).toBeNull();
    expect(resolvePage("/fr/account")).toBeNull();
    expect(resolvePage("/fr/about/")).toEqual({ lang: "fr", page: "about" });
  });
});

describe("index.html", () => {
  it("carries the static head tags and the SEO placeholder", () => {
    expect(indexHtml).toContain(SEO_PLACEHOLDER);
    expect(indexHtml).toMatch(/<html lang="en">/);
    expect(indexHtml).toContain('name="theme-color"');
    expect(indexHtml).toContain('rel="apple-touch-icon" href="/logo.png"');
    expect(indexHtml).not.toMatch(/noindex/);
    const ld = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(indexHtml);
    const graph = JSON.parse(ld![1]!)["@graph"];
    expect(graph.map((n: { "@type": string }) => n["@type"])).toEqual([
      "WebSite",
      "WebApplication",
    ]);
  });

  it("renders every public page with its key tags", () => {
    const targets = prerenderTargets();
    expect(targets).toHaveLength(LANGS.length * Object.keys(PAGE_META).length);
    const html = renderPageHtml(indexHtml, "fr", "pricing");
    expect(html).toContain('<html lang="fr">');
    expect(html).toContain(`<title>${PAGE_META.pricing!.fr.title}</title>`);
    expect(html).toContain('<link rel="canonical" href="https://thecode.julsql.fr/fr/pricing" />');
    expect(html).toContain('hreflang="en" href="https://thecode.julsql.fr/en/pricing"');
    expect(html).toContain('hreflang="x-default" href="https://thecode.julsql.fr/en/pricing"');
    expect(html).toContain('property="og:image" content="https://thecode.julsql.fr/logo.png"');
    expect(html).toContain('property="og:locale" content="fr_FR"');
    expect(html).toContain('property="og:url" content="https://thecode.julsql.fr/fr/pricing"');
    expect(html).toContain('name="twitter:card" content="summary"');
    expect(html).not.toContain(SEO_PLACEHOLDER);
  });
});

describe("syncHead", () => {
  beforeEach(() => {
    document.head.innerHTML = "";
  });

  it("sets html lang and creates the canonical link", () => {
    syncHead("/fr/about", "fr");
    expect(document.documentElement.lang).toBe("fr");
    const link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    expect(link?.href).toBe("https://thecode.julsql.fr/fr/about");
  });

  it("reuses the existing link and strips query, hash and trailing slash", () => {
    syncHead("/en", "en");
    syncHead("/en/tutorial/?x=1#top", "en");
    const links = document.head.querySelectorAll('link[rel="canonical"]');
    expect(links).toHaveLength(1);
    expect((links[0] as HTMLLinkElement).href).toBe("https://thecode.julsql.fr/en/tutorial");
  });

  it("updates title, description, Open Graph and hreflang for public pages", () => {
    syncHead("/en/contact", "en");
    syncHead("/fr/contact", "fr");
    expect(document.title).toBe(PAGE_META.contact!.fr.title);
    const content = (sel: string) => document.head.querySelector(sel)?.getAttribute("content");
    expect(content('meta[name="description"]')).toBe(PAGE_META.contact!.fr.description);
    expect(content('meta[property="og:locale"]')).toBe("fr_FR");
    const alts = document.head.querySelectorAll('meta[property="og:locale:alternate"]');
    expect([...alts].map((m) => m.getAttribute("content"))).toEqual(["en_US"]);
    const fr = document.head.querySelector<HTMLLinkElement>('link[hreflang="fr"]');
    expect(fr?.href).toBe("https://thecode.julsql.fr/fr/contact");
  });

  it("leaves private pages without page metadata", () => {
    syncHead("/en/vault", "en");
    expect(document.head.querySelector('meta[name="description"]')).toBeNull();
  });
});
