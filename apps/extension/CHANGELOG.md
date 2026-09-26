# Changelog

## [4.0.0](https://github.com/julsql/thecode/compare/extension-v3.0.0...extension-v4.0.0) (2026-09-26)


### ⚠ BREAKING CHANGES

* **extension:** isV2Entry()/keepV2Entries() and VAULT_ENTRY_VERSION are replaced by dropVersion()/stripVersions().
* **shared:** vault entries no longer carry `v`; readers must drop it instead of filtering entries on it.
* **canonical:** passwords change on Android, the website and the CLI for the sites listed in docs/BREAKING-CHANGES.md.

### Features

* add a shared QR encoder, byte mode, EC level L ([c73fadc](https://github.com/julsql/thecode/commit/c73fadcf10513fb72476b78432299b0a2813003e))
* **algo:** add v2, coexisting with v1 entry by entry ([3015d4c](https://github.com/julsql/thecode/commit/3015d4ce21a45999576570d2bcd4c65e32d2551c))
* **canonical:** unify domain canonicalisation across all platforms ([4b84d49](https://github.com/julsql/thecode/commit/4b84d491dcede5978379e21cf1b8091e62c60fc9))
* clean code ([b230738](https://github.com/julsql/thecode/commit/b230738a90f9400e298233409084a9ba8820d28b))
* **clients:** point to the site for creating and managing an account ([592f706](https://github.com/julsql/thecode/commit/592f7065ee3f93f3d51fa72df7d083df1056f967))
* derive v2 in autofill regardless of the entry's version ([a0f4a3b](https://github.com/julsql/thecode/commit/a0f4a3ba3815f3168b6ef97b136ec80002593072))
* **domain:** Password are generated on domain name not hostname ([97d3d00](https://github.com/julsql/thecode/commit/97d3d00032500b66cdb660dfe7ceead8b2f9337c))
* extension safari android ([822b7c2](https://github.com/julsql/thecode/commit/822b7c2f04059a53edd31e2e02d721611e0fafa8))
* extension safari android ([b273122](https://github.com/julsql/thecode/commit/b273122f867fe500f2d943c41ed81bc7471b8637))
* **extension:** announce the move to v2, once ([9f05c25](https://github.com/julsql/thecode/commit/9f05c250a727b1c7116bf5a547d46095f4e6af6f))
* **extension:** derive from the vault entry, and renew or migrate it ([ea00210](https://github.com/julsql/thecode/commit/ea00210b63d1b3ee3709e338861a025c06385821))
* **extension:** hide the save button in v1 ([c675bb7](https://github.com/julsql/thecode/commit/c675bb7fa1c6c56ae119e49ddf119233f405cca8))
* **extension:** keep only v2 entries in the vault ([175ff32](https://github.com/julsql/thecode/commit/175ff3250dc2644c0bac5a0623de6543133a085d))
* **extension:** keep the vault unlocked for the key's 3-minute grace ([3a2ce6a](https://github.com/julsql/thecode/commit/3a2ce6a5458207119863e71894a4f8093a59257e))
* **extension:** let the popup generate with the v1 algorithm on demand ([cc18a99](https://github.com/julsql/thecode/commit/cc18a995557e7691b1833621fa99cac656932cc8))
* **extension:** let the popup set the account login ([4203a44](https://github.com/julsql/thecode/commit/4203a4409f75f6fea970cc58326868dba76d568b))
* **extension:** lock the vault screen behind a vault password ([d762b12](https://github.com/julsql/thecode/commit/d762b12dc75522beb0db2cbaeebec451bfc0923f))
* **extension:** manage vault entries from the vault page ([5e70e00](https://github.com/julsql/thecode/commit/5e70e00f0ac7a4e239c5c6aa673c8a5b33de21ce))
* **extension:** mask the generated password and save it next to it ([3220719](https://github.com/julsql/thecode/commit/3220719413a9108b8df3a6dcb0ce217302490f35))
* **extension:** offer to save the site after filling a password ([4d1f79c](https://github.com/julsql/thecode/commit/4d1f79cbd12db49887148dcc60ab063530f83c29))
* **extension:** port the vault to the service worker ([dd913c1](https://github.com/julsql/thecode/commit/dd913c1fae6d6843c3e5aa8cb6a5aba3086c1759))
* **extension:** redesign the popup around generation ([862f52c](https://github.com/julsql/thecode/commit/862f52c4856ee4569ebd16996e5f9da0ad140907))
* **extension:** remember the master key for the browser session ([7a6d6a5](https://github.com/julsql/thecode/commit/7a6d6a58febe9c9c725c3c565ac2efd430fe9fc0))
* **extension:** say which account the in-page menu computes for ([5a6a8ad](https://github.com/julsql/thecode/commit/5a6a8ad65821ac721c075a406445a7081b647a9f))
* **extension:** share default settings through the account ([4303c68](https://github.com/julsql/thecode/commit/4303c6842e7203a9fe0d789e485af72cc99cbc9a))
* **extension:** sign in to sync with Google ([df90492](https://github.com/julsql/thecode/commit/df90492aadbd2ca7e24c4048351537175564176e))
* **extension:** stop versioning vault entries ([d5535eb](https://github.com/julsql/thecode/commit/d5535ebac1610150441dacb6f398feaff83fb00f))
* **extension:** surface the vault and key fingerprint in the popup ([1160ee7](https://github.com/julsql/thecode/commit/1160ee7429507237ce1ea5e8ee780c3e925bec1c))
* **extension:** sync automatically ([6141786](https://github.com/julsql/thecode/commit/614178630e4b05f27c3db00d4c38e598dd3163db))
* **extension:** sync the vault through the server ([80e8203](https://github.com/julsql/thecode/commit/80e8203d06cbb3d952286fd6e7f75e71d23216ae))
* **extension:** tint the popup pink in v1 ([651079b](https://github.com/julsql/thecode/commit/651079bdd74cfd72d4fd8dee2f345519d10240b9))
* **extension:** transfer the vault by QR code or file ([ec973b5](https://github.com/julsql/thecode/commit/ec973b5ca1dcfcd0f049753e080a3b5bc44cd443))
* **extension:** translate the popup to English and French ([7b6e11e](https://github.com/julsql/thecode/commit/7b6e11e0c93d870999dfc78ab1fc330d4520885c))
* **input:** mise en forme de la sélection du mot de passe dans le navigateur ([0c32336](https://github.com/julsql/thecode/commit/0c323366e302e8ddb838f822a9c6164156aa992e))
* **input:** mise en forme de la sélection du mot de passe dans le navigateur ([0c32336](https://github.com/julsql/thecode/commit/0c323366e302e8ddb838f822a9c6164156aa992e))
* **lot4:** key fingerprint and variant grid ([fdd69b0](https://github.com/julsql/thecode/commit/fdd69b0a660e4034cfa3b73c9377fb1bc6343a65))
* make the renewal sell on the web and stay silent in the apps ([c46f20b](https://github.com/julsql/thecode/commit/c46f20b9e70947ec25490d1ad188a4d7a6465d57))
* mask the generated password and save it next to it ([642c671](https://github.com/julsql/thecode/commit/642c671bafa8a7c68433ee422617a4d79e71aae3))
* new coding function ([713b980](https://github.com/julsql/thecode/commit/713b98008b227301c355d960feaddbeecddc0e4a))
* point the clients at thecode-api.julsql.fr ([1c520b7](https://github.com/julsql/thecode/commit/1c520b710007a96b733a0f35477a1f296219299e))
* reword the v2 notice and translate it on every platform ([c7f38df](https://github.com/julsql/thecode/commit/c7f38dfe68a176076d47b2ccc2c5a279b77bff12))
* **shared:** drop the version field from vault entries ([11ba36b](https://github.com/julsql/thecode/commit/11ba36bdba0daf50338b297a5ec48f3a1c26b2f8))
* **shared:** make the vault spec and fixtures v2 only ([6abd021](https://github.com/julsql/thecode/commit/6abd021e0f2405f1f786173b89bf72681c456e52))
* show the v2 notice as a dialog, dismissed only by the checkbox ([abc80c2](https://github.com/julsql/thecode/commit/abc80c2dde101a1045e9ed7010872748cd7f69c4))
* sync only what the plan allows and flag duplicate accounts ([889f342](https://github.com/julsql/thecode/commit/889f342335b30bd73aac6489ce2515e8056b02b2))
* sync the vault and settings automatically ([ddf8fce](https://github.com/julsql/thecode/commit/ddf8fce37e2433e993f2fc1f125e344b5fdbe639))
* tell the vault's key-dependence above every vault ([5c508fe](https://github.com/julsql/thecode/commit/5c508fe17ffa9994ca19eac597f631c81907b440))
* the counter becomes part of the complete plan ([7a13ccc](https://github.com/julsql/thecode/commit/7a13ccc5e022b50858a367833f5535c28c6beb1f))
* v2-only vault with login, lock, shared settings and Google sign-in ([70183a6](https://github.com/julsql/thecode/commit/70183a6783cae7d8b1e8da3a59f9224599270a1f))
* **vault:** encrypted transfer between devices ([4f575bc](https://github.com/julsql/thecode/commit/4f575bcbd669968ad425f06b04139ca392810a69))


### Bug Fixes

* **apple:** make the public suffix fallback loud instead of silent ([81760b7](https://github.com/julsql/thecode/commit/81760b77bfc9edceb283b2df4b64cca4675bbc49))
* **extension:** drop the "license" key both browsers reject ([dcf5789](https://github.com/julsql/thecode/commit/dcf5789410a1da2556f9e187b39695fae4c09993))
* **extension:** load the vault scripts in the Firefox and Safari background ([d8ad46c](https://github.com/julsql/thecode/commit/d8ad46c48788c80b5f7a6a841e41ee0ad4d5c8fc))
* **extension:** persist generation params across service worker restarts ([4785e62](https://github.com/julsql/thecode/commit/4785e6228e9b936097381c0410cd849644074c0e))
* **extension:** persist generation params across service worker restarts ([20d2ac2](https://github.com/julsql/thecode/commit/20d2ac2fbf30f9dee3301c8c2b2837970f1203dc))
* **extension:** restrict getVault to extension pages ([439cc55](https://github.com/julsql/thecode/commit/439cc554b3a9796081587406a476fd8a4bb7ec47))
* **extension:** stop startup rehydration overwriting a concurrent save ([5febd6d](https://github.com/julsql/thecode/commit/5febd6d404aae0a105d32dde07f8f4f60e49f79a))
* **extension:** translate the vault page ([d1dad1e](https://github.com/julsql/thecode/commit/d1dad1eb3a8eb781efc5719387cf8cdb8b77c8ea))
* **extension:** use the form's login in the in-page menu ([224abdc](https://github.com/julsql/thecode/commit/224abdcc4ee0ee51763c976ae4d19086f4b641d3))
* ignore spaces around the login on the website and in the extension ([221dca8](https://github.com/julsql/thecode/commit/221dca822eeb94f7432c9c479f524cbde67950d3))
* inversion chiffres/symboles ([2edf14d](https://github.com/julsql/thecode/commit/2edf14d5522cf186f681a952c1ab4778f42be1f0))
* optional username in autofill, said out loud, and a stable website CI ([4fd9608](https://github.com/julsql/thecode/commit/4fd960843dd50c474c7ef328d91642295469da03))
* params ([3295497](https://github.com/julsql/thecode/commit/329549748451c75b80693ce76fb7ee05217ccad2))
* pin one canonical form for merge tie-breaks ([674bc06](https://github.com/julsql/thecode/commit/674bc06566a402d24080d280d8473eb99bd3e714))
* point every link at the monorepo ([aaab0eb](https://github.com/julsql/thecode/commit/aaab0eb62abf28b47ae83f91517d4dd785cacf0d))
* **security:** CodeQL language input and trivy scanners ([5552bd8](https://github.com/julsql/thecode/commit/5552bd8af95beea5824e689d896576b10fe69911))
* **security:** patch npm advisories and pin trivy correctly ([3d557c4](https://github.com/julsql/thecode/commit/3d557c4b3e1b9ef2551273eeeb8f3f7706d530c2))
* **shared:** rename vector fields to stop tripping secret scanners ([0c2dbd4](https://github.com/julsql/thecode/commit/0c2dbd430542529621ea4daf6fa1d319b9bf3168))
* use the form's login in the in-page menu and explain the key above each vault ([a0fd072](https://github.com/julsql/thecode/commit/a0fd07293ea8e08751f7b5ab5be67c9b153e37cb))
* **website:** keep a false "deleted" absent after a sync ([cec1e12](https://github.com/julsql/thecode/commit/cec1e12aeb785d3191f32eb020055a6c7f8a278f))

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
