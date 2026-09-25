/**
 * Carnet de metadonnees.
 *
 * Le carnet ne contient jamais de mot de passe ni de clef maitresse : seulement
 * de quoi rejouer une derivation. Une fuite revele les sites et les
 * identifiants, pas les mots de passe.
 *
 * Schema : shared/vault.schema.json
 * Regles de fusion : shared/spec/vault-merge.md
 */

const VAULT_SCHEMA = 1;
const VAULT_STORAGE_KEY = "vault";

const VAULT_DEFAULT_CHARSET = { lower: true, upper: true, symbols: true, numbers: true };
const VAULT_DEFAULT_LENGTH = 20;

/**
 * Seule version d'entree admise dans le carnet.
 *
 * La v1 ne subsiste qu'en generation ponctuelle, hors carnet : une entree
 * `v != 2` est ecartee a chaque lecture et ne peut pas etre ecrite.
 * Voir shared/spec/vault-merge.md, « Uniquement des entrées v2 ».
 */
const VAULT_ENTRY_VERSION = 2;

function isV2Entry(entry) {
  return Boolean(entry) && entry.v === VAULT_ENTRY_VERSION;
}

/**
 * Ne garde que les entrees v2, sans erreur : un carnet ancien ou venu d'un
 * autre appareil reste lisible, ses entrees v1 disparaissent simplement.
 */
function keepV2Entries(vault) {
  if (!vault || !Array.isArray(vault.entries)) return vault;
  return { ...vault, entries: vault.entries.filter(isV2Entry) };
}

function nowIso() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

function emptyVault() {
  return { schema: VAULT_SCHEMA, updatedAt: nowIso(), entries: [] };
}

function newEntry(siteKey, options = {}) {
  // Pas d'option `v` : une entree nait toujours en v2.
  const { label, domains, login = "", length = VAULT_DEFAULT_LENGTH, charset } = options;
  return {
    id: crypto.randomUUID(),
    label: label || siteKey,
    siteKey,
    domains: [...new Set(domains && domains.length ? domains : [siteKey])].sort(),
    login,
    counter: 1,
    length,
    charset: { ...VAULT_DEFAULT_CHARSET, ...(charset || {}) },
    v: VAULT_ENTRY_VERSION,
    updatedAt: nowIso(),
  };
}

/** Entrees couvrant ce domaine. Plusieurs = plusieurs comptes sur le site. */
function findAllByDomain(vault, domain) {
  const target = String(domain).toLowerCase();
  return (vault.entries || []).filter(
    (e) => !e.deleted && e.domains.some((d) => d.toLowerCase() === target),
  );
}

function findByDomain(vault, domain) {
  return findAllByDomain(vault, domain)[0] || null;
}

/** Representation stable, pour departager sans dependre de l'ordre. */

/**
 * Forme canonique d'une entree, pour departager de facon deterministe.
 *
 * Compacte, cles triees a tous les niveaux, `deleted` faux retire. La forme est
 * fixee par shared/spec/vault-merge.md et non laissee a JSON.stringify : deux
 * appareils qui n'ecrivent pas la meme chaine designent un gagnant different et
 * ne convergent jamais.
 *
 * JSON.stringify avec un tableau de cles ne convient pas : il applique le
 * filtre a tous les niveaux, ce qui vidait `charset`.
 */
function canonicalJson(entry) {
  const stable = (value) => {
    if (Array.isArray(value)) return value.map(stable);
    if (value === null || typeof value !== "object") return value;
    const out = {};
    for (const key of Object.keys(value).sort()) {
      if (value[key] !== undefined) out[key] = stable(value[key]);
    }
    return out;
  };

  const normalised = { ...entry };
  if (!normalised.deleted) delete normalised.deleted;
  return JSON.stringify(stable(normalised));
}

