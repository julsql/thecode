/**
 * Identifiant du compte : appariement et préremplissage depuis le carnet.
 */
import { describe, it, expect } from "vitest";
import { findByLogin, loginToPrefill, newEntry } from "@/vault";

const perso = newEntry("google.com", { login: "moi" });
const pro = newEntry("google.com", { login: "pro" });
const sans = newEntry("google.com");

describe("findByLogin", () => {
  it("apparie sur l'identifiant exact", () => {
    expect(findByLogin([perso, pro], "pro")).toBe(pro);
    expect(findByLogin([perso, pro], "Pro")).toBeNull();
  });

  it("apparie la saisie vide sur une entrée sans identifiant", () => {
    const { login: _omit, ...legacy } = sans;
    expect(findByLogin([perso, sans], "")).toBe(sans);
    expect(findByLogin([legacy], "")).toStrictEqual(legacy);
    expect(findByLogin([perso], "")).toBeNull();
  });
});

describe("loginToPrefill", () => {
  it("reprend l'identifiant de la première entrée du site", () => {
    expect(loginToPrefill([perso, pro], "")).toBe("moi");
  });

  it("ne touche pas à un identifiant déjà saisi", () => {
    expect(loginToPrefill([perso, pro], "autre")).toBeNull();
  });

  it("laisse vide quand une entrée sans identifiant existe", () => {
    // Elle correspond déjà à la saisie vide : c'est le comportement d'avant.
    expect(loginToPrefill([perso, sans], "")).toBeNull();
  });

  it("laisse vide pour un site inconnu", () => {
    expect(loginToPrefill([], "")).toBeNull();
  });
});
