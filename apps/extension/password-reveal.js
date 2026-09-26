/**
 * Mot de passe genere, masque par defaut.
 *
 * Le masque a une longueur fixe : un nombre de points egal a la longueur
 * trahirait celle-ci a quiconque regarde l'ecran. Chaque nouvelle generation
 * repart masquee, et la copie copie toujours la vraie valeur.
 */

const PASSWORD_MASK = "•".repeat(10);

/**
 * Relie l'affichage (`output`) au bouton Voir / Cacher (`toggle`).
 *
 * `labels` donne les libelles { show, hide } deja traduits.
 */
function bindPasswordReveal(output, toggle, labels) {
  let value = "";
  let shown = false;

  function render() {
    output.textContent = value ? (shown ? value : PASSWORD_MASK) : "";
    toggle.textContent = shown ? labels.hide : labels.show;
    toggle.setAttribute("aria-pressed", String(shown));
  }

  toggle.addEventListener("click", () => {
    shown = !shown;
    render();
  });

  render();

  return {
    /** Nouveau mot de passe : toujours affiche masque. */
    set(password) {
      value = password || "";
      shown = false;
      render();
    },
    /** La vraie valeur, pour la copie. */
    value: () => value,
  };
}

if (typeof module !== "undefined") {
  module.exports = { PASSWORD_MASK, bindPasswordReveal };
}
