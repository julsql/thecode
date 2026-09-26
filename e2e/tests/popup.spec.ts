/**
 * Tests de bout en bout de la popup.
 *
 * Verifient ce qu'aucun test unitaire ne peut voir : que la page s'ouvre
 * reellement dans le navigateur, que ses scripts se chargent sans erreur, et
 * que l'empreinte de clef apparait a la saisie.
 */
import { test, expect, chromium, type BrowserContext } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";

const here = dirname(fileURLToPath(import.meta.url));
const extensionPath = join(here, "..", "..", "apps", "extension");

let context: BrowserContext;
let extensionId: string;

test.beforeAll(async () => {
  context = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), "tc-popup-")), {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      "--no-sandbox",
    ],
  });

  const worker =
    context.serviceWorkers()[0] ??
    (await context.waitForEvent("serviceworker", { timeout: 10_000 }));
  extensionId = new URL(worker.url()).host;
});

test.afterAll(async () => {
  await context?.close();
});

test("la popup s'ouvre sans erreur de console", async () => {
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await page.waitForTimeout(500);

  expect(errors).toEqual([]);
  await page.close();
});

test("l'empreinte apparait a la saisie de la clef", async () => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup.html`);

  // Masquee tant qu'aucune clef n'est saisie : rien a identifier.
  await expect(page.locator("#fingerprintRow")).toBeHidden();

  await page.locator("#passphrase").fill("clef");
  // PBKDF2 a 600k iterations prend un moment, volontairement.
  await expect(page.locator("#fingerprintRow")).toBeVisible({ timeout: 10_000 });

  // Meme valeur que le CLI Python et le site : un indicateur qui differe
  // selon l'appareil est un indicateur auquel on ne se fie plus.
  await expect(page.locator("#fingerprint")).toHaveText("KG8");

  await page.close();
});

test("l'ecran principal ne garde que la generation", async () => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup.html`);

  // Clef, identifiant, algorithme : ce qui sert a generer, rien d'autre.
  await expect(page.locator("#passphrase")).toBeVisible();
  await expect(page.locator("#login")).toBeVisible();
  // Enregistrer vit dans le resultat : sans mot de passe genere, rien a
  // enregistrer.
  await expect(page.locator("#saveEntry")).toBeHidden();
  // La synchronisation et les parametres sont passes derriere le rouage.
  await expect(page.locator("#settingsView")).toBeHidden();

  await page.close();
});

test("la synchronisation propose de se connecter, pas de synchroniser", async () => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup.html`);

  // L'annonce de la v2 s'ouvre par-dessus au premier affichage : on la ferme
  // comme le ferait l'utilisatrice.
  // Elle apparait apres une lecture asynchrone du stockage : on l'attend un peu.
  await page
    .locator("#v2NoticeClose")
    .click({ timeout: 3_000 })
    .catch(() => {});
  await page.locator("#openSettings").click();
  await expect(page.locator("#settingsView")).toBeVisible();

  // Sans session, proposer « Synchroniser » donnerait un bouton qui echoue.
  await expect(page.locator("#syncLoginBtn")).toBeVisible();
  await expect(page.locator("#syncLoggedIn")).toBeHidden();

  await page.close();
});

test("une synchronisation sans clef est refusee, pas tentee", async () => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup.html`);

  const refused = await page.evaluate(
    () =>
      new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: "syncNow" }, resolve);
      }),
  );

  // Deriver sans clef maitresse n'aurait aucun sens : on refuse tot, avec un
  // message, plutot que d'echouer au chiffrement.
  expect(refused).toMatchObject({ ok: false });
  expect((refused as { error: string }).error).toMatch(/clef/i);

  await page.close();
});
