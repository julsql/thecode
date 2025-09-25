const { coder, get_base, get_bits, get_security, code, sha256, dec2base } = require('../background');

const totalBase = "portezcviuxwhskyajgblndqfmTHEQUICKBROWNFXJMPSVLAZYDG@#&!)-%;<:*$+=/?>(567438921";

test('la fonction de code renvoie le bon mot de passe', async () => {
    const result = await coder('site', 'clef', 20, true, true, true, true);
    expect(result).toStrictEqual({ mdp: "u8!fpdVdK*#Bp@6(9fed", security: "Très Forte", bits: 126, color: "#1CD001" });
});

test.each([
    [true, true, true, true, totalBase],
    [true, false, true, false, "portezcviuxwhskyajgblndqfm@#&!)-%;<:*$+=/?>("],
])("avec minState %s, majState %s, symState %s, chiState %s j'ai la base %s", (minState, majState, symState, chiState, expected) => {
    expect(get_base(minState, majState, symState, chiState)).toStrictEqual(expected);
});

test.each([
    [totalBase, 20, 126],
    [totalBase, 10, 63],
])('la base %s et la longueur %s dois donner %s bits', (base, length, expected) => {
    expect(get_bits(base, length)).toStrictEqual(expected);
});

test.each([
    [126, "Très Forte", "#1CD001"],
    [63, "Très Faible", "#FE0101"],
])('%s bits donne le message %s de couleur %s', (bits, expectedMessage, expectedColor) => {
    expect(get_security(bits)).toStrictEqual({ security: expectedMessage, color: expectedColor });
});

test('la fonction de hachage fonctionne', async () => {
    const result = await sha256("une texte à hacher");
    expect(result).toStrictEqual("8c85e9323dd037f795315a5ec4404e003e96a4b0554acc70d811f9d301126acb");
});

test.each([
    [1, "abc", "b"],
])('%s en base %s donne %s', (x, base, expected) => {
    expect(dec2base(x, base)).toStrictEqual(expected);
});

test.each([
    ["site", "clef", totalBase, 20, "u8!fpdVdK*#Bp@6(9fed"],
    ["site", "clef", totalBase, 10, "u8!fpdVdK*"],
    ["autre site", "clef", totalBase, 20, "rp%m6m(SMtzDHbv2$nXe"],
    ["site", "clef", "portezcviuxwhskyajgblndqfm@#&!)-%;<:*$+=/?>(", 20, "nizm/>cp*jdfg<%=w>=a"],
])("avec le site %s, la clef %s et la base %s j'ai le mot de passe de longueur %s suivant : %s", async (site, clef, base, lenght, expected) => {
    const result = await code(site, clef, base, lenght);
    expect(result).toStrictEqual(expected);
});
