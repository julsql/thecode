/**
 * Chargement du script d'Apple : à la demande, dans la langue du site, et
 * sans bruit quand il échoue.
 */
import { describe, it, expect } from "vitest";
import { appleScriptUrl, setupAppleSignIn, sha256Hex } from "@/apple";

describe("Apple", () => {
  it("charge le script dans la langue du site", () => {
    expect(appleScriptUrl("fr")).toContain("/fr_FR/appleid.auth.js");
    expect(appleScriptUrl("en")).toContain("/en_US/appleid.auth.js");
  });

  it("ne charge rien sans Services ID", async () => {
    expect(await setupAppleSignIn("", "fr")).toBeNull();
    expect(document.querySelector("script[src*='appleid']")).toBeNull();
  });

  it("renonce en silence quand le script ne se charge pas", async () => {
    const pending = setupAppleSignIn("fr.julsql.thecode.web", "fr");
    const script = document.querySelector<HTMLScriptElement>("script[src*='appleid']");
    expect(script?.src).toContain("fr_FR");

    script!.dispatchEvent(new Event("error"));
    expect(await pending).toBeNull();
  });

  it("hache le nonce en SHA-256 hexadécimal", async () => {
    expect(await sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});
