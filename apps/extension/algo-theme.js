/**
 * Theme de la popup selon l'algorithme choisi : bleu en v2, rose en v1.
 *
 * La v1 ne sert qu'en secours : la couleur signale d'un coup d'oeil qu'on
 * n'est pas sur l'algorithme par defaut. popup.css echange les variables
 * d'accent selon `data-algo` sur <html>.
 */

/** Pose `data-algo` ("v1" ou "v2") sur l'element racine. */
function applyAlgoTheme(root, version) {
  root.dataset.algo = version === 1 ? "v1" : "v2";
}

/** Suit le groupe de boutons radio de version, et applique l'etat initial. */
function bindAlgoTheme(group, root) {
  const current = () => (group.querySelector("input:checked")?.value === "1" ? 1 : 2);
  group.addEventListener("change", () => applyAlgoTheme(root, current()));
  applyAlgoTheme(root, current());
}

if (typeof module !== "undefined") {
  module.exports = { applyAlgoTheme, bindAlgoTheme };
}
