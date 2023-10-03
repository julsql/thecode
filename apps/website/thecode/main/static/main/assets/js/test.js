const thecode = require("./thecode");


test('Test de coder', () => {
  expect(thecode.coder("site", "clef", 20, true, true, true, true).mdp).toBe("u8!fpdVdK*#Bp@6(9fed");

  expect(thecode.coder("s", "c", 20, true, true, true, true).mdp).toBe("wDwWUk$@<%r+ceYvVqoI");

});
