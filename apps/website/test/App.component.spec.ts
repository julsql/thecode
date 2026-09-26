/**
 * Ouvert depuis une app (?from=app), le site ne montre pas les tarifs : les
 * stores interdisent d'orienter vers un paiement hors de chez eux.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createRouter, createMemoryHistory } from "vue-router";
import { defineComponent } from "vue";
import App from "@/App.vue";

const Empty = defineComponent({ template: "<div />" });

async function mountAt(path: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/:lang/:page?", component: Empty }],
  });
  router.push(path);
  await router.isReady();
  const wrapper = mount(App, { global: { plugins: [router] } });
  await flushPromises();
  return { wrapper, router };
}

const pricingLinks = (w: Awaited<ReturnType<typeof mountAt>>["wrapper"]) =>
  w.findAll("a").filter((a) => (a.attributes("href") || "").includes("pricing"));

describe("liens vers les tarifs", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("hors ligne"))),
    );
  });

  it("sont visibles sur le site", async () => {
    const { wrapper } = await mountAt("/fr/account");
    expect(pricingLinks(wrapper).length).toBeGreaterThan(0);
  });

  it("disparaissent quand le site est ouvert depuis une app, pour toute la session", async () => {
    const { wrapper, router } = await mountAt("/fr/account?from=app");
    expect(pricingLinks(wrapper)).toHaveLength(0);

    await router.push("/fr/about");
    await flushPromises();
    expect(pricingLinks(wrapper)).toHaveLength(0);
  });
});
