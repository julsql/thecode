if (typeof browser === "undefined") {
  var browser = chrome;
}

/**
 * Message traduit, dans la langue du navigateur. `values` remplit $1, $2… ;
 * le francais sert de secours quand l'API manque (tests).
 */
function msg(key, fallback, ...values) {
  const subs = values.map(String);
  const text = browser?.i18n?.getMessage?.(key, subs.length ? subs : undefined);
  return text || subs.reduce((out, v, i) => out.replace(`$${i + 1}`, v), fallback);
}

/**
 * Texte du menu quand aucun mot de passe n'est propose. Session verrouillee
 * (shared/spec/vault-lock.md) : la clef est la mais inutilisable, il faut
 * ouvrir l'extension pour la ressaisir. Sinon, aucune clef n'est definie.
 */
function menuNotice(response) {
  if (response?.locked) {
    return msg(
      "content_locked",
      "TheCode est verrouillé : ouvrez l'extension pour le déverrouiller",
    );
  }
  return msg("content_no_key", "Aucune clef n'est renseignée. Cliquer pour rentrer une clef");
}

const LOGIN_FIELD_TYPES = new Set(["text", "email", "tel"]);
const LOGIN_WORDS = /user|login|e-?mail|identifiant|courriel|utilisateur|pseudo/i;

/**
 * Choisit l'identifiant parmi les champs places avant le mot de passe, dans
 * l'ordre de la page. Chaque champ est decrit par ses proprietes (`type` est
 * la propriete, « text » quand l'attribut manque), pas par un selecteur : un
 * `<input name="user">` sans attribut `type` echappe a `input[type="text"]`.
 *
 * Du plus sur au moins sur, le dernier de chaque sorte :
 * 1. le champ qui se declare (`autocomplete` username ou email, type email),
 *    meme masque : un formulaire en deux etapes le garde pour ca ;
 * 2. un champ visible dont le nom, l'id, l'indication ou le libelle parle
 *    d'identifiant ;
 * 3. avec `anyField`, le dernier champ visible rempli : une page peut en
 *    contenir d'autres, un champ de recherche par exemple.
 */
function pickLogin(fields, { anyField = true } = {}) {
  let declared = "";
  let named = "";
  let last = "";
  for (const field of fields) {
    const value = (field.value || "").trim();
    if (!value || value.length > 120) continue;
    const type = (field.type || "text").toLowerCase();
    const autocomplete = (field.autocomplete || "").toLowerCase().split(/\s+/);
    const declares = autocomplete.includes("username") || autocomplete.includes("email");
    if (declares && type !== "password") {
      declared = value;
      continue;
    }
    if (!LOGIN_FIELD_TYPES.has(type)) continue;
    if (type === "email") {
      declared = value;
      continue;
    }
    if (!field.visible) continue;
    last = value;
    const texts = [field.name, field.id, field.placeholder, field.ariaLabel];
    if (texts.some((text) => LOGIN_WORDS.test(text || ""))) named = value;
  }
  return declared || named || (anyField ? last : "");
}

