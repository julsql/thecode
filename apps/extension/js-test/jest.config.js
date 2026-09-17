// Les sources de l'extension vivent un niveau au-dessus (background.js,
// popup.js, content.js). roots doit inclure ce dossier pour que la couverture
// instrumente ces fichiers : avec le seul dossier js-test, collectCoverageFrom
// ne matchait rien et le rapport restait a 0 %.
module.exports = {
  rootDir: "..",
  roots: ["<rootDir>"],
  testEnvironment: "node",
  // Le provider v8 instrumente a l'execution : babel-plugin-istanbul ne voyait
  // pas background.js, charge via require depuis le dossier parent.
  coverageProvider: "v8",
  testMatch: ["<rootDir>/js-test/**/*.spec.js"],
  collectCoverageFrom: ["background.js"],
  coverageReporters: ["text-summary", "lcov"],
  coverageDirectory: "<rootDir>/js-test/coverage",
  // background.js porte l'algorithme : c'est le code dont depend l'acces aux
  // comptes, il merite un seuil strict. popup.js et content.js sont du DOM et
  // seront couverts par les tests de composants et e2e.
  // collectCoverageFrom ne retient que background.js : le seuil global porte
  // donc exactement sur lui. Valeurs calees juste sous le niveau atteint, pour
  // detecter une regression sans bloquer sur du bruit.
  coverageThreshold: {
    global: { statements: 65, branches: 60, functions: 75, lines: 65 },
  },
};
