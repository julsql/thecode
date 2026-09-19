/**
 * Carnet de métadonnées.
 *
 * Le carnet ne contient jamais de mot de passe ni de clef maîtresse : seulement
 * de quoi rejouer une dérivation. Une fuite révèle les sites et les
 * identifiants, pas les mots de passe.
 *
 * Schéma : shared/vault.schema.json
 * Règles de fusion : shared/spec/vault-merge.md
 */

export const VAULT_SCHEMA = 1;
export const VAULT_STORAGE_KEY = "thecode.vault";
export const DEFAULT_LENGTH = 20;
export const DEFAULT_CHARSET: Charset = {
  lower: true,
  upper: true,
  symbols: true,
  numbers: true,
};

export interface Charset {
  lower: boolean;
  upper: boolean;
  symbols: boolean;
  numbers: boolean;
}

export interface VaultEntry {
  id: string;
  label?: string;
  siteKey: string;
  domains: string[];
  login?: string;
  counter: number;
  length: number;
  charset: Charset;
  v: number;
  notes?: string;
  updatedAt: string;
  deleted?: boolean;
}

export interface Vault {
  schema: number;
  updatedAt?: string;
  entries: VaultEntry[];
}

export interface Conflict {
  kind: "sitekey-divergent" | "counter-recul";
  entryId: string;
  detail: string;
}

function nowIso(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

export function emptyVault(): Vault {
  return { schema: VAULT_SCHEMA, updatedAt: nowIso(), entries: [] };
}

export function newEntry(
  siteKey: string,
  options: Partial<Omit<VaultEntry, "id" | "siteKey">> = {},
): VaultEntry {
  return {
    id: crypto.randomUUID(),
    label: options.label || siteKey,
    siteKey,
    domains: [...new Set(options.domains?.length ? options.domains : [siteKey])].sort(),
    login: options.login ?? "",
    counter: 1,
    length: options.length ?? DEFAULT_LENGTH,
    charset: { ...DEFAULT_CHARSET, ...(options.charset ?? {}) },
    // Les entrées naissent en v2 ; la v1 reste lisible pour les anciennes.
    v: options.v ?? 2,
    updatedAt: nowIso(),
  };
}

/** Entrées couvrant ce domaine. Plusieurs = plusieurs comptes sur le site. */
export function findAllByDomain(vault: Vault, domain: string): VaultEntry[] {
  const target = domain.toLowerCase();
  return vault.entries.filter(
    (e) => !e.deleted && e.domains.some((d) => d.toLowerCase() === target),
  );
}

export function findByDomain(vault: Vault, domain: string): VaultEntry | null {
  return findAllByDomain(vault, domain)[0] ?? null;
}

/** Représentation stable, pour départager sans dépendre de l'ordre. */

/**
 * Forme canonique d'une entree, pour departager de façon déterministe.
 *
 * Compacte, clés triées a tous les niveaux, `deleted` faux retire. La forme est
 * fixée par shared/spec/vault-merge.md et non laissée a JSON.stringify : deux
 * appareils qui n'écrivent pas la même chaîne designent un gagnant différent et
 * ne convergent jamais.
 *
 * JSON.stringify avec un tableau de clés ne convient pas : il applique le
 * filtre a tous les niveaux, ce qui vidait `charset`.
 */
export function canonicalJson(entry: VaultEntry): string {
  const stable = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(stable);
    if (value === null || typeof value !== "object") return value;
    const out: Record<string, unknown> = {};
    const record = value as Record<string, unknown>;
    for (const key of Object.keys(record).sort()) {
      if (record[key] !== undefined) out[key] = stable(record[key]);
    }
    return out;
  };

  const normalised: Record<string, unknown> = { ...entry };
  if (!normalised.deleted) delete normalised.deleted;
  return JSON.stringify(stable(normalised));
}

function mergeEntry(left: VaultEntry, right: VaultEntry, conflicts: Conflict[]): VaultEntry {
  // Égalité d'horodatage : on départage sur la représentation canonique.
  // Départager sur la position ne serait pas commutatif — chaque appareil
  // garderait le sien — et l'id ne peut pas servir, les deux entrées portent
  // la même.
  const winner =
    left.updatedAt !== right.updatedAt
      ? left.updatedAt > right.updatedAt
        ? left
        : right
      : canonicalJson(left) <= canonicalJson(right)
        ? left
        : right;

  const merged: VaultEntry = { ...winner };

  // siteKey produit le mot de passe : on ne choisit jamais à la place de
  // l'utilisateur. On garde celui de gauche et on signale.
  if (left.siteKey !== right.siteKey) {
    conflicts.push({
      kind: "sitekey-divergent",
      entryId: left.id,
      detail: `${left.siteKey} vs ${right.siteKey}`,
    });
    merged.siteKey = left.siteKey;
  }

  // Union : une addition de chaque côté ne doit pas en effacer une autre.
  merged.domains = [...new Set([...left.domains, ...right.domains])].sort();

  // Un compteur ne recule pas : une valeur haute signifie déjà renouvelé.
  const high = Math.max(left.counter, right.counter);
  const low = Math.min(left.counter, right.counter);
  merged.counter = high;
  if (high !== low && winner.counter === low) {
    conflicts.push({
      kind: "counter-recul",
      entryId: left.id,
      detail: `le plus recent porte ${low}, on garde ${high}`,
    });
  }

  // Une suppression se propage, sinon l'autre carnet ressusciterait l'entrée.
  if (left.deleted || right.deleted) merged.deleted = true;

  merged.updatedAt = left.updatedAt > right.updatedAt ? left.updatedAt : right.updatedAt;
  return merged;
}

/**
 * Fusionne deux carnets. Commutative et idempotente : l'ordre de
 * synchronisation des appareils ne doit pas changer le résultat.
 */
export function mergeVaults(left: Vault, right: Vault): { vault: Vault; conflicts: Conflict[] } {
  const conflicts: Conflict[] = [];
  const byId = new Map(left.entries.map((e) => [e.id, e]));

  for (const entry of right.entries) {
    const existing = byId.get(entry.id);
    byId.set(entry.id, existing ? mergeEntry(existing, entry, conflicts) : { ...entry });
  }

  const entries = [...byId.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const updatedAt =
    [left.updatedAt ?? "", right.updatedAt ?? "", ...entries.map((e) => e.updatedAt)]
      .filter(Boolean)
      .sort()
      .pop() ?? nowIso();

  return { vault: { schema: VAULT_SCHEMA, updatedAt, entries }, conflicts };
}

/**
 * Le carnet vit dans localStorage : il ne quitte pas le navigateur, comme le
 * reste du produit. Une lecture qui échoue ne doit pas casser la page — mode
 * privé, stockage bloqué — on repart d'un carnet vide.
 */
export function loadVault(): Vault {
  try {
    const raw = localStorage.getItem(VAULT_STORAGE_KEY);
    if (!raw) return emptyVault();
    const vault = JSON.parse(raw) as Vault;
    if (vault.schema !== VAULT_SCHEMA) return emptyVault();
    return vault;
  } catch {
    return emptyVault();
  }
}

export function saveVault(vault: Vault): void {
  try {
    vault.updatedAt = nowIso();
    localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(vault));
  } catch {
    // Stockage indisponible : le mot de passe reste dérivable, seul le
    // carnet ne persiste pas. On ne bloque pas l'utilisateur pour autant.
  }
}
