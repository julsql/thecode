/**
 * Choix de l'identifiant dans la page (content.js, pickLogin) : il entre dans
 * la derivation, un champ rate donne un autre mot de passe.
 */
global.chrome = { i18n: { getMessage: () => "" } };
const { pickLogin } = require("../content");

const field = (props) => ({ type: "text", visible: true, ...props });

describe("identifiant du formulaire", () => {
  it("lit un champ sans attribut type, reconnu a son nom (Grafana)", () => {
    // <input name="user" placeholder="email or username"> : la propriete type
    // vaut « text », l'attribut n'existe pas.
    expect(pickLogin([field({ name: "user", value: " admin " })])).toBe("admin");
    expect(pickLogin([{ name: "user", value: "admin", visible: true }])).toBe("admin");
  });

  it("prefere le champ qui se declare au dernier champ rempli", () => {
    const fields = [
      field({ type: "email", value: "moi@example.com" }),
      field({ name: "displayName", value: "Julie" }),
    ];
    expect(pickLogin(fields)).toBe("moi@example.com");
    expect(
      pickLogin([
        field({ autocomplete: "section-a username", value: "julsql" }),
        field({ name: "company", value: "ACME" }),
      ]),
    ).toBe("julsql");
  });

  it("prefere un champ nomme identifiant a un champ quelconque", () => {
    const fields = [
      field({ placeholder: "Nom d'utilisateur", value: "julsql" }),
      field({ name: "otp", value: "123456" }),
    ];
    expect(pickLogin(fields)).toBe("julsql");
    expect(pickLogin([field({ ariaLabel: "Identifiant", value: "a" })])).toBe("a");
    expect(pickLogin([field({ id: "login_field", value: "b" })])).toBe("b");
  });

  it("a defaut, prend le dernier champ visible rempli", () => {
    const fields = [field({ name: "q", value: "recherche" }), field({ name: "x", value: "moi" })];
    expect(pickLogin(fields)).toBe("moi");
    expect(pickLogin(fields, { anyField: false })).toBe("");
  });

  it("garde l'identifiant masque d'un formulaire en deux etapes", () => {
    const hidden = { visible: false, value: "moi@example.com" };
    expect(pickLogin([{ ...hidden, type: "email" }])).toBe("moi@example.com");
    expect(pickLogin([{ ...hidden, type: "hidden", autocomplete: "username" }])).toBe(
      "moi@example.com",
    );
  });

  it("ignore un champ masque qui ne se declare pas", () => {
    expect(pickLogin([{ type: "hidden", name: "user_id", value: "4821", visible: false }])).toBe(
      "",
    );
    expect(pickLogin([field({ name: "user", value: "piege", visible: false })])).toBe("");
  });

  it("ignore les champs vides, trop longs, ou qui ne sont pas du texte", () => {
    expect(pickLogin([field({ name: "user", value: "   " })])).toBe("");
    expect(pickLogin([field({ name: "user", value: "x".repeat(121) })])).toBe("");
    expect(pickLogin([field({ type: "checkbox", name: "user", value: "on" })])).toBe("");
    expect(pickLogin([field({ type: "password", autocomplete: "username", value: "p" })])).toBe("");
    expect(pickLogin([])).toBe("");
  });
});
