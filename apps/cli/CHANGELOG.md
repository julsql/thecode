# Changelog

## [2.2.0](https://github.com/julsql/thecode/compare/cli-v2.1.0...cli-v2.2.0) (2026-09-19)


### Features

* **cli:** renew an entry's password with --renew ([79fba24](https://github.com/julsql/thecode/commit/79fba242b4f937a27b2e9341f75b55b15faeb64e))

## [2.1.0](https://github.com/julsql/thecode/compare/cli-v2.0.0...cli-v2.1.0) (2026-09-18)


### Features

* **cli:** sync the vault through the server ([e546a1e](https://github.com/julsql/thecode/commit/e546a1e98368b98b35acb020c8995090a700c107))
* point the clients at thecode-api.julsql.fr ([2a35656](https://github.com/julsql/thecode/commit/2a3565629c5bbbd148f0684c8963f2fa31e64f4e))


### Bug Fixes

* **cli:** keep a false "deleted" absent after a sync ([8153493](https://github.com/julsql/thecode/commit/81534936d2ec31b9e9b25a09214ffbb9076bda2d))
* pin one canonical form for merge tie-breaks ([9419141](https://github.com/julsql/thecode/commit/9419141677ee42ac00babdada94468b5b1b9c9ac))

## [2.0.0](https://github.com/julsql/thecode/compare/cli-v1.0.1...cli-v2.0.0) (2026-09-18)


### ⚠ BREAKING CHANGES

* **canonical:** passwords change on Android, the website and the CLI for the sites listed in docs/BREAKING-CHANGES.md.

### Features

* **algo:** add v2, coexisting with v1 entry by entry ([52c7393](https://github.com/julsql/thecode/commit/52c7393791408b9b7f875e7ef624989d0ebbc2e6))
* **canonical:** unify domain canonicalisation across all platforms ([e8b1a21](https://github.com/julsql/thecode/commit/e8b1a21cf69e04aa7e67bec4e92c2250b2005484))
* **lot4:** key fingerprint and variant grid ([7766103](https://github.com/julsql/thecode/commit/7766103dde44ca4326aa41c754ef70b51ca8e20b))
* **vault:** add the metadata vault, starting with the CLI ([e8d1192](https://github.com/julsql/thecode/commit/e8d1192142349a6e0179c1562c56cfdc61ea9060))
* **vault:** encrypted transfer between devices ([ee69ac8](https://github.com/julsql/thecode/commit/ee69ac859dc3cb3e13018447e24f232ac1da068c))


### Bug Fixes

* **cli:** make import sorting deterministic ([51ec74d](https://github.com/julsql/thecode/commit/51ec74d4979911ac5207fbd2697e502a1a62eb7b))

## [1.0.1](https://github.com/julsql/thecode/compare/cli-v1.0.0...cli-v1.0.1) (2026-09-17)


### Bug Fixes

* address everything the new CI surfaced ([18d47db](https://github.com/julsql/thecode/commit/18d47dbeafd02344752be9e3813919dd8f058c82))
* **shared:** rename vector fields to stop tripping secret scanners ([e1c4b25](https://github.com/julsql/thecode/commit/e1c4b25cc3a2ba2a4983c49136b605004ad5d28c))
