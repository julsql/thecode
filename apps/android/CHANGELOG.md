# Changelog

## [3.1.0](https://github.com/julsql/thecode/compare/android-v3.0.0...android-v3.1.0) (2026-09-18)


### Features

* **android:** add a vault screen ([0442738](https://github.com/julsql/thecode/commit/0442738d2050759c96b8a5d8425a921e86c83ff0))
* **android:** encrypt the vault for transfer ([c3a0f34](https://github.com/julsql/thecode/commit/c3a0f3478e8dda14e58d354c2061b5cbb9bc41c7))
* **android:** save a site's settings to the vault ([6c190cb](https://github.com/julsql/thecode/commit/6c190cbdf58507a1acd8f7bc59afd257488cdd1d))
* **android:** sync the vault with the encrypted service ([cf2942c](https://github.com/julsql/thecode/commit/cf2942c6845ecdcdbba36b05509840f22f06e5c5))
* **mobile:** show the key fingerprint on Android and Apple ([257a482](https://github.com/julsql/thecode/commit/257a482daebc40312e71e868eeb9e1670e296334))
* point the clients at thecode-api.julsql.fr ([2a35656](https://github.com/julsql/thecode/commit/2a3565629c5bbbd148f0684c8963f2fa31e64f4e))


### Bug Fixes

* pin one canonical form for merge tie-breaks ([9419141](https://github.com/julsql/thecode/commit/9419141677ee42ac00babdada94468b5b1b9c9ac))
* **website:** keep a false "deleted" absent after a sync ([e414a29](https://github.com/julsql/thecode/commit/e414a299b06e9936f978bfc90cde0a164e23a50b))


### Performance Improvements

* **android:** write the synced vault off the main thread ([c134afe](https://github.com/julsql/thecode/commit/c134afedb5691ce59d9cb7c648e03e86924ed088))

## [3.0.0](https://github.com/julsql/thecode/compare/android-v2.3.1...android-v3.0.0) (2026-09-18)


### ⚠ BREAKING CHANGES

* **canonical:** passwords change on Android, the website and the CLI for the sites listed in docs/BREAKING-CHANGES.md.

### Features

* **algo:** add v2, coexisting with v1 entry by entry ([52c7393](https://github.com/julsql/thecode/commit/52c7393791408b9b7f875e7ef624989d0ebbc2e6))
* **canonical:** unify domain canonicalisation across all platforms ([e8b1a21](https://github.com/julsql/thecode/commit/e8b1a21cf69e04aa7e67bec4e92c2250b2005484))
* **vault:** port the vault to the website, Android and Apple ([ede5737](https://github.com/julsql/thecode/commit/ede5737a4afd109797aeb6a30bf009973182a701))


### Bug Fixes

* **android:** encrypt the master key at rest ([923a153](https://github.com/julsql/thecode/commit/923a153c861f1ba4ca0d21787b51ff4bf7b829b5))
* **apple:** make the public suffix fallback loud instead of silent ([b4da309](https://github.com/julsql/thecode/commit/b4da30918b9c3d05cb02aac96d2fe8f8b35f96df))

## [2.3.1](https://github.com/julsql/thecode/compare/android-v2.3.0...android-v2.3.1) (2026-09-18)


### Bug Fixes

* address everything the new CI surfaced ([18d47db](https://github.com/julsql/thecode/commit/18d47dbeafd02344752be9e3813919dd8f058c82))
* **shared:** rename vector fields to stop tripping secret scanners ([e1c4b25](https://github.com/julsql/thecode/commit/e1c4b25cc3a2ba2a4983c49136b605004ad5d28c))
