# Changelog

## [3.4.0](https://github.com/julsql/thecode/compare/android-v3.3.0...android-v3.4.0) (2026-09-20)


### Features

* **apps:** invite people to sync, without a word about price ([be89c12](https://github.com/julsql/thecode/commit/be89c12098bd1c72ea08d02826efc0fdf3a8ee09))
* hide the paid plan on the page the apps link to ([bfed357](https://github.com/julsql/thecode/commit/bfed357e4d290f34179941f992a58b57faaa41da))
* make the renewal sell on the web and stay silent in the apps ([1bf8588](https://github.com/julsql/thecode/commit/1bf85889b90a62699669ce5069b7cb0e6dece946))

## [3.3.0](https://github.com/julsql/thecode/compare/android-v3.2.0...android-v3.3.0) (2026-09-19)


### Features

* **android:** announce the move to v2, once ([25129f9](https://github.com/julsql/thecode/commit/25129f9e7cfbe7951a9f2772d1aa48c3cebdef62))
* **android:** generate in v2 by default, with a way back to v1 ([6f8a226](https://github.com/julsql/thecode/commit/6f8a226ae18eeaf7e0e4e551e7d3ee27aeaf870d))
* **android:** make the algorithm a mode shown in the top bar ([c89688d](https://github.com/julsql/thecode/commit/c89688dfd59aaaca5db166c2a71fcec5de610920))
* **android:** offer to save the site after autofill ([544ccea](https://github.com/julsql/thecode/commit/544ccea0633d9560c1be73d525da3cce24aaa964))
* **clients:** point to the site for creating and managing an account ([9bce2bd](https://github.com/julsql/thecode/commit/9bce2bd25b7ad9334786a75185f5f80582da8141))
* derive v2 in autofill regardless of the entry's version ([7ec9665](https://github.com/julsql/thecode/commit/7ec9665c9f4559f335171e7431810d64c89878b0))
* show the v2 notice as a dialog, dismissed only by the checkbox ([33af5c9](https://github.com/julsql/thecode/commit/33af5c900511f324facb973c2aa30f97df8baee8))
* the counter becomes part of the complete plan ([e21b66c](https://github.com/julsql/thecode/commit/e21b66ca1131a54558d18047c1d416ebc99209b2))


### Bug Fixes

* **android:** keep the vault and transfer screens below the status bar ([fbe433f](https://github.com/julsql/thecode/commit/fbe433f3eeb97db01091094fc40f6b8664633538))
* **android:** require authentication to open the vault ([75cb129](https://github.com/julsql/thecode/commit/75cb129b366ae0b616b5e3d3d652a1ae42b987ab))
* compute the fingerprint after a pause, not on every keystroke ([594f744](https://github.com/julsql/thecode/commit/594f744314512e9cac772a9110dfbc6827566f97))
* reset the algorithm mode to v2 on every launch ([49e1648](https://github.com/julsql/thecode/commit/49e1648e2af068f9dfcbd8ba7e67b2d3e82708b3))
* **tests:** a tamper test that sometimes tampered with nothing ([2927ee5](https://github.com/julsql/thecode/commit/2927ee5a80744b488c6d34cf66f88e1f6406c6af))
* **tests:** tamper with four characters, not one ([94e5643](https://github.com/julsql/thecode/commit/94e56433579e9b4af74bfc2a5704437f69a18cc6))

## [3.2.0](https://github.com/julsql/thecode/compare/android-v3.1.0...android-v3.2.0) (2026-09-19)


### Features

* **android:** export and import an encrypted vault ([8ae9050](https://github.com/julsql/thecode/commit/8ae90502f5e534b13bd880f71daf1a4d6a79bccf))
* **android:** implement the v2 algorithm ([a26a0ec](https://github.com/julsql/thecode/commit/a26a0ec7b0e44b25447f5da874899abeb6337765))
* **android:** make autofill read the vault ([537e23b](https://github.com/julsql/thecode/commit/537e23bfdbbe97aa349ddbf938fbd40c1e02bae7))
* **android:** renew and migrate an entry from the vault screen ([a954321](https://github.com/julsql/thecode/commit/a9543217705ad9c0a33c9228b39c70c6517acb46))
* **android:** transfer the vault by QR code ([aa7d8f7](https://github.com/julsql/thecode/commit/aa7d8f781d947baf5e7ab2133b7ab46d8ada6309))

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
