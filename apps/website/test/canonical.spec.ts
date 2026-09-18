/**
 * Canonicalisation des hostnames, verifiee contre le referentiel partage.
 *
 * Fichier synchronise depuis shared/ ; ne jamais l'editer directement.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { registrableDomain, canonicalSite, loadPublicSuffixList } from "@/canonicalSite";

const here = dirname(fileURLToPath(import.meta.url));
const spec = JSON.parse(readFileSync(join(here, "canonical-site-cases.json"), "utf8"));
const pslText = readFileSync(join(here, "..", "public", "public_suffix_list.dat"), "utf8");

const PSL = new Set(
  pslText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("//")),
);

loadPublicSuffixList(pslText);

const IMPL = "website";

describe("canonicalisation (referentiel partage)", () => {
  it("lit bien le referentiel", () => {
    expect(spec.schema).toBe(1);
    expect(spec.cases.length).toBeGreaterThan(0);
  });

  it.each(spec.cases.map((c: any) => [c.id, c]))("%s", (_id: string, c: any) => {
    const want = c.divergences?.[IMPL] ?? c.expected;
    expect(registrableDomain(c.hostname, PSL)).toBe(want);
  });
});

describe("saisie libre", () => {
  it("extrait l'hote d'une URL complete", () => {
    expect(canonicalSite("https://www.google.com/login?next=/x")).toBe("google.com");
    expect(canonicalSite("HTTPS://WWW.Example.FR")).toBe("example.fr");
    expect(canonicalSite("https://user@example.com:8443/foo")).toBe("example.com");
  });

  it("respecte les suffixes multi-niveaux", () => {
    expect(canonicalSite("shop.example.co.uk")).toBe("example.co.uk");
    expect(canonicalSite("foo.github.io")).toBe("foo.github.io");
  });

  // Le champ est libre : quelqu'un peut s'en servir comme d'une etiquette.
  // Transformer ces valeurs changerait son mot de passe.
  it("laisse intacte une valeur qui n'est pas un hote", () => {
    expect(canonicalSite("serveur perso")).toBe("serveur perso");
    expect(canonicalSite("banque")).toBe("banque");
  });

  it("rend une chaine vide pour une saisie vide", () => {
    expect(canonicalSite("")).toBe("");
  });
});
