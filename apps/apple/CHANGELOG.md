# Changelog

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
