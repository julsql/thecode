# Changelog

## [3.3.0](https://github.com/julsql/thecode/compare/apple-v3.2.0...apple-v3.3.0) (2026-09-19)


### Features

* **apple:** announce the move to v2, once ([4f96f1f](https://github.com/julsql/thecode/commit/4f96f1fd3e824d3a55e3424e112f8a73caa22805))
* **apple:** generate in v2 by default, with a way back to v1 ([f332a65](https://github.com/julsql/thecode/commit/f332a65809cdc3b5b79755ca8388817dcab524e9))
* **apple:** make the algorithm a mode shown in the toolbar ([11e7f56](https://github.com/julsql/thecode/commit/11e7f56e712e3ad7a086c0f90cc4ebae4874f8e4))
* **apple:** offer to save the site when filling an unknown one ([21a9f9a](https://github.com/julsql/thecode/commit/21a9f9a87132b8a619f99e30a69c47f6618483dc))
* **clients:** point to the site for creating and managing an account ([9bce2bd](https://github.com/julsql/thecode/commit/9bce2bd25b7ad9334786a75185f5f80582da8141))
* derive v2 in autofill regardless of the entry's version ([7ec9665](https://github.com/julsql/thecode/commit/7ec9665c9f4559f335171e7431810d64c89878b0))
* show the v2 notice as a dialog, dismissed only by the checkbox ([33af5c9](https://github.com/julsql/thecode/commit/33af5c900511f324facb973c2aa30f97df8baee8))
* the counter becomes part of the complete plan ([e21b66c](https://github.com/julsql/thecode/commit/e21b66ca1131a54558d18047c1d416ebc99209b2))


### Bug Fixes

* **apple:** mask the key the same way whether locked or not ([6e598c8](https://github.com/julsql/thecode/commit/6e598c82d5e6582bedcdd376bbeb034d2565a85a))
* **apple:** match Android's session handling, and show the fingerprint ([52a6838](https://github.com/julsql/thecode/commit/52a68380c1030a9e86608bfa41ce33c270a6e3f6))
* **apple:** require authentication to open the vault ([b5929c3](https://github.com/julsql/thecode/commit/b5929c38dbed0fac2f87b0db57d42fde7f11d1cc))
* **apple:** show the v2 notice on macOS, and lay it out properly ([d672711](https://github.com/julsql/thecode/commit/d67271108856eddb6599f337ceaa9a90560c7512))
* compute the fingerprint after a pause, not on every keystroke ([594f744](https://github.com/julsql/thecode/commit/594f744314512e9cac772a9110dfbc6827566f97))
* **tests:** a tamper test that sometimes tampered with nothing ([2927ee5](https://github.com/julsql/thecode/commit/2927ee5a80744b488c6d34cf66f88e1f6406c6af))
* **tests:** tamper with four characters, not one ([94e5643](https://github.com/julsql/thecode/commit/94e56433579e9b4af74bfc2a5704437f69a18cc6))

## [3.2.0](https://github.com/julsql/thecode/compare/apple-v3.1.0...apple-v3.2.0) (2026-09-19)


### Features

* **apple:** export and import an encrypted vault ([6a15f6b](https://github.com/julsql/thecode/commit/6a15f6b5ad65a5976bb4b32d76fe2110610353c0))
* **apple:** implement the v2 algorithm ([7ac434a](https://github.com/julsql/thecode/commit/7ac434a87c3ca2c3324bc825e65fcb6fc7de42c5))
* **apple:** make autofill read the vault ([b920bf2](https://github.com/julsql/thecode/commit/b920bf2c4f1c7e9d9e0988f84ee5f98b62455a81))
* **apple:** renew and migrate an entry from the vault screen ([bd81dc4](https://github.com/julsql/thecode/commit/bd81dc4211062f274e964970c494f9a31075ce99))
* **apple:** transfer the vault by QR code ([bcfb2e9](https://github.com/julsql/thecode/commit/bcfb2e94ff56eb832bd0b1dd0e747e3d3af1d0f7))

## [3.1.0](https://github.com/julsql/thecode/compare/apple-v3.0.0...apple-v3.1.0) (2026-09-18)


### Features

* **apple:** add a vault view ([591b47e](https://github.com/julsql/thecode/commit/591b47e1a8bc2ce4717b4fc50f6ef6a80cd8d6a5))
* **apple:** encrypt the vault before it leaves the device ([02f8992](https://github.com/julsql/thecode/commit/02f8992a618b1a17ec7f73f4ce0355884a659628))
* **apple:** open the vault and sync it from the iOS app ([52b817c](https://github.com/julsql/thecode/commit/52b817cf402b56dba76996a9943bbcaaf76e6097))
* **apple:** open the vault and sync it from the macOS app ([acf5bc5](https://github.com/julsql/thecode/commit/acf5bc5fba1e27aa6a908a288e6dec613096da78))
* **apple:** save a site's settings to the vault ([856a8a4](https://github.com/julsql/thecode/commit/856a8a4402520efe5e49ccc9e426754cf1b0e43a))
* **apple:** sync the vault with the encrypted service ([856e07c](https://github.com/julsql/thecode/commit/856e07c9f824241cd15a14f4ee05434ce583bc08))
* **mobile:** show the key fingerprint on Android and Apple ([257a482](https://github.com/julsql/thecode/commit/257a482daebc40312e71e868eeb9e1670e296334))
* point the clients at thecode-api.julsql.fr ([2a35656](https://github.com/julsql/thecode/commit/2a3565629c5bbbd148f0684c8963f2fa31e64f4e))


### Bug Fixes

* **apple:** let the sandboxed macOS app reach the sync service ([aec900e](https://github.com/julsql/thecode/commit/aec900ee00bda7590ffc676d381bd1eb888c1913))
* **apple:** move the master key out of plain text into the keychain ([cb13a11](https://github.com/julsql/thecode/commit/cb13a115cfcfe3589b86fb84b30a8caa62fb8e37))
* pin one canonical form for merge tie-breaks ([9419141](https://github.com/julsql/thecode/commit/9419141677ee42ac00babdada94468b5b1b9c9ac))
* **website:** keep a false "deleted" absent after a sync ([e414a29](https://github.com/julsql/thecode/commit/e414a299b06e9936f978bfc90cde0a164e23a50b))

## [3.0.0](https://github.com/julsql/thecode/compare/apple-v2.3.1...apple-v3.0.0) (2026-09-18)


### ⚠ BREAKING CHANGES

* **canonical:** passwords change on Android, the website and the CLI for the sites listed in docs/BREAKING-CHANGES.md.

### Features

* **algo:** add v2, coexisting with v1 entry by entry ([52c7393](https://github.com/julsql/thecode/commit/52c7393791408b9b7f875e7ef624989d0ebbc2e6))
* **canonical:** unify domain canonicalisation across all platforms ([e8b1a21](https://github.com/julsql/thecode/commit/e8b1a21cf69e04aa7e67bec4e92c2250b2005484))
* **vault:** port the vault to the website, Android and Apple ([ede5737](https://github.com/julsql/thecode/commit/ede5737a4afd109797aeb6a30bf009973182a701))


### Bug Fixes

* **apple:** make the public suffix fallback loud instead of silent ([b4da309](https://github.com/julsql/thecode/commit/b4da30918b9c3d05cb02aac96d2fe8f8b35f96df))

## [2.3.1](https://github.com/julsql/thecode/compare/apple-v2.3.0...apple-v2.3.1) (2026-09-17)


### Bug Fixes

* **shared:** rename vector fields to stop tripping secret scanners ([e1c4b25](https://github.com/julsql/thecode/commit/e1c4b25cc3a2ba2a4983c49136b605004ad5d28c))
