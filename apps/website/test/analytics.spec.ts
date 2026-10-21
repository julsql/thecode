import { describe, it, expect, beforeEach, vi } from "vitest";
import { createRouter, createMemoryHistory } from "vue-router";
import { defineComponent } from "vue";
import {
  UMAMI_SRC,
  installAnalytics,
  isTrackedPath,
  loadTracker,
  trackerLoaded,
} from "@/analytics";

const Empty = defineComponent({ render: () => null });

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/:pathMatch(.*)*", component: Empty }],
  });
}

describe("analytics", () => {
  beforeEach(() => {
    document.head.innerHTML = "";
  });

  it("never tracks pages handling secrets", () => {
    for (const p of [
      "/en/generate",
      "/fr/vault",
      "/legacy",
      "/en/legacy",
      "/en/account",
      "/fr/account/reset",
      "/en/account/verify",
    ]) {
      expect(isTrackedPath(p), p).toBe(false);
    }
    for (const p of ["/en", "/fr/about", "/en/pricing", "/en/tutorial", "/fr/privacy"]) {
      expect(isTrackedPath(p), p).toBe(true);
    }
  });

  it("injects the Umami tag once with the expected attributes", () => {
    loadTracker();
    loadTracker();
    const scripts = document.head.querySelectorAll(`script[src="${UMAMI_SRC}"]`);
    expect(scripts).toHaveLength(1);
    const s = scripts[0] as HTMLScriptElement;
    expect(s.defer).toBe(true);
    expect(s.dataset.websiteId).toBe("8f00c79a-c8d8-4322-979e-4c99846608fa");
    expect(s.dataset.domains).toBe("thecode.julsql.fr");
  });

  it("does not load the tracker when landing on a sensitive page", async () => {
    const router = makeRouter();
    const reload = vi.fn();
    installAnalytics(router, document, reload);
    await router.push("/en/vault");
    expect(trackerLoaded()).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it("reloads instead of navigating in-app to a sensitive page once loaded", async () => {
    const router = makeRouter();
    const reload = vi.fn();
    installAnalytics(router, document, reload);
    await router.push("/en");
    expect(trackerLoaded()).toBe(true);
    await router.push("/en/about");
    expect(router.currentRoute.value.path).toBe("/en/about");
    await router.push("/en/generate");
    expect(reload).toHaveBeenCalledWith("/en/generate");
    expect(router.currentRoute.value.path).toBe("/en/about");
  });
});
