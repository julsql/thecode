/**
 * Réglages par défaut du générateur : longueur et jeux de caractères pour un
 * site absent du carnet. Voir shared/spec/default-settings.md.
 *
 * Retenus dans localStorage (protégé : navigation privée), et partagés avec
 * le compte de synchronisation quand il y en a un (voir `syncSettings`).
 */

export interface DefaultSettings {
  length: number;
  charset: { lower: boolean; upper: boolean; symbols: boolean; numbers: boolean };
  /** Date de la dernière modification locale, vide pour les valeurs d'usine. */
  updatedAt: string;
}

export const SETTINGS_STORAGE_KEY = "thecode.defaultSettings";
export const SETTINGS_MIN_LENGTH = 4;
export const SETTINGS_MAX_LENGTH = 40;

export function factorySettings(): DefaultSettings {
  return {
    length: 20,
    charset: { lower: true, upper: true, symbols: true, numbers: true },
    updatedAt: "",
  };
}

/**
 * Valide des réglages venus du stockage ou d'un autre appareil.
 *
 * Rend null pour une valeur inutilisable (longueur absente, aucun jeu coché) ;
 * une longueur hors bornes est ramenée dans les bornes.
 */
export function normalizeSettings(raw: unknown): DefaultSettings | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as { length?: unknown; charset?: unknown; updatedAt?: unknown };
  if (!value.charset || typeof value.charset !== "object") return null;
  const length = Number.parseInt(String(value.length), 10);
  if (Number.isNaN(length)) return null;
  const set = value.charset as Record<string, unknown>;
  const charset = {
    lower: set.lower === true,
    upper: set.upper === true,
    symbols: set.symbols === true,
    numbers: set.numbers === true,
  };
  if (!Object.values(charset).some(Boolean)) return null;
  return {
    length: Math.min(SETTINGS_MAX_LENGTH, Math.max(SETTINGS_MIN_LENGTH, length)),
    charset,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : "",
  };
}

/** Vrai quand les deux réglages donnent les mêmes mots de passe. */
export function sameSettings(a: DefaultSettings, b: DefaultSettings): boolean {
  return (
    a.length === b.length &&
    a.charset.lower === b.charset.lower &&
    a.charset.upper === b.charset.upper &&
    a.charset.symbols === b.charset.symbols &&
    a.charset.numbers === b.charset.numbers
  );
}

export function loadSettings(): DefaultSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    return (raw && normalizeSettings(JSON.parse(raw))) || factorySettings();
  } catch {
    return factorySettings();
  }
}

export function saveSettings(settings: DefaultSettings): void {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Stockage indisponible : les réglages valent pour la page ouverte.
  }
}

/**
 * Retient des réglages modifiés localement, datés de maintenant.
 *
 * Sans effet s'ils ne changent rien : dater une valeur inchangée ferait
 * l'emporter, à la synchronisation, un appareil qui n'a rien modifié.
 */
export function rememberSettings(next: Omit<DefaultSettings, "updatedAt">): DefaultSettings {
  const current = loadSettings();
  const candidate = normalizeSettings({ ...next, updatedAt: "" });
  if (!candidate || sameSettings(candidate, current)) return current;
  const stamped = {
    ...candidate,
    updatedAt: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
  };
  saveSettings(stamped);
  return stamped;
}
