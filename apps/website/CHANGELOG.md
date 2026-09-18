# Changelog

## [2.1.0](https://github.com/julsql/thecode/compare/website-v2.0.0...website-v2.1.0) (2026-09-18)


### Features

* point the clients at thecode-api.julsql.fr ([2a35656](https://github.com/julsql/thecode/commit/2a3565629c5bbbd148f0684c8963f2fa31e64f4e))
* **website:** surface the vault and key fingerprint ([a5ac5ce](https://github.com/julsql/thecode/commit/a5ac5ce6609c4c89b47c72c406bd1ebba19f60da))
* **website:** sync the vault through the server ([de6b565](https://github.com/julsql/thecode/commit/de6b565ad78288f3712ad2af528677d0a834e72f))


### Bug Fixes

* pin one canonical form for merge tie-breaks ([9419141](https://github.com/julsql/thecode/commit/9419141677ee42ac00babdada94468b5b1b9c9ac))
* **website:** keep a false "deleted" absent after a sync ([e414a29](https://github.com/julsql/thecode/commit/e414a299b06e9936f978bfc90cde0a164e23a50b))

## [2.0.0](https://github.com/julsql/thecode/compare/website-v1.0.0...website-v2.0.0) (2026-09-18)


### ⚠ BREAKING CHANGES

* **canonical:** passwords change on Android, the website and the CLI for the sites listed in docs/BREAKING-CHANGES.md.

### Features

* **algo:** add v2, coexisting with v1 entry by entry ([52c7393](https://github.com/julsql/thecode/commit/52c7393791408b9b7f875e7ef624989d0ebbc2e6))
* **canonical:** unify domain canonicalisation across all platforms ([e8b1a21](https://github.com/julsql/thecode/commit/e8b1a21cf69e04aa7e67bec4e92c2250b2005484))
* **vault:** encrypted transfer between devices ([ee69ac8](https://github.com/julsql/thecode/commit/ee69ac859dc3cb3e13018447e24f232ac1da068c))
* **vault:** port the vault to the website, Android and Apple ([ede5737](https://github.com/julsql/thecode/commit/ede5737a4afd109797aeb6a30bf009973182a701))
* **website:** permanent recovery page for the v1 algorithm ([b3f0c50](https://github.com/julsql/thecode/commit/b3f0c50c18444218cf91107f65ac29719b8eb770))

## 1.0.0 (2026-09-18)


### Bug Fixes

* **security:** CodeQL language input and trivy scanners ([c7eace0](https://github.com/julsql/thecode/commit/c7eace0b09beab5195c2096372694fcc31f4827e))
* **shared:** rename vector fields to stop tripping secret scanners ([e1c4b25](https://github.com/julsql/thecode/commit/e1c4b25cc3a2ba2a4983c49136b605004ad5d28c))
