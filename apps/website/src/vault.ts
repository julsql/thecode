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
/** Seule version admise dans le carnet : la v1 ne vit plus qu'hors carnet. */
export const VAULT_ENTRY_VERSION = 2;
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
  /** Absent des entrées antérieures au champ : `updatedAt` en tient lieu. */
  createdAt?: string;
  updatedAt: string;
  deleted?: boolean;
}

export interface Vault {
  schema: number;
  updatedAt?: string;
  entries: VaultEntry[];
}

export interface Conflict {
  kind: "sitekey-divergent" | "counter-recul" | "doublon";
  entryId: string;
  detail: string;
}

function nowIso(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

export function emptyVault(): Vault {
  return { schema: VAULT_SCHEMA, updatedAt: nowIso(), entries: [] };
}

/** Vrai pour une entrée que le carnet accepte, c'est-à-dire en v2. */
export function isVaultEntryV2(entry: unknown): entry is VaultEntry {
  return (
    typeof entry === "object" &&
    entry !== null &&
    (entry as { v?: unknown }).v === VAULT_ENTRY_VERSION
  );
}

/**
 * Écarte toute entrée `v ≠ 2`, sans erreur.
 *
 * Appliqué à chaque lecture (stockage local, import, synchronisation) et à
 * chaque écriture : une entrée v1 qui passerait par un seul de ces chemins
 * reviendrait dans le carnet. Voir shared/spec/vault-merge.md.
 */
export function keepV2Only<T extends { entries?: unknown }>(vault: T): T {
  if (!Array.isArray(vault.entries)) return vault;
  return { ...vault, entries: vault.entries.filter(isVaultEntryV2) };
}

export function newEntry(
  siteKey: string,
  options: Partial<Omit<VaultEntry, "id" | "siteKey" | "v">> = {},
): VaultEntry {
  const now = nowIso();
  return {
    id: crypto.randomUUID(),
    label: options.label || siteKey,
    siteKey,
    domains: [...new Set(options.domains?.length ? options.domains : [siteKey])].sort(),
    login: options.login ?? "",
    counter: 1,
    length: options.length ?? DEFAULT_LENGTH,
    charset: { ...DEFAULT_CHARSET, ...(options.charset ?? {}) },
    // Toujours v2 : le carnet n'accepte pas d'autre version.
    v: VAULT_ENTRY_VERSION,
    createdAt: now,
    updatedAt: now,
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

/**
 * Entrée d'un même site portant cet identifiant, telle que saisie.
 *
 * Un identifiant absent vaut chaîne vide : c'est ce qu'il vaut dans la
 * dérivation v2.
 */
export function findByLogin(entries: VaultEntry[], login: string): VaultEntry | null {
  return entries.find((e) => (e.login ?? "") === login) ?? null;
}

/**
 * Identifiant à proposer quand l'utilisateur n'en a saisi aucun.
 *
 * Null si un identifiant est déjà saisi, si le site est inconnu, ou si une
 * entrée sans identifiant existe : elle correspond déjà à la saisie vide.
 * Sinon, celui de la première entrée du site.
 */
export function loginToPrefill(entries: VaultEntry[], login: string): string | null {
  if (login || !entries.length || entries.some((e) => !e.login)) return null;
  return entries[0]?.login ?? null;
}

/** Entrées visibles dans l'écran de gestion : tout sauf les pierres tombales. */
export function liveEntries(vault: Vault): VaultEntry[] {
  return vault.entries.filter((e) => !e.deleted);
}

/**
 * Supprime une entrée en posant une pierre tombale.
 *
 * L'entrée reste dans le carnet, `deleted = true` et rehorodatée : effacée
 * pour de bon, l'autre appareil la ressusciterait à la synchronisation
 * suivante. Voir shared/spec/vault-merge.md.
 */
export function tombstoneEntry(vault: Vault, id: string, now = nowIso()): boolean {
  const entry = vault.entries.find((e) => e.id === id && !e.deleted);
  if (!entry) return false;
  entry.deleted = true;
  entry.updatedAt = now;
  return true;
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

  // Une entrée n'est créée qu'une fois : la date la plus ancienne est la
  // vraie. Un carnet antérieur au champ ne doit pas l'effacer.
  const created = [left.createdAt, right.createdAt].filter((d): d is string => Boolean(d)).sort();
  if (created.length) merged.createdAt = created[0];
  else delete merged.createdAt;

  merged.updatedAt = left.updatedAt > right.updatedAt ? left.updatedAt : right.updatedAt;
  return merged;
}

/**
 * Signale les doublons que la fusion rapproche : le même compte créé à part
 * sur deux appareils, donc sous deux id. Un doublon déjà présent d'un côté
 * l'a été quand il y est entré — le resignaler à chaque fusion serait du bruit.
 */
function findDuplicates(
  entries: VaultEntry[],
  leftIds: Set<string>,
  rightIds: Set<string>,
  conflicts: Conflict[],
) {
  const live = entries.filter((e) => !e.deleted);
  for (let i = 0; i < live.length; i += 1) {
    for (let j = i + 1; j < live.length; j += 1) {
      const a = live[i];
      const b = live[j];
      const apart =
        (leftIds.has(a.id) && !rightIds.has(a.id) && rightIds.has(b.id) && !leftIds.has(b.id)) ||
        (rightIds.has(a.id) && !leftIds.has(a.id) && leftIds.has(b.id) && !rightIds.has(b.id));
      if (!apart || (a.login ?? "") !== (b.login ?? "")) continue;
      const domains = new Set(a.domains.map((d) => d.toLowerCase()));
      if (!b.domains.some((d) => domains.has(d.toLowerCase()))) continue;
      conflicts.push({ kind: "doublon", entryId: a.id, detail: b.id });
    }
  }
}

/**
 * Fusionne deux carnets. Commutative et idempotente : l'ordre de
 * synchronisation des appareils ne doit pas changer le résultat.
 */
export function mergeVaults(left: Vault, right: Vault): { vault: Vault; conflicts: Conflict[] } {
  const conflicts: Conflict[] = [];
  const leftEntries = keepV2Only(left).entries;
  const rightEntries = keepV2Only(right).entries;
  const byId = new Map(leftEntries.map((e) => [e.id, e]));

  for (const entry of rightEntries) {
    const existing = byId.get(entry.id);
    byId.set(entry.id, existing ? mergeEntry(existing, entry, conflicts) : { ...entry });
  }

  const entries = [...byId.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  findDuplicates(
    entries,
    new Set(leftEntries.map((e) => e.id)),
    new Set(rightEntries.map((e) => e.id)),
    conflicts,
  );
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
    return keepV2Only(vault);
  } catch {
    return emptyVault();
  }
}

export function saveVault(vault: Vault): void {
  try {
    vault.updatedAt = nowIso();
    // Refus à l'écriture : une entrée v1 ne rejoint jamais le stockage.
    localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(keepV2Only(vault)));
  } catch {
    // Stockage indisponible : le mot de passe reste dérivable, seul le
    // carnet ne persiste pas. On ne bloque pas l'utilisateur pour autant.
  }
}

/**
 * Ce qui part au serveur quand le compte a un plafond, et ce qui reste sur
 * l'appareil. Voir shared/spec/vault-sync.md, « Synchronisation partielle ».
 *
 * Ce qui est déjà sur le serveur part toujours, pierres tombales comprises :
 * une modification doit pouvoir partir. Les places libres vont aux autres
 * entrées, les plus anciennes d'abord. Une entrée jamais synchronisée puis
 * supprimée n'a rien à propager.
 */
export function selectForPush(
  vault: Vault,
  remoteIds: Iterable<string>,
  maxEntries: number,
): { push: VaultEntry[]; localOnly: VaultEntry[] } {
  const remote = new Set(remoteIds);
  const onServer = vault.entries.filter((e) => remote.has(e.id));
  const others = vault.entries
    .filter((e) => !remote.has(e.id) && !e.deleted)
    .sort((a, b) => {
      const da = a.createdAt ?? a.updatedAt;
      const db = b.createdAt ?? b.updatedAt;
      if (da !== db) return da < db ? -1 : 1;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });

  const free = Math.max(0, maxEntries - onServer.filter((e) => !e.deleted).length);
  const byId = (a: VaultEntry, b: VaultEntry) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  return {
    push: [...onServer, ...others.slice(0, free)].sort(byId),
    localOnly: others.slice(free).sort(byId),
  };
}
