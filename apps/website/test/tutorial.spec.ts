/**
 * Page Tutoriel : il n'y a plus d'extension Safari. Sur Apple, ce sont les apps
 * natives (iOS/iPadOS, macOS) qui remplissent les mots de passe.
 */
import { describe, it, expect } from "vitest";
import { platforms, detectPlatform } from "@/tutorial";
import { translations } from "@/i18n/translations";

const UA = {
  macSafari:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
  macChrome:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  macEdge:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0",
  macFirefox: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.4; rv:125.0) Gecko/20100101 Firefox/125.0",
  iphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
  android:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
  windowsChrome:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
};

describe("tutoriel — plateformes", () => {
  it("ne propose plus Safari", () => {
    const ids = platforms.map((p) => p.id as string);
    expect(ids).not.toContain("safari");
    expect(ids).toEqual(["ios", "macos", "android", "chrome", "firefox"]);
  });

  it("ne mentionne l'extension Safari dans aucune étape, en anglais comme en français", () => {
    for (const lang of ["en", "fr"] as const) {
      for (const p of platforms) {
        const keys = [p.titleKey, p.introKey, p.ctaKey, ...p.steps].filter(Boolean);
        for (const key of keys) {
          expect(translations[lang][key!]).toBeTruthy();
          expect(translations[lang][key!]).not.toMatch(/safari/i);
        }
      }
    }
  });

  it("explique l'activation du remplissage automatique sur iOS et macOS", () => {
    const ios = platforms.find((p) => p.id === "ios")!;
    const macos = platforms.find((p) => p.id === "macos")!;
    const text = (lang: "en" | "fr", keys: readonly string[]) =>
      keys.map((k) => translations[lang][k as keyof (typeof translations)["en"]]).join(" ");

    expect(text("en", ios.steps)).toContain("AutoFill & Passwords");
    expect(text("en", macos.steps)).toContain("System Settings");
    expect(text("fr", ios.steps)).toContain("Remplissage automatique et mots de passe");
    expect(text("fr", macos.steps)).toContain("Réglages Système");
  });
});

describe("tutoriel — détection de la plateforme", () => {
  it.each([
    [UA.macSafari, "macos"],
    [UA.macChrome, "chrome"],
    [UA.macEdge, "chrome"],
    [UA.macFirefox, "firefox"],
    [UA.iphone, "ios"],
    [UA.android, "android"],
    [UA.windowsChrome, "chrome"],
    ["", "chrome"],
  ])("%s → %s", (ua, expected) => {
    expect(detectPlatform(ua)).toBe(expected);
  });
});