(function () {
  // En test (Node), seuls menuNotice et pickLogin sont charges : pas de page
  // a equiper.
  if (typeof document === "undefined") return;
  const MENU_CLASS = "pw-suggester-menu";
  let listInput = [];

  /**
   * @param asked identifiant donne dans le menu lui-meme (« » pour
   *   « Ignorer ») : il remplace celui du formulaire, et n'est pas redemande.
   */
  function createMenuFor(input, asked) {
    // Déjà créé ?
    if (input.__pwSuggesterMenu || listInput.includes(input)) return;
    listInput.push(input);

    // Demander une proposition au background
    // L'identifiant deja saisi entre dans le calcul, comme dans la popup : sans
    // lui, le mot de passe propose ici differait de celui de la popup, et
    // celui enregistre ensuite (avec l'identifiant) ne l'aurait pas redonne.
    const login = asked === undefined ? findLogin(input) : asked;
    browser.runtime.sendMessage(
      // Rien de saisi : on n'envoie rien, et le premier compte du site sert.
      { action: "generatePassword", url: location.href, login: login || undefined },
      (response) => {
        const menu = document.createElement("div");
        menu.className = "pw-suggester-menu";
        menu.style.position = "absolute";
        menu.style.zIndex = 2147483647;
        menu.style.background = "rgba(0,0,0,0.5";
        menu.style.borderRadius = "4px";
        menu.style.minWidth = "200px";
        menu.style.boxShadow = "0px 2px 6px rgba(0,0,0,0.2)";
        menu.style.cursor = "default";
        menu.style.padding = "10px";
        menu.style.gap = "10px";
        menu.style.display = "inline-flex";

        menu.style.backdropFilter = "blur(3px)";
        menu.style.boxShadow = "0 4px 15px #0006";

        // Position sous l'input
        const rect = input.getBoundingClientRect();
        menu.style.top = `${window.scrollY + rect.bottom + 4}px`;
        menu.style.left = `${window.scrollX + rect.left}px`;

        document.body.appendChild(menu);
        input.__pwSuggesterMenu = menu;

        menu.innerHTML = ""; // Nettoyage
        const container = document.createElement("div");
        container.style.padding = "4px";
        container.style.borderRadius = "4px";
        container.style.display = "flex";
        container.style.gap = "10px";

        // Logo TheCode
        const logo = document.createElement("img");
        logo.src = browser.runtime.getURL("images/128.png");
        logo.style.width = "18px";
        logo.style.height = "18px";
        logo.style.objectFit = "contain";

        // Compte inconnu du carnet et aucun identifiant trouve dans la page :
        // on le demande avant de proposer un mot de passe, puisqu'il entre
        // dans son calcul.
        if (asked === undefined && response?.password && !response.known && !response.login) {
          askLogin(menu, input);
          return;
        }

        // ➤  AUCUNE CLEF DISPONIBLE
        if (!response || response.error) {
          const noKey = document.createElement("div");
          noKey.innerText = menuNotice(response);
          noKey.style.color = "#eaeaeaff";
          noKey.style.cursor = "pointer";
          noKey.style.fontFamily = "system-ui, sans-serif";
          noKey.style.fontSize = "14px";
          noKey.style.margin = "auto";
          container.style.cursor = "pointer";
          container.appendChild(logo);
          container.appendChild(noKey);
          menu.appendChild(container);

          container.addEventListener("mouseover", () => {
            container.style.background = "#427ee7";
          });
          container.addEventListener("mouseout", () => {
            container.style.background = "unset";
          });
          container.addEventListener("mousedown", (e) => {
            e.preventDefault();
          });
          container.addEventListener("click", (e) => {
            e.stopPropagation();
            browser.runtime.sendMessage({ action: "openPopup" });
            removeMenu(input);
          });

          // Disparition quand input perd le focus
          input.addEventListener(
            "blur",
            () => {
              setTimeout(() => removeMenu(input), 150);
            },
            { once: true },
          );
          return;
        }
        container.style.cursor = "pointer";

        // Mot de passe cliquable
        const pwdText = document.createElement("span");
        pwdText.innerText = response.password;
        // Dit pour quel compte : sans identifiant, le mot de passe est calcule
        // (et sera enregistre) sans, et le saisir apres le changerait.
        const accountNote = document.createElement("div");
        accountNote.style.fontSize = "11px";
        accountNote.style.color = "rgba(255,255,255,0.75)";
        accountNote.style.whiteSpace = "normal";
        accountNote.style.maxWidth = "260px";
        accountNote.innerText = response.login
          ? msg("content_for_login", "Pour $1", response.login)
          : msg(
              "content_no_login",
              "Sans identifiant : saisissez-le avant si le site en utilise un.",
            );
        pwdText.style.flexGrow = "1";
        pwdText.style.margin = "auto";
        pwdText.style.whiteSpace = "nowrap";
        pwdText.style.cursor = "pointer";
        pwdText.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
        pwdText.style.color = "white";
        pwdText.style.fontSize = "14px";

        container.addEventListener("click", (e) => {
          e.stopPropagation();
          input.value = response.password;
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));

          // Le carnet connait deja ce site : le reproposer serait du bruit.
          if (response.known) {
            removeMenu(input);
            return;
          }
          // L'identifiant qui a servi au calcul, pas celui du champ relu
          // maintenant : l'entree doit redonner ce mot de passe-ci.
          offerToSave(menu, input, response.login || "");
        });

        container.addEventListener("mouseover", () => {
          container.style.background = "#427ee7";
        });
        container.addEventListener("mouseout", () => {
          container.style.background = "unset";
        });

        // Bouton copier
        const copyBtn = document.createElement("img");
        copyBtn.src = browser.runtime.getURL("images/copy.svg");
        copyBtn.style.height = "22px";
        copyBtn.style.objectFit = "contain";
        copyBtn.style.background = "transparent";
        copyBtn.style.cursor = "pointer";
        copyBtn.style.border = "none";
        copyBtn.style.padding = "3px";
        copyBtn.style.borderRadius = "4px";
        copyBtn.style.margin = "auto";

        // POPUP + BACKGROUND
        let popup;
        function showCopiedPopup() {
          popup?.remove();

          // Popup
          popup = document.createElement("div");
          popup.innerText = msg("content_copied", "Mot de passe copié");
          popup.style.fontSize = "14px";
          popup.style.position = "fixed";
          popup.style.bottom = "20px";
          popup.style.left = "50%";
          popup.style.transform = "translate(-50%)";
          popup.style.padding = "14px 22px";
          popup.style.fontFamily = "system-ui";
          popup.style.color = "white";
          popup.style.fontSize = "15px";
          popup.style.zIndex = 2147483647;
          popup.style.background = "rgba(0,0,0,0.5)";
          popup.style.borderRadius = "4px";
          popup.style.boxShadow = "0px 2px 6px rgba(0,0,0,0.2)";

          document.body.appendChild(popup);

          // Fade out + suppression après 1s
          setTimeout(() => {
            setTimeout(() => popup.remove(), 1500);
          }, 50);
        }

        copyBtn.addEventListener("mouseover", () => {
          copyBtn.style.background = "rgba(0,0,0,0.3)";
        });
        copyBtn.addEventListener("mouseout", () => {
          copyBtn.style.background = "transparent";
        });

        copyBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          navigator.clipboard.writeText(response.password);
          showCopiedPopup();
        });

        // Assemblage du menu
        container.appendChild(logo);
        container.appendChild(pwdText);
        container.style.flexWrap = "wrap";
        accountNote.style.flexBasis = "100%";
        container.appendChild(accountNote);
        menu.appendChild(container);
        menu.appendChild(copyBtn);

        // Disparition quand input perd le focus — sauf pendant la question :
        // cliquer « Oui » fait justement perdre le focus au champ.
        input.addEventListener(
          "blur",
          () => {
            setTimeout(() => {
              if (!input.__pwAsking) removeMenu(input);
            }, 150);
          },
          { once: true },
        );
      },
    );
  }

  /**
   * Cherche l'identifiant saisi a cote du champ de mot de passe.
   *
   * Il fait partie de ce qu'on ne devrait plus avoir a retenir. On regarde
   * d'abord le formulaire du champ, puis la page : hors formulaire, un site
   * peut poser les deux champs cote a cote sans les rattacher.
   */
  function findLogin(input) {
    const before = (scope) =>
      [...scope.querySelectorAll("input")]
        .filter(
          (field) =>
            field !== input &&
            field.compareDocumentPosition(input) & Node.DOCUMENT_POSITION_FOLLOWING,
        )
        .map((field) => ({
          value: field.value,
          type: field.type,
          autocomplete: field.getAttribute("autocomplete"),
          name: field.name,
          id: field.id,
          placeholder: field.placeholder,
          ariaLabel: field.getAttribute("aria-label"),
          visible: field.getClientRects().length > 0,
        }));

    if (!input.form) return pickLogin(before(document));
    // Hors du formulaire, seul un champ qui dit etre l'identifiant compte :
    // le reste de la page a ses propres champs.
    return pickLogin(before(input.form)) || pickLogin(before(document), { anyField: false });
  }

  /**
   * Propose d'enregistrer le site dans le carnet, une fois le mot de passe
   * pose dans le champ.
   *
   * Rien n'est ecrit sans reponse : le carnet est ce qui dit quels reglages
   * appliquer a quel site, une entree posee par erreur se paie plus tard.
   */
  function offerToSave(menu, input, login) {
    input.__pwAsking = true;

    const ask = document.createElement("div");
    ask.style.display = "flex";
    ask.style.alignItems = "center";
    ask.style.gap = "8px";
    ask.style.padding = "4px 8px";
    ask.style.color = "white";
    ask.style.fontSize = "13px";
    ask.style.whiteSpace = "nowrap";

    const label = document.createElement("span");
    label.innerText = login
      ? msg("content_save_login", "Enregistrer ce site ($1) dans le carnet ?", login)
      : msg("content_save", "Enregistrer ce site dans le carnet ?");
    ask.appendChild(label);

    const answer = (yes) => {
      if (!yes) {
        removeMenu(input);
        return;
      }
      browser.runtime.sendMessage({ action: "saveCurrentSite", login }, (resp) => {
        label.innerText = resp?.ok
          ? msg("content_saved", "Enregistré.")
          : msg("content_failed", "Échec : $1", resp?.error || msg("content_unknown", "inconnu"));
        yesBtn.remove();
        noBtn.remove();
        setTimeout(() => removeMenu(input), 1500);
      });
    };

    const button = menuButton;

    const yesBtn = button(msg("content_yes", "Oui"), () => answer(true));
    const noBtn = button(msg("content_no", "Non"), () => answer(false));
    ask.appendChild(yesBtn);
    ask.appendChild(noBtn);

    menu.innerHTML = "";
    menu.appendChild(ask);
  }

  function menuButton(text, onClick) {
    const b = document.createElement("button");
    b.type = "button";
    b.innerText = text;
    b.style.cursor = "pointer";
    b.style.border = "1px solid rgba(255,255,255,0.4)";
    b.style.background = "transparent";
    b.style.color = "white";
    b.style.borderRadius = "4px";
    b.style.padding = "2px 10px";
    b.style.fontSize = "13px";
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      onClick();
    });
    return b;
  }

  /**
   * Demande l'identifiant du compte dans le menu. « Ignorer » propose le mot
   * de passe sans identifiant : c'est un choix, pas un champ oublie.
   */
  function askLogin(menu, input) {
    // Le champ du menu prend le focus : le menu ne doit pas se refermer.
    input.__pwAsking = true;

    const ask = document.createElement("form");
    ask.style.display = "flex";
    ask.style.flexWrap = "wrap";
    ask.style.alignItems = "center";
    ask.style.gap = "8px";
    ask.style.padding = "4px 8px";
    ask.style.color = "white";
    ask.style.fontSize = "13px";
    ask.style.maxWidth = "320px";

    const label = document.createElement("label");
    label.innerText = msg("content_ask_login", "Identifiant du compte sur ce site");
    label.style.flexBasis = "100%";

    const field = document.createElement("input");
    field.type = "text";
    field.autocomplete = "off";
    field.spellcheck = false;
    field.maxLength = 120;
    field.setAttribute("aria-label", label.innerText);
    field.style.flex = "1";
    field.style.minWidth = "140px";
    field.style.padding = "3px 6px";
    field.style.borderRadius = "4px";
    field.style.border = "1px solid rgba(255,255,255,0.4)";
    field.style.background = "white";
    field.style.color = "black";
    field.style.fontSize = "13px";

    const note = document.createElement("div");
    note.innerText = msg(
      "content_ask_login_note",
      "Il entre dans le mot de passe : il ne pourra pas être ajouté ensuite sans le changer.",
    );
    note.style.flexBasis = "100%";
    note.style.fontSize = "11px";
    note.style.color = "rgba(255,255,255,0.75)";

    // Le menu repart avec la reponse : le mot de passe s'affiche comme
    // d'habitude, calcule avec cet identifiant ou sans.
    const answer = (login) => {
      removeMenu(input);
      createMenuFor(input, login);
      input.focus();
    };
    ask.addEventListener("submit", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const login = field.value.trim();
      if (login) answer(login);
    });
    // Les raccourcis de la page ne doivent pas reagir a ce qu'on tape ici.
    for (const type of ["keydown", "keyup", "keypress"]) {
      field.addEventListener(type, (e) => {
        e.stopPropagation();
        if (type === "keydown" && e.key === "Escape") removeMenu(input);
      });
    }
    // Sorti du menu sans repondre (clic ailleurs dans la page) : il se
    // referme, comme le menu du mot de passe quand son champ perd le focus.
    ask.addEventListener("focusout", (e) => {
      if (ask.contains(e.relatedTarget) || e.relatedTarget === input) return;
      setTimeout(() => {
        if (input.__pwSuggesterMenu === menu && !ask.contains(document.activeElement)) {
          removeMenu(input);
        }
      }, 150);
    });

    const okBtn = menuButton(msg("content_ask_login_ok", "Valider"), () => {
      const login = field.value.trim();
      if (login) answer(login);
      else field.focus();
    });
    const skipBtn = menuButton(msg("content_ask_login_skip", "Ignorer"), () => answer(""));

    ask.appendChild(label);
    ask.appendChild(field);
    ask.appendChild(okBtn);
    ask.appendChild(skipBtn);
    ask.appendChild(note);
    menu.appendChild(ask);
    field.focus();
  }

  function removeMenu(input) {
    delete input.__pwAsking;
    const menu = input.__pwSuggesterMenu;
    if (menu && menu.parentNode) menu.parentNode.removeChild(menu);
    delete input.__pwSuggesterMenu;
    listInput = listInput.filter((e) => e !== input);
  }

  // Focus sur input type=password → afficher menu
  document.addEventListener(
    "focusin",
    (e) => {
      const target = e.target;
      if (target && target.tagName === "INPUT" && target.type === "password") {
        createMenuFor(target);
      }
    },
    true,
  );

  // Pour inputs créés dynamiquement
  function scanAddMenus() {
    document.querySelectorAll('input[type="password"]').forEach((inp) => {
      if (!inp.__pwSuggesterMenu) {
        inp.addEventListener(
          "focusin",
          () => {
            if (!inp.__pwSuggesterMenu) createMenuFor(inp);
          },
          { once: true },
        );
      }
    });
  }

  window.addEventListener("load", scanAddMenus);
  setInterval(scanAddMenus, 3000);
})();

if (typeof module !== "undefined") {
  module.exports = { menuNotice, pickLogin };
}
