/**
 * Theme de la popup : rose en v1, bleu en v2, via data-algo sur <html>.
 */
const fs = require("node:fs");
const path = require("node:path");
const { applyAlgoTheme, bindAlgoTheme } = require("../algo-theme");

/** Groupe radio minimal : la valeur cochee et l'ecoute de `change`. */
function fakeGroup(checked) {
  const listeners = [];
  const group = {
    checked,
    querySelector: () => ({ value: group.checked }),
    addEventListener: (type, fn) => type === "change" && listeners.push(fn),
    select(value) {
      group.checked = value;
      listeners.forEach((fn) => fn());
    },
  };
  return group;
}

describe("theme selon l'algorithme", () => {
  it("pose v1 ou v2 sur la racine", () => {
    const root = { dataset: {} };
    applyAlgoTheme(root, 1);
    expect(root.dataset.algo).toBe("v1");
    applyAlgoTheme(root, 2);
    expect(root.dataset.algo).toBe("v2");
  });

  it("part en v2, passe en v1 quand on la choisit, et revient", () => {
    const root = { dataset: {} };
    const group = fakeGroup("2");
    bindAlgoTheme(group, root);
    expect(root.dataset.algo).toBe("v2");

    group.select("1");
    expect(root.dataset.algo).toBe("v1");

    group.select("2");
    expect(root.dataset.algo).toBe("v2");
  });

  it("redefinit l'accent v1 en clair et en sombre", () => {
    const css = fs.readFileSync(path.join(__dirname, "..", "popup.css"), "utf8");
    const blocks = css.match(/:root\[data-algo="v1"\]\s*\{[^}]*\}/g) || [];
    expect(blocks).toHaveLength(2);
    blocks.forEach((b) => expect(b).toMatch(/--accent:/));
  });
});
