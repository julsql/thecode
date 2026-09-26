# Changelog

## [3.0.0](https://github.com/julsql/thecode/compare/cli-v2.0.0...cli-v3.0.0) (2026-09-26)


### ⚠ BREAKING CHANGES

* **cli:** new_entry() no longer takes `version`, and keep_supported() is replaced by strip_versions()/drop_version().
* **shared:** vault entries no longer carry `v`; readers must drop it instead of filtering entries on it.
* **cli:** v1 entries are no longer read from the vault, and --migrate is gone. --algo 1 still generates, outside the vault.
* **canonical:** passwords change on Android, the website and the CLI for the sites listed in docs/BREAKING-CHANGES.md.

### Features

* **algo:** add v2, coexisting with v1 entry by entry ([3015d4c](https://github.com/julsql/thecode/commit/3015d4ce21a45999576570d2bcd4c65e32d2551c))
* **canonical:** unify domain canonicalisation across all platforms ([4b84d49](https://github.com/julsql/thecode/commit/4b84d491dcede5978379e21cf1b8091e62c60fc9))
* **cli:** default to v2, keep --algo 1 as the way back ([b77e410](https://github.com/julsql/thecode/commit/b77e410073ff6f9c68fbb3e6b2f803e831781b3e))
* **clients:** point to the site for creating and managing an account ([592f706](https://github.com/julsql/thecode/commit/592f7065ee3f93f3d51fa72df7d083df1056f967))
* **cli:** keep the vault v2 only ([f1cdda3](https://github.com/julsql/thecode/commit/f1cdda3323b6143d6701e6d1c5ad804edd87d1f7))
* **cli:** remember default settings and share them through the account ([2531462](https://github.com/julsql/thecode/commit/2531462d1669417e663f47e38a5b3e9b49d570ec))
* **cli:** renew an entry's password with --renew ([0a3a1f5](https://github.com/julsql/thecode/commit/0a3a1f526b1fc7db8099ee23ec782de9b9a0e75f))
* **cli:** stop versioning vault entries ([5faa65e](https://github.com/julsql/thecode/commit/5faa65ef397823b1925819723768ea0e0882b576))
* **cli:** sync the vault through the server ([96c4df4](https://github.com/julsql/thecode/commit/96c4df4710e072589f69cb1aa862a559ccacd0fe))
* **lot4:** key fingerprint and variant grid ([fdd69b0](https://github.com/julsql/thecode/commit/fdd69b0a660e4034cfa3b73c9377fb1bc6343a65))
* point the clients at thecode-api.julsql.fr ([1c520b7](https://github.com/julsql/thecode/commit/1c520b710007a96b733a0f35477a1f296219299e))
* **shared:** drop the version field from vault entries ([11ba36b](https://github.com/julsql/thecode/commit/11ba36bdba0daf50338b297a5ec48f3a1c26b2f8))
* **shared:** make the vault spec and fixtures v2 only ([6abd021](https://github.com/julsql/thecode/commit/6abd021e0f2405f1f786173b89bf72681c456e52))
* sync only what the plan allows and flag duplicate accounts ([889f342](https://github.com/julsql/thecode/commit/889f342335b30bd73aac6489ce2515e8056b02b2))
* the counter becomes part of the complete plan ([7a13ccc](https://github.com/julsql/thecode/commit/7a13ccc5e022b50858a367833f5535c28c6beb1f))
* v2-only vault with login, lock, shared settings and Google sign-in ([70183a6](https://github.com/julsql/thecode/commit/70183a6783cae7d8b1e8da3a59f9224599270a1f))
* **vault:** add the metadata vault, starting with the CLI ([ff1ad79](https://github.com/julsql/thecode/commit/ff1ad79a2a97813a6e25d638d352d78bc1f7b755))
* **vault:** encrypted transfer between devices ([4f575bc](https://github.com/julsql/thecode/commit/4f575bcbd669968ad425f06b04139ca392810a69))


### Bug Fixes

* address everything the new CI surfaced ([131d521](https://github.com/julsql/thecode/commit/131d521dbb4ef2c3992d3ed10476de057abaa5c9))
* **cli:** keep a false "deleted" absent after a sync ([e680b2d](https://github.com/julsql/thecode/commit/e680b2d5f848e92b2eb8e6aed6b478a24427d539))
* **cli:** make import sorting deterministic ([bf382c8](https://github.com/julsql/thecode/commit/bf382c8c00914816a78d2d2b9b9f69f92f2903e0))
* pin one canonical form for merge tie-breaks ([674bc06](https://github.com/julsql/thecode/commit/674bc06566a402d24080d280d8473eb99bd3e714))
* point every link at the monorepo ([aaab0eb](https://github.com/julsql/thecode/commit/aaab0eb62abf28b47ae83f91517d4dd785cacf0d))
* **security:** resolve CodeQL alerts [#1](https://github.com/julsql/thecode/issues/1), [#2](https://github.com/julsql/thecode/issues/2), [#3](https://github.com/julsql/thecode/issues/3) ([a6a229c](https://github.com/julsql/thecode/commit/a6a229cb8016c82c0a3544c436de59b4a859595c))
* **security:** resolve CodeQL alerts [#1](https://github.com/julsql/thecode/issues/1), [#2](https://github.com/julsql/thecode/issues/2), [#3](https://github.com/julsql/thecode/issues/3) ([b61b021](https://github.com/julsql/thecode/commit/b61b021f8eff503ae1e437ea74ee43da184ef92b))
* **shared:** rename vector fields to stop tripping secret scanners ([0c2dbd4](https://github.com/julsql/thecode/commit/0c2dbd430542529621ea4daf6fa1d319b9bf3168))


### Documentation

* **readme:** add status badges and document --show option ([#2](https://github.com/julsql/thecode/issues/2)) ([6831ec3](https://github.com/julsql/thecode/commit/6831ec3c443723888b496bdb84ad49eeb1b9a167))
* **readme:** fix badges after repository transfer ([#3](https://github.com/julsql/thecode/issues/3)) ([83718a1](https://github.com/julsql/thecode/commit/83718a149388d8b6ac5080c2c31f8d99623b7a30))

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