function mergeEntry(left, right, conflicts) {
  // Egalite d'horodatage : on departage sur la representation canonique.
  // Departager sur la position ne serait pas commutatif — chaque appareil
  // garderait le sien — et l'id ne peut pas servir, les deux entrees portent
  // la meme.
  let winner;
  if (left.updatedAt !== right.updatedAt) {
    winner = left.updatedAt > right.updatedAt ? left : right;
  } else {
    winner = canonicalJson(left) <= canonicalJson(right) ? left : right;
  }

  const merged = { ...winner };

  // siteKey produit le mot de passe : on ne choisit jamais a la place de
  // l'utilisateur. On garde celui de gauche et on signale.
  if (left.siteKey !== right.siteKey) {
    conflicts.push({
      kind: "sitekey-divergent",
      entryId: left.id,
      detail: `${left.siteKey} vs ${right.siteKey}`,
    });
    merged.siteKey = left.siteKey;
  }

  // Union : une addition de chaque cote ne doit pas en effacer une autre.
  merged.domains = [...new Set([...(left.domains || []), ...(right.domains || [])])].sort();

  // Un compteur ne recule pas : une valeur haute signifie deja renouvele.
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

  // Une suppression se propage, sinon l'autre carnet ressusciterait l'entree.
  if (left.deleted || right.deleted) merged.deleted = true;

  merged.updatedAt = left.updatedAt > right.updatedAt ? left.updatedAt : right.updatedAt;
  return merged;
}

/**
 * Fusionne deux carnets. Commutative et idempotente : l'ordre de
 * synchronisation des appareils ne doit pas changer le resultat.
 */
function mergeVaults(left, right) {
  const conflicts = [];
  // Filet : ce qui sort d'une fusion est ecrit, et rien de v1 ne doit l'etre.
  const byId = new Map((left.entries || []).filter(isV2Entry).map((e) => [e.id, e]));

  for (const entry of (right.entries || []).filter(isV2Entry)) {
    const existing = byId.get(entry.id);
    byId.set(entry.id, existing ? mergeEntry(existing, entry, conflicts) : { ...entry });
  }

  const entries = [...byId.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const updatedAt = [
    left.updatedAt || "",
    right.updatedAt || "",
    ...entries.map((e) => e.updatedAt),
  ]
    .filter(Boolean)
    .sort()
    .pop();

  return { vault: { schema: VAULT_SCHEMA, updatedAt: updatedAt || nowIso(), entries }, conflicts };
}

async function loadVault(storage) {
  if (!storage) return emptyVault();
  try {
    const stored = await storage.get([VAULT_STORAGE_KEY]);
    const vault = stored?.[VAULT_STORAGE_KEY];
    if (!vault) return emptyVault();
    if (vault.schema !== VAULT_SCHEMA) {
      console.error("TheCode: carnet en version", vault.schema, "attendu", VAULT_SCHEMA);
      return emptyVault();
    }
    return keepV2Entries(vault);
  } catch (e) {
    console.error("TheCode: echec de la lecture du carnet", e);
    return emptyVault();
  }
}

async function saveVault(storage, vault) {
  if (!storage) return vault;
  vault.updatedAt = nowIso();
  try {
    await storage.set({ [VAULT_STORAGE_KEY]: vault });
  } catch (e) {
    console.error("TheCode: echec de l'ecriture du carnet", e);
  }
  return vault;
}

if (typeof module !== "undefined") {
  module.exports = {
    VAULT_SCHEMA,
    VAULT_STORAGE_KEY,
    VAULT_DEFAULT_CHARSET,
    VAULT_DEFAULT_LENGTH,
    VAULT_ENTRY_VERSION,
    isV2Entry,
    keepV2Entries,
    emptyVault,
    newEntry,
    findByDomain,
    findAllByDomain,
    mergeVaults,
    loadVault,
    saveVault,
    // Interne, expose pour le test contre la fixture partagee : la forme
    // canonique doit etre identique dans les cinq implementations.
    __canonicalJson: canonicalJson,
  };
}
