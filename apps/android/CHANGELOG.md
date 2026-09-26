# Changelog

## [4.0.0](https://github.com/julsql/thecode/compare/android-v3.0.0...android-v4.0.0) (2026-09-26)


### ⚠ BREAKING CHANGES

* **android:** vault entries are written without `v`.
* **shared:** vault entries no longer carry `v`; readers must drop it instead of filtering entries on it.
* **canonical:** passwords change on Android, the website and the CLI for the sites listed in docs/BREAKING-CHANGES.md.

### Features

* add title une header bar ([8add690](https://github.com/julsql/thecode/commit/8add6904b370276cc9ac96733cc0e8456e9a909d))
* **algo:** add v2, coexisting with v1 entry by entry ([3015d4c](https://github.com/julsql/thecode/commit/3015d4ce21a45999576570d2bcd4c65e32d2551c))
* **android:** add a login field to the generator ([d9b7280](https://github.com/julsql/thecode/commit/d9b72805a6dc4c9e56181749d6bf7112f75add8a))
* **android:** add a vault screen ([fabd806](https://github.com/julsql/thecode/commit/fabd8069294b34be045ee0b57008c2e839429b86))
* **android:** announce the move to v2, once ([82a6e42](https://github.com/julsql/thecode/commit/82a6e421a3a4851be85e846da16f6044fe5100b9))
* **android:** encrypt the vault for transfer ([797a22d](https://github.com/julsql/thecode/commit/797a22dcf09038454310dde549ba5323e6fba7f1))
* **android:** export and import an encrypted vault ([af69e32](https://github.com/julsql/thecode/commit/af69e321b3d102e84fba8297b50aa5b2dbee2baa))
* **android:** generate in v2 by default, with a way back to v1 ([02abc19](https://github.com/julsql/thecode/commit/02abc19a0dc4b785c8f617ef45cb66aa921712ca))
* **android:** implement the v2 algorithm ([001ce1c](https://github.com/julsql/thecode/commit/001ce1c73909045cdd0c3cabf9cbafaa185d1731))
* **android:** keep only v2 entries in the vault ([1e5e0ed](https://github.com/julsql/thecode/commit/1e5e0ed6da0636f8df733857413d240858fc0416))
* **android:** keep the vault unlocked for the key's 3-minute grace ([35eb5bd](https://github.com/julsql/thecode/commit/35eb5bd6e59662c240147a448881148bf80fac45))
* **android:** lock the vault screen behind biometrics or a vault password ([5106971](https://github.com/julsql/thecode/commit/5106971465fa2797785b58c89c42b290511abefd))
* **android:** make autofill read the vault ([8a84871](https://github.com/julsql/thecode/commit/8a84871fdf1c8fd96a556fbee247089b339bbe85))
* **android:** make the algorithm a mode shown in the top bar ([0e3346f](https://github.com/julsql/thecode/commit/0e3346fd6f98f95f731278c6920f802ef0d34f97))
* **android:** mask the generated password and save it next to it ([549a28f](https://github.com/julsql/thecode/commit/549a28f3ab4ad92d6b3811d07b9bee8555cd61e1))
* **android:** offer autofill suggestions inline in the keyboard strip ([c6000c5](https://github.com/julsql/thecode/commit/c6000c52e804b7f3763f5de4c9f96e5b0e0badd1))
* **android:** offer autofill suggestions inline in the keyboard strip ([394c774](https://github.com/julsql/thecode/commit/394c774d79907a307ebfc412a0b4e484f5141fb1))
* **android:** offer to save the site after autofill ([52a06af](https://github.com/julsql/thecode/commit/52a06af6aedd61c71596a1bca5ce2ca50a18f291))
* **android:** propose saving unknown sites to the vault when signed in to sync ([1290d51](https://github.com/julsql/thecode/commit/1290d517171d4036f93bb5746e38884423b8a584))
* **android:** renew and migrate an entry from the vault screen ([ba20bd6](https://github.com/julsql/thecode/commit/ba20bd60a807ebb3d103d71c0ba3b8402005127b))
* **android:** save a site's settings to the vault ([3f0ff49](https://github.com/julsql/thecode/commit/3f0ff49e19edc8dd1571cf859040defa885acdd7))
* **android:** say when an autofill suggestion has no username ([a90043e](https://github.com/julsql/thecode/commit/a90043e0b3bcbc1e15b80d822e202cc71b4a0903))
* **android:** share default settings through the account ([3004602](https://github.com/julsql/thecode/commit/300460298916dbe58381179e370f717da278827c))
* **android:** share one session between the key and the vault ([16fb38b](https://github.com/julsql/thecode/commit/16fb38bb22404ef743ceffa3c7a97571a004f5a6))
* **android:** show vault entry details and delete entries as tombstones ([d1b4058](https://github.com/julsql/thecode/commit/d1b40586a000f5526fca37844e195978f7b5d211))
* **android:** sign in from the vault's sync section ([5534721](https://github.com/julsql/thecode/commit/553472193b70dda9bc6f8112dff227ba8943b74b))
* **android:** sign in to sync with Google ([d87e341](https://github.com/julsql/thecode/commit/d87e3418c436a561b4dbf19b421dfca5d002ca35))
* **android:** stop versioning vault entries ([92e0695](https://github.com/julsql/thecode/commit/92e06952151a37fef8028c45b9cad0f620ef987b))
* **android:** sync automatically ([3bfd324](https://github.com/julsql/thecode/commit/3bfd324cfe70c41373e86d4bdcd89ed9793bccbd))
* **android:** sync the vault with the encrypted service ([6b9b071](https://github.com/julsql/thecode/commit/6b9b07138cde3d1f29c9cf70e922ef1168038755))
* **android:** tint the app pink in v1 ([11d2884](https://github.com/julsql/thecode/commit/11d28840bc237bb2b76888c1968a2cc46a3d16ea))
* **android:** transfer the vault by QR code ([f0002c9](https://github.com/julsql/thecode/commit/f0002c9e0872d86373ce736ea327e6740d3a8604))
* **apps:** invite people to sync, without a word about price ([34a2d20](https://github.com/julsql/thecode/commit/34a2d2044f5364867a6b621941a011559eb90e5b))
* **canonical:** unify domain canonicalisation across all platforms ([4b84d49](https://github.com/julsql/thecode/commit/4b84d491dcede5978379e21cf1b8091e62c60fc9))
* **clients:** point to the site for creating and managing an account ([592f706](https://github.com/julsql/thecode/commit/592f7065ee3f93f3d51fa72df7d083df1056f967))
* derive v2 in autofill regardless of the entry's version ([a0f4a3b](https://github.com/julsql/thecode/commit/a0f4a3ba3815f3168b6ef97b136ec80002593072))
* hide the paid plan on the page the apps link to ([c480bdd](https://github.com/julsql/thecode/commit/c480bdd3fe01372f6937771a6462deb520f05fa1))
* internationalisation, ajout langue anglaise ([39918cb](https://github.com/julsql/thecode/commit/39918cb0d11aa533c6a9e6655a2877e64580eb4a))
* make the renewal sell on the web and stay silent in the apps ([c46f20b](https://github.com/julsql/thecode/commit/c46f20b9e70947ec25490d1ad188a4d7a6465d57))
* mask the generated password and save it next to it ([642c671](https://github.com/julsql/thecode/commit/642c671bafa8a7c68433ee422617a4d79e71aae3))
* **mobile:** show the key fingerprint on Android and Apple ([2a003f4](https://github.com/julsql/thecode/commit/2a003f4b80af6ee72b203175ec73bf88df808691))
* point the clients at thecode-api.julsql.fr ([1c520b7](https://github.com/julsql/thecode/commit/1c520b710007a96b733a0f35477a1f296219299e))
* reword the v2 notice and translate it on every platform ([c7f38df](https://github.com/julsql/thecode/commit/c7f38dfe68a176076d47b2ccc2c5a279b77bff12))
* **shared:** drop the version field from vault entries ([11ba36b](https://github.com/julsql/thecode/commit/11ba36bdba0daf50338b297a5ec48f3a1c26b2f8))
* **shared:** make the vault spec and fixtures v2 only ([6abd021](https://github.com/julsql/thecode/commit/6abd021e0f2405f1f786173b89bf72681c456e52))
* show the v2 notice as a dialog, dismissed only by the checkbox ([abc80c2](https://github.com/julsql/thecode/commit/abc80c2dde101a1045e9ed7010872748cd7f69c4))
* sync only what the plan allows and flag duplicate accounts ([889f342](https://github.com/julsql/thecode/commit/889f342335b30bd73aac6489ce2515e8056b02b2))
* sync the vault and settings automatically ([ddf8fce](https://github.com/julsql/thecode/commit/ddf8fce37e2433e993f2fc1f125e344b5fdbe639))
* tell the vault's key-dependence above every vault ([5c508fe](https://github.com/julsql/thecode/commit/5c508fe17ffa9994ca19eac597f631c81907b440))
* the counter becomes part of the complete plan ([7a13ccc](https://github.com/julsql/thecode/commit/7a13ccc5e022b50858a367833f5535c28c6beb1f))
* username in autofill, Safari crash fix, and Sign in with Apple ([8616833](https://github.com/julsql/thecode/commit/8616833b34eb947be20787b0a22412bbd5a1f94b))
* v2-only vault with login, lock, shared settings and Google sign-in ([70183a6](https://github.com/julsql/thecode/commit/70183a6783cae7d8b1e8da3a59f9224599270a1f))
* **vault:** port the vault to the website, Android and Apple ([f8b99f8](https://github.com/julsql/thecode/commit/f8b99f8f19986091bae580ebfa274446e6bf0832))


### Bug Fixes

* address everything the new CI surfaced ([131d521](https://github.com/julsql/thecode/commit/131d521dbb4ef2c3992d3ed10476de057abaa5c9))
* align the save button right and make it larger on iOS and Android ([3b397c3](https://github.com/julsql/thecode/commit/3b397c3328b10a08bc2f3930306a13e41568cdaa))
* **android:** encrypt the master key at rest ([2957593](https://github.com/julsql/thecode/commit/29575936590477645111acf9548f744f86e126b0))
* **android:** gate site field behind auth, keep session alive, edit length ([f6a5114](https://github.com/julsql/thecode/commit/f6a511430442bc148f361e5e462ef54d4e762718))
* **android:** gate site field behind auth, keep session alive, edit length ([6efa363](https://github.com/julsql/thecode/commit/6efa36350dcda4eb18967e67324d6f7d8accffe7))
* **android:** keep the vault and transfer screens below the status bar ([11e4b04](https://github.com/julsql/thecode/commit/11e4b0482c179331b8e71ccbd99d2996f517056b))
* **android:** keep the vault unlocked through the device credential prompt ([1cae573](https://github.com/julsql/thecode/commit/1cae573d16ce02794dd105ad1d1e9f8c4f88278e))
* **android:** never push default settings that were never changed ([baa22c7](https://github.com/julsql/thecode/commit/baa22c768ce24c3a1a56502c3593218cbed0fd06))
* **android:** require authentication to open the vault ([24e896e](https://github.com/julsql/thecode/commit/24e896e1bff4008c3e645f11e25d33233917ea81))
* **android:** require device authentication before creating a vault password ([1cf935e](https://github.com/julsql/thecode/commit/1cf935e113220793139d3aefec78a463124091b2))
* **android:** restore session state in onResume, not onStart ([14edf1c](https://github.com/julsql/thecode/commit/14edf1c759eda072edd72703671165a54a41dd18))
* **android:** save only TheCode passwords from autofill ([20835fe](https://github.com/julsql/thecode/commit/20835fe79a3d42f17010022f7911ccc4aa0dd2f4))
* **android:** show the v2 notice only when the app opens ([1150c87](https://github.com/julsql/thecode/commit/1150c872c94da32deb6ff0557a23cf26ec7ff669))
* **android:** stack the small security line and the save button under the password ([053484d](https://github.com/julsql/thecode/commit/053484d8bbe050abe868088c7ad0e992a4ef4a3a))
* **android:** stop calling restricted Credential Manager APIs ([5da69f7](https://github.com/julsql/thecode/commit/5da69f74c772c90268db85ee13288bf9346e333e))
* **android:** use the typed username in autofill ([098715c](https://github.com/julsql/thecode/commit/098715c08b420b3477a3d424fc47345121caa981))
* **apple:** make the public suffix fallback loud instead of silent ([81760b7](https://github.com/julsql/thecode/commit/81760b77bfc9edceb283b2df4b64cca4675bbc49))
* compute the fingerprint after a pause, not on every keystroke ([0f8d1d1](https://github.com/julsql/thecode/commit/0f8d1d1218b8cec347eca100468ef4b4c1bda706))
* no password without a site on the website ([251651c](https://github.com/julsql/thecode/commit/251651ca67ebfc88a7a96a71bd783c3624fe32af))
* optional username in autofill, said out loud, and a stable website CI ([4fd9608](https://github.com/julsql/thecode/commit/4fd960843dd50c474c7ef328d91642295469da03))
* pin one canonical form for merge tie-breaks ([674bc06](https://github.com/julsql/thecode/commit/674bc06566a402d24080d280d8473eb99bd3e714))
* point every link at the monorepo ([aaab0eb](https://github.com/julsql/thecode/commit/aaab0eb62abf28b47ae83f91517d4dd785cacf0d))
* reset the algorithm mode to v2 on every launch ([d811ada](https://github.com/julsql/thecode/commit/d811ada57c5da17480eb7e8c3e7986ef1a9e4690))
* **shared:** rename vector fields to stop tripping secret scanners ([0c2dbd4](https://github.com/julsql/thecode/commit/0c2dbd430542529621ea4daf6fa1d319b9bf3168))
* **tests:** a tamper test that sometimes tampered with nothing ([4e7965e](https://github.com/julsql/thecode/commit/4e7965e9d556e3c89d4b23fa7508879abf1e16ad))
* **tests:** tamper with four characters, not one ([899200c](https://github.com/julsql/thecode/commit/899200c9a1fe935d97e2f90027d51c9e9265f20a))
* use the form's login in the in-page menu and explain the key above each vault ([a0fd072](https://github.com/julsql/thecode/commit/a0fd07293ea8e08751f7b5ab5be67c9b153e37cb))
* **website:** keep a false "deleted" absent after a sync ([cec1e12](https://github.com/julsql/thecode/commit/cec1e12aeb785d3191f32eb020055a6c7f8a278f))


### Performance Improvements

* **android:** write the synced vault off the main thread ([f45e83f](https://github.com/julsql/thecode/commit/f45e83f5e8525a4d4d92bc1698f3142c7d451fcc))

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
