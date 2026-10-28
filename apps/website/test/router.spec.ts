/**
 * Adresse du carnet : une rubrique du compte. L'ancienne adresse, du temps où
 * il avait son onglet, y mène toujours.
 */
import { describe, it, expect } from "vitest";
import router from "@/router";
import Vault from "@/pages/Vault.vue";

describe("adresse du carnet", () => {
  it("vit sous le compte", () => {
    const route = router.resolve("/fr/account/vault");
    expect(route.matched.at(-1)?.components?.default).toBe(Vault);
  });

  it("redirige l'ancienne adresse, dans la langue demandée", async () => {
    await router.push("/en/vault");
    expect(router.currentRoute.value.path).toBe("/en/account/vault");
    await router.push("/vault");
    expect(router.currentRoute.value.path).toMatch(/^\/(en|fr)\/account\/vault$/);
  });
});
