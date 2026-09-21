# Changelog

## [3.4.0](https://github.com/julsql/thecode/compare/extension-v3.3.0...extension-v3.4.0) (2026-09-20)


### Features

* make the renewal sell on the web and stay silent in the apps ([1bf8588](https://github.com/julsql/thecode/commit/1bf85889b90a62699669ce5069b7cb0e6dece946))

## [3.3.0](https://github.com/julsql/thecode/compare/extension-v3.2.0...extension-v3.3.0) (2026-09-19)


### Features

* **clients:** point to the site for creating and managing an account ([9bce2bd](https://github.com/julsql/thecode/commit/9bce2bd25b7ad9334786a75185f5f80582da8141))
* derive v2 in autofill regardless of the entry's version ([7ec9665](https://github.com/julsql/thecode/commit/7ec9665c9f4559f335171e7431810d64c89878b0))
* **extension:** announce the move to v2, once ([f777bfb](https://github.com/julsql/thecode/commit/f777bfb101b0d84b2edca0ada94f8c216b2cd588))
* **extension:** offer to save the site after filling a password ([8b2575c](https://github.com/julsql/thecode/commit/8b2575cdd1f99e735f86d8827ea038501d4fe9c7))
* show the v2 notice as a dialog, dismissed only by the checkbox ([33af5c9](https://github.com/julsql/thecode/commit/33af5c900511f324facb973c2aa30f97df8baee8))
* the counter becomes part of the complete plan ([e21b66c](https://github.com/julsql/thecode/commit/e21b66ca1131a54558d18047c1d416ebc99209b2))


### Bug Fixes

* **extension:** drop the "license" key both browsers reject ([0521839](https://github.com/julsql/thecode/commit/05218391bf797c3a4d897d8c22bd06bb1d88abce))

## [3.2.0](https://github.com/julsql/thecode/compare/extension-v3.1.0...extension-v3.2.0) (2026-09-19)


### Features

* add a shared QR encoder, byte mode, EC level L ([e4a414f](https://github.com/julsql/thecode/commit/e4a414f625c0b12a8f78edc321ccabad6a245fcd))
* **extension:** derive from the vault entry, and renew or migrate it ([dec485e](https://github.com/julsql/thecode/commit/dec485e959256738a1b77ae048f897863f24c13d))
* **extension:** transfer the vault by QR code or file ([9c683a1](https://github.com/julsql/thecode/commit/9c683a18c9759df3fc3beef9b09bb510f6dceef2))

## [3.1.0](https://github.com/julsql/thecode/compare/extension-v3.0.0...extension-v3.1.0) (2026-09-18)


### Features

* **extension:** surface the vault and key fingerprint in the popup ([156776a](https://github.com/julsql/thecode/commit/156776a673b699e9f8f7033d14bbe7b8f31cf92e))
* **extension:** sync the vault through the server ([a04262c](https://github.com/julsql/thecode/commit/a04262c779ff52f26eabd740e6b6db0a13d403e4))
* point the clients at thecode-api.julsql.fr ([2a35656](https://github.com/julsql/thecode/commit/2a3565629c5bbbd148f0684c8963f2fa31e64f4e))


### Bug Fixes

* pin one canonical form for merge tie-breaks ([9419141](https://github.com/julsql/thecode/commit/9419141677ee42ac00babdada94468b5b1b9c9ac))
* **website:** keep a false "deleted" absent after a sync ([e414a29](https://github.com/julsql/thecode/commit/e414a299b06e9936f978bfc90cde0a164e23a50b))

## [3.0.0](https://github.com/julsql/thecode/compare/extension-v2.2.2...extension-v3.0.0) (2026-09-18)

### ⚠ BREAKING CHANGES

- **canonical:** passwords change on Android, the website and the CLI for the sites listed in docs/BREAKING-CHANGES.md.

### Features

- **algo:** add v2, coexisting with v1 entry by entry ([52c7393](https://github.com/julsql/thecode/commit/52c7393791408b9b7f875e7ef624989d0ebbc2e6))
- **canonical:** unify domain canonicalisation across all platforms ([e8b1a21](https://github.com/julsql/thecode/commit/e8b1a21cf69e04aa7e67bec4e92c2250b2005484))
- **extension:** port the vault to the service worker ([7951b66](https://github.com/julsql/thecode/commit/7951b6672fa328a0bbbbbeb2cce39c3c95c4b6a5))
- **lot4:** key fingerprint and variant grid ([7766103](https://github.com/julsql/thecode/commit/7766103dde44ca4326aa41c754ef70b51ca8e20b))
- **vault:** encrypted transfer between devices ([ee69ac8](https://github.com/julsql/thecode/commit/ee69ac859dc3cb3e13018447e24f232ac1da068c))

### Bug Fixes

- **apple:** make the public suffix fallback loud instead of silent ([b4da309](https://github.com/julsql/thecode/commit/b4da30918b9c3d05cb02aac96d2fe8f8b35f96df))

## [2.2.2](https://github.com/julsql/thecode/compare/extension-v2.2.1...extension-v2.2.2) (2026-09-18)

### Bug Fixes

- **extension:** stop startup rehydration overwriting a concurrent save ([d0da30f](https://github.com/julsql/thecode/commit/d0da30f0c80e605f1f51bda7a786cca4f23389b9))
- **security:** CodeQL language input and trivy scanners ([c7eace0](https://github.com/julsql/thecode/commit/c7eace0b09beab5195c2096372694fcc31f4827e))
- **security:** patch npm advisories and pin trivy correctly ([0b5724d](https://github.com/julsql/thecode/commit/0b5724d46d4d0a90422d69dacea17c6dc9878eba))
- **shared:** rename vector fields to stop tripping secret scanners ([e1c4b25](https://github.com/julsql/thecode/commit/e1c4b25cc3a2ba2a4983c49136b605004ad5d28c))
