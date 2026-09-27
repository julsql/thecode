/**
 * Guides d'installation affichés sur la page Tutoriel.
 *
 * Sur Apple, TheCode n'est pas une extension Safari : ce sont les apps natives
 * (iOS/iPadOS et macOS) qui se déclarent comme fournisseur de remplissage
 * automatique des mots de passe du système.
 */
import type { TranslationKey } from "@/i18n";
import ChromeIcon from "@/assets/chrome.png";
import FirefoxIcon from "@/assets/firefox.png";
import AppleIcon from "@/assets/apple.png";
import AndroidIcon from "@/assets/android.png";

export type PlatformId = "ios" | "macos" | "android" | "chrome" | "firefox";

export interface PlatformGuide {
  id: PlatformId;
  titleKey: TranslationKey;
  introKey?: TranslationKey;
  steps: TranslationKey[];
  ctaKey: TranslationKey;
  icon: string;
  url: string;
}

const APP_STORE = "https://apps.apple.com/app/thecode-password-manager/id6753169043";

export const platforms: PlatformGuide[] = [
  {
    id: "ios",
    titleKey: "tutorial_ios_h",
    introKey: "tutorial_ios_intro",
    steps: ["tutorial_ios_s1", "tutorial_ios_s2", "tutorial_ios_s3", "tutorial_ios_s4"],
    ctaKey: "tutorial_ios_cta",
    icon: AppleIcon,
    url: APP_STORE,
  },
  {
    id: "macos",
    titleKey: "tutorial_macos_h",
    introKey: "tutorial_macos_intro",
    steps: ["tutorial_macos_s1", "tutorial_macos_s2", "tutorial_macos_s3", "tutorial_macos_s4"],
    ctaKey: "tutorial_macos_cta",
    icon: AppleIcon,
    url: APP_STORE,
  },
  {
    id: "android",
    titleKey: "tutorial_android_h",
    steps: ["tutorial_android_s1", "tutorial_android_s2", "tutorial_android_s3"],
    ctaKey: "tutorial_android_cta",
    icon: AndroidIcon,
    url: "https://play.google.com/store/apps/details?id=fr.juliette.thecode&hl=fr",
  },
  {
    id: "chrome",
    titleKey: "tutorial_chrome_h",
    steps: ["tutorial_chrome_s1", "tutorial_chrome_s2", "tutorial_chrome_s3", "tutorial_chrome_s4"],
    ctaKey: "tutorial_chrome_cta",
    icon: ChromeIcon,
    url: "https://chromewebstore.google.com/detail/thecode/jeknefpalcipdlnbeboefonmnlejepen",
  },
  {
    id: "firefox",
    titleKey: "tutorial_firefox_h",
    steps: ["tutorial_firefox_s1", "tutorial_firefox_s2", "tutorial_firefox_s3"],
    ctaKey: "tutorial_firefox_cta",
    icon: FirefoxIcon,
    url: "https://addons.mozilla.org/fr/firefox/addon/thecode/",
  },
];

/** Onglet ouvert par défaut, déduit du user-agent (Chrome à défaut). */
export function detectPlatform(ua: string = defaultUserAgent()): PlatformId {
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  if (/Firefox\//.test(ua)) return "firefox";
  // Safari sur Mac : pas d'extension, on renvoie vers l'app macOS.
  if (/Macintosh|Mac OS X/.test(ua) && /Safari/.test(ua) && !/Chrome|Chromium|Edg\//.test(ua)) {
    return "macos";
  }
  return "chrome";
}

function defaultUserAgent(): string {
  return typeof navigator === "undefined" ? "" : navigator.userAgent || "";
}
