/**
 * Mot de passe genere masque par defaut dans la popup.
 */
const fs = require("node:fs");
const path = require("node:path");
const { PASSWORD_MASK, bindPasswordReveal } = require("../password-reveal");

const labels = { show: "Voir", hide: "Cacher" };

function fakeElement() {
  const listeners = [];
  const attrs = {};
  return {
    textContent: "",
    setAttribute: (name, value) => (attrs[name] = value),
    getAttribute: (name) => attrs[name],
    addEventListener: (type, fn) => type === "click" && listeners.push(fn),
    click: () => listeners.forEach((fn) => fn()),
  };
}

function setup() {
  const output = fakeElement();
  const toggle = fakeElement();
  const reveal = bindPasswordReveal(output, toggle, labels);
  return { output, toggle, reveal };
}

describe("mot de passe masque", () => {
  const sample = "fixture-abcdefghijklmnopqrstuvwxyz";

  it("masque par un nombre fixe de points, quelle que soit la longueur", () => {
    const { output, reveal } = setup();
    reveal.set(sample);
    expect(output.textContent).toBe(PASSWORD_MASK);
    reveal.set(sample.slice(0, 4));
    expect(output.textContent).toBe(PASSWORD_MASK);
    expect(PASSWORD_MASK).toBe("•".repeat(10));
  });

  it("revele puis recache, avec aria-pressed et le bon libelle", () => {
    const { output, toggle, reveal } = setup();
    reveal.set(sample);
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    expect(toggle.textContent).toBe("Voir");

    toggle.click();
    expect(output.textContent).toBe(sample);
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
    expect(toggle.textContent).toBe("Cacher");

    toggle.click();
    expect(output.textContent).toBe(PASSWORD_MASK);
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
  });

  it("repart masque a chaque nouvelle generation", () => {
    const { output, toggle, reveal } = setup();
    reveal.set(sample);
    toggle.click();
    reveal.set(`${sample}-2`);
    expect(output.textContent).toBe(PASSWORD_MASK);
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
  });

  it("garde la vraie valeur pour la copie", () => {
    const { reveal } = setup();
    reveal.set(sample);
    expect(reveal.value()).toBe(sample);
  });

  it("n'affiche rien sans mot de passe", () => {
    const { output, reveal } = setup();
    reveal.set("");
    expect(output.textContent).toBe("");
  });
});

describe("popup : un seul point d'enregistrement, a cote du mot de passe", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "popup.html"), "utf8");

  it("charge le masque avant popup.js", () => {
    expect(html.indexOf('src="password-reveal.js"')).toBeGreaterThan(-1);
    expect(html.indexOf('src="password-reveal.js"')).toBeLessThan(html.indexOf('src="popup.js"'));
  });

  it("place Enregistrer dans la ligne du mot de passe, une seule fois", () => {
    const line = html.match(/<dd class="password-line">([\s\S]*?)<\/dd>/)[1];
    expect(line).toMatch(/id="copyPasswordBtn"/);
    expect(line).toMatch(/id="togglePassword"[\s\S]*aria-pressed="false"/);
    expect(line).toMatch(/id="saveEntry"/);
    expect(html.match(/id="saveEntry"/g)).toHaveLength(1);
  });
});
