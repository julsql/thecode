/**
 * Vecteurs de non-régression des primitives v2 (KDF, HMAC, rendu).
 *
 * Valeurs figées avec l'implémentation existante (et recoupées avec le hmac de
 * Python pour la graine) : tout changement de typage autour des BufferSource
 * WebCrypto doit les laisser intactes. Le cas « vue décalée » garde que seuls
 * les octets de la vue sont lus, et non tout le buffer sous-jacent.
 */
import { describe, it, expect } from "vitest";
import { deriveMasterKeyV2, generatePasswordV2, seedV2 } from "@/coreV2";

const hex = (bytes: Uint8Array) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

const ZERO = new Uint8Array(32);
const SEQ = Uint8Array.from({ length: 32 }, (_, i) => i);
// Vue de 32 octets à l'offset 8 d'un buffer de 48 : byteOffset non nul.
const VIEW = new Uint8Array(Uint8Array.from({ length: 48 }, (_, i) => 255 - i).buffer, 8, 32);

describe("deriveMasterKeyV2", () => {
  it("rend la clef PBKDF2 attendue (ASCII)", async () => {
    expect(hex(await deriveMasterKeyV2("correct horse battery staple"))).toBe(
      "71f417969d2544ff197b78bfa90e3bbd158a5f621b2282abd0e353a02c0758a8",
    );
  });

  it("rend la clef PBKDF2 attendue (UTF-8 non ASCII)", async () => {
    expect(hex(await deriveMasterKeyV2("clé-ÉTÉ ☃"))).toBe(
      "98445806b44a7fa9febedb4ac02b895a60678f086577f2130d53c239ac05ce1d",
    );
  });
});

describe("seedV2", () => {
  it.each([
    [
      "clef nulle",
      ZERO,
      "google.com",
      "",
      1,
      "d467f06f50a786a68080c9c5025dd5bb72d39213583fb940a454dcc073393026",
    ],
    [
      "login et compteur",
      SEQ,
      "example.org",
      "alice@example.org",
      3,
      "1dd8dde4f2e222936bd03d8edc5717c110d88b404c409ae673d22d0d48490243",
    ],
    [
      "vue décalée",
      VIEW,
      "bücher.de",
      "",
      1,
      "ab2011d18cfd45b9aa5e428cf1e0d8c212a66675a7975b2086f65da4d811de03",
    ],
  ])("%s", async (_label, master, site, login, counter, expected) => {
    expect((await seedV2(master, site, login, counter)).toString(16)).toBe(expected);
  });

  it("enchaîne KDF et HMAC", async () => {
    const master = await deriveMasterKeyV2("correct horse battery staple");
    expect((await seedV2(master, "github.com", "jul", 2)).toString(16)).toBe(
      "c063d8593214bee8d88adc74ec83d5bb643bbdd808e4a81bad6b3c3c1492196a",
    );
  });
});

describe("generatePasswordV2 avec clef déjà dérivée", () => {
  it("utilise la clef fournie", async () => {
    expect(await generatePasswordV2("google.com", "ignored", 20, { master: SEQ })).toBe(
      "tel&7bgJo9tfn>vY31gl",
    );
  });

  it("lit uniquement les octets de la vue", async () => {
    const got = await generatePasswordV2("example.org", "ignored", 12, {
      master: VIEW,
      useSymbols: false,
      login: "bob",
      counter: 7,
    });
    expect(got).toBe("TKd5AA4bLgx5");
  });

  it("dérive la clef quand aucune n'est fournie", async () => {
    expect(
      await generatePasswordV2("github.com", "correct horse battery staple", 16, {
        login: "jul",
        counter: 2,
      }),
    ).toBe("u8Q7oyOI:*d1hbkM");
  });
});
