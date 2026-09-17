// Les sources de l'extension vivent un niveau au-dessus (background.js, popup.js,
// content.js) : rootDir pointe donc sur apps/extension pour que la couverture
// les voie, et testMatch reste limite a js-test/.
module.exports = {
  rootDir: "..",
  testEnvironment: "node",
  testMatch: ["<rootDir>/js-test/**/*.spec.js"],
  collectCoverageFrom: ["<rootDir>/*.js"],
  coverageReporters: ["text", "lcov"],
  coverageDirectory: "<rootDir>/js-test/coverage",
};
