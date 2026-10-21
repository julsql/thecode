import { describe, it, expect, beforeEach } from "vitest";
import { syncHead } from "@/seo";

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
});
