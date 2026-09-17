import { defineConfig } from "@playwright/test";

// L'extension ne se charge que dans un Chromium persistant et non headless :
// c'est une contrainte de Chrome, pas un choix. En CI, xvfb fournit l'affichage.
export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? "list" : "html",
  timeout: 30_000,
  use: { trace: "retain-on-failure" },
});
