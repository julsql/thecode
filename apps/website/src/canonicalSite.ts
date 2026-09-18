/**
 * Canonicalisation d'une saisie en domaine enregistrable.
 *
 * Le champ « site » est libre : on ne canonicalise que ce qui ressemble à un
 * hôte. Un libellé personnel (« serveur perso ») est rendu tel quel, sinon on
 * changerait le mot de passe de quelqu'un qui s'en sert comme d'une étiquette.
 *
 * Équivalent strict de registrableDomain côté extension, Swift et Java : c'est
 * ce qui garantit qu'un même compte donne le même mot de passe partout.
 */

let suffixes: Set<string> | null = null;

/** Charge la Public Suffix List. À appeler avant toute canonicalisation. */
export function loadPublicSuffixList(content: string): void {
  suffixes = new Set(
    content
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("//")),
  );
}

export function isPublicSuffixListLoaded(): boolean {
  return suffixes !== null && suffixes.size > 0;
}

/** Retire ce qui entoure l'hôte dans une URL saisie au clavier. */
function extractHostname(input: string): string {
  let v = input.trim().toLowerCase();
  v = v.replace(/^[a-z][a-z0-9+.-]*:\/\//, ""); // schéma
  v = v.replace(/^[^/@]*@/, ""); // userinfo
  v = v.split("/")[0].split("?")[0].split("#")[0]; // chemin, query, fragment
  v = v.split(":")[0]; // port
  return v.replace(/^www\./, "");
}

export function registrableDomain(hostname: string, list: Set<string>): string {
  const parts = String(hostname).toLowerCase().split(".");

  for (let i = 0; i < parts.length; i++) {
    const candidate = parts.slice(i).join(".");
    if (list.has(candidate)) {
      // i === 0 : l'hôte EST un suffixe public (github.io, co.uk). On ne peut
      // pas remonter d'un cran, on le rend tel quel.
      if (i === 0) return parts.join(".");
      return parts.slice(i - 1).join(".");
    }
  }
  return parts.join(".");
}

/**
 * Canonicalise une saisie. Une valeur sans point, ou la liste non chargée,
 * ressort inchangée : mieux vaut ne rien transformer que transformer mal.
 */
export function canonicalSite(input: string): string {
  if (!input) return "";
  const host = extractHostname(input);
  if (!host.includes(".")) return host;
  if (!suffixes || suffixes.size === 0) return host;
  return registrableDomain(host, suffixes);
}
