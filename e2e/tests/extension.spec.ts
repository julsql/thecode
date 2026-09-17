/**
 * Tests de bout en bout de l'extension.
 *
 * Verifient ce qu'aucun test unitaire ne peut voir : que l'extension se charge
 * reellement dans un navigateur, detecte un champ mot de passe, et n'injecte
 * rien tant qu'aucune clef n'est definie.
 *
 * Contrainte de Chrome : une extension ne se charge que dans un contexte
 * persistant et non headless. Le mode --headless=new ne supporte toujours pas
 * --load-extension de facon fiable.
 */
import { test, expect, chromium, type BrowserContext } from "@playwright/test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";

const here = dirname(fileURLToPath(import.meta.url));
const extensionPath = join(here, "..", "..", "apps", "extension");
const loginPage = pathToFileURL(join(here, "..", "fixtures", "login.html")).href;

let context: BrowserContext;

test.beforeAll(async () => {
  context = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), "tc-e2e-")), {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      "--no-sandbox",
    ],
  });
});

test.afterAll(async () => {
  await context?.close();
});

test("l'extension est chargee par le navigateur", async () => {
  // Le service worker MV3 est la preuve que le manifeste a ete accepte : une
  // erreur de manifeste empeche purement et simplement son enregistrement.
  const worker =
    context.serviceWorkers()[0] ??
    (await context.waitForEvent("serviceworker", { timeout: 10_000 }));
  expect(worker.url()).toContain("background.js");
});

test("un menu apparait au focus sur un champ mot de passe", async () => {
  const page = await context.newPage();
  await page.goto(loginPage);

  await page.locator("#pass").focus();

  const menu = page.locator(".pw-suggester-menu");
  await expect(menu).toBeVisible({ timeout: 5_000 });

  await page.close();
});

test("sans clef definie, aucun mot de passe n'est injecte", async () => {
  const page = await context.newPage();
  await page.goto(loginPage);

  await page.locator("#pass").focus();
  await expect(page.locator(".pw-suggester-menu")).toBeVisible({ timeout: 5_000 });

  // Le menu invite a saisir une clef ; il ne doit surtout pas proposer de mot
  // de passe, sans quoi il serait derivable sans secret.
  await expect(page.locator(".pw-suggester-menu")).toContainText(/clef/i);
  await expect(page.locator("#pass")).toHaveValue("");

  await page.close();
});

test("le champ mot de passe reste vide tant que rien n'est clique", async () => {
  const page = await context.newPage();
  await page.goto(loginPage);

  await page.locator("#pass").focus();
  await page.waitForTimeout(500);

  // L'extension propose, elle ne remplit jamais d'elle-meme.
  await expect(page.locator("#pass")).toHaveValue("");

  await page.close();
});
