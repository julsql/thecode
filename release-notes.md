:robot: I have created a release *beep* *boop*
---


<details><summary>extension: 3.0.0</summary>

## [3.0.0](https://github.com/julsql/thecode/compare/extension-v3.0.0...extension-v3.0.0) (2026-09-27)


###   BREAKING CHANGES

* **extension:** sync blobs and transfer payloads use the v2 format; v1 data is no longer read.
* **extension:** unlock the vault with the master key
* **shared:** v1 sync blobs and TC1 payloads are no longer readable.
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
* **extension:** declare data collection for addons.mozilla.org ([2e9c74d](https://github.com/julsql/thecode/commit/2e9c74dacac5a657eb3d515246c1fc62bafa352e))
* **extension:** derive from the vault entry, and renew or migrate it ([ea00210](https://github.com/julsql/thecode/commit/ea00210b63d1b3ee3709e338861a025c06385821))
* **extension:** guide toward a strong master key ([b425dac](https://github.com/julsql/thecode/commit/b425dac67725bf1eb0a701a114c86ee7988eb74f))
* **extension:** hide the save button in v1 ([c675bb7](https://github.com/julsql/thecode/commit/c675bb7fa1c6c56ae119e49ddf119233f405cca8))
* **extension:** keep only v2 entries in the vault ([175ff32](https://github.com/julsql/thecode/commit/175ff3250dc2644c0bac5a0623de6543133a085d))
* **extension:** keep the vault unlocked for the key's 3-minute grace ([3a2ce6a](https://github.com/julsql/thecode/commit/3a2ce6a5458207119863e71894a4f8093a59257e))
* **extension:** let the popup generate with the v1 algorithm on demand ([cc18a99](https://github.com/julsql/thecode/commit/cc18a995557e7691b1833621fa99cac656932cc8))
* **extension:** let the popup set the account login ([4203a44](https://github.com/julsql/thecode/commit/4203a4409f75f6fea970cc58326868dba76d568b))
* **extension:** lock the vault screen behind a vault password ([d762b12](https://github.com/julsql/thecode/commit/d762b12dc75522beb0db2cbaeebec451bfc0923f))
* **extension:** lock the whole session, not only the vault ([12824ae](https://github.com/julsql/thecode/commit/12824aedbf8698c27142b6e5f37f4a85d0ed0803))
* **extension:** manage vault entries from the vault page ([5e70e00](https://github.com/julsql/thecode/commit/5e70e00f0ac7a4e239c5c6aa673c8a5b33de21ce))
* **extension:** mask the generated password and save it next to it ([3220719](https://github.com/julsql/thecode/commit/3220719413a9108b8df3a6dcb0ce217302490f35))
* **extension:** offer to save the site after filling a password ([4d1f79c](https://github.com/julsql/thecode/commit/4d1f79cbd12db49887148dcc60ab063530f83c29))
* **extension:** per-account salt and bound ciphertexts ([fc10347](https://github.com/julsql/thecode/commit/fc103474aa1d03f4f03020d3d9fff8534039eebc))
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
* **extension:** unlock the vault with the master key ([f233704](https://github.com/julsql/thecode/commit/f233704337da9ec7b7c49729dc2ce102cb5cd3e8))
* **input:** mise en forme de la sélection du mot de passe dans le navigateur ([0c32336](https://github.com/julsql/thecode/commit/0c323366e302e8ddb838f822a9c6164156aa992e))
* **input:** mise en forme de la sélection du mot de passe dans le navigateur ([0c32336](https://github.com/julsql/thecode/commit/0c323366e302e8ddb838f822a9c6164156aa992e))
* **lot4:** key fingerprint and variant grid ([fdd69b0](https://github.com/julsql/thecode/commit/fdd69b0a660e4034cfa3b73c9377fb1bc6343a65))
* make the renewal sell on the web and stay silent in the apps ([c46f20b](https://github.com/julsql/thecode/commit/c46f20b9e70947ec25490d1ad188a4d7a6465d57))
* mask the generated password and save it next to it ([642c671](https://github.com/julsql/thecode/commit/642c671bafa8a7c68433ee422617a4d79e71aae3))
* open registration and make the sign-up code optional ([9a7b97d](https://github.com/julsql/thecode/commit/9a7b97d80c4965178fdb9d2bd177612a4a8c565d))
* point the clients at thecode-api.julsql.fr ([1c520b7](https://github.com/julsql/thecode/commit/1c520b710007a96b733a0f35477a1f296219299e))
* reword the v2 notice and translate it on every platform ([c7f38df](https://github.com/julsql/thecode/commit/c7f38dfe68a176076d47b2ccc2c5a279b77bff12))
* **shared:** drop the version field from vault entries ([11ba36b](https://github.com/julsql/thecode/commit/11ba36bdba0daf50338b297a5ec48f3a1c26b2f8))
* **shared:** make the vault spec and fixtures v2 only ([6abd021](https://github.com/julsql/thecode/commit/6abd021e0f2405f1f786173b89bf72681c456e52))
* **shared:** per-account salt and bound ciphertexts for sync and transfer ([24cf09f](https://github.com/julsql/thecode/commit/24cf09f98dc7dbc0d04997a7dcf46f0cab371c57))
* show the v2 notice as a dialog, dismissed only by the checkbox ([abc80c2](https://github.com/julsql/thecode/commit/abc80c2dde101a1045e9ed7010872748cd7f69c4))
* store compliance  in-app account deletion, Apple token revocation, no payment steering ([dae0fc9](https://github.com/julsql/thecode/commit/dae0fc915a0c86324dedf93d6ec0e1992032912d))
* sync only what the plan allows and flag duplicate accounts ([889f342](https://github.com/julsql/thecode/commit/889f342335b30bd73aac6489ce2515e8056b02b2))
* sync the vault and settings automatically ([ddf8fce](https://github.com/julsql/thecode/commit/ddf8fce37e2433e993f2fc1f125e344b5fdbe639))
* tell the vault's key-dependence above every vault ([5c508fe](https://github.com/julsql/thecode/commit/5c508fe17ffa9994ca19eac597f631c81907b440))
* the counter becomes part of the complete plan ([7a13ccc](https://github.com/julsql/thecode/commit/7a13ccc5e022b50858a367833f5535c28c6beb1f))
* v2-only vault with login, lock, shared settings and Google sign-in ([70183a6](https://github.com/julsql/thecode/commit/70183a6783cae7d8b1e8da3a59f9224599270a1f))
* **vault:** encrypted transfer between devices ([4f575bc](https://github.com/julsql/thecode/commit/4f575bcbd669968ad425f06b04139ca392810a69))


### Bug Fixes

* **apple:** make the public suffix fallback loud instead of silent ([81760b7](https://github.com/julsql/thecode/commit/81760b77bfc9edceb283b2df4b64cca4675bbc49))
* **extension:** call the sign-out button "Sign out" like everywhere else ([0e78f04](https://github.com/julsql/thecode/commit/0e78f04e4ff702fd07537407db5900be7edc0ba2))
* **extension:** drop the "license" key both browsers reject ([dcf5789](https://github.com/julsql/thecode/commit/dcf5789410a1da2556f9e187b39695fae4c09993))
* **extension:** load the vault scripts in the Firefox and Safari background ([d8ad46c](https://github.com/julsql/thecode/commit/d8ad46c48788c80b5f7a6a841e41ee0ad4d5c8fc))
* **extension:** persist generation params across service worker restarts ([4785e62](https://github.com/julsql/thecode/commit/4785e6228e9b936097381c0410cd849644074c0e))
* **extension:** persist generation params across service worker restarts ([20d2ac2](https://github.com/julsql/thecode/commit/20d2ac2fbf30f9dee3301c8c2b2837970f1203dc))
* **extension:** restrict getVault to extension pages ([439cc55](https://github.com/julsql/thecode/commit/439cc554b3a9796081587406a476fd8a4bb7ec47))
* **extension:** revoke the session on sign out ([a30382f](https://github.com/julsql/thecode/commit/a30382f9580bde61c5342aebb7f92c9b3534eeb2))
* **extension:** stop startup rehydration overwriting a concurrent save ([5febd6d](https://github.com/julsql/thecode/commit/5febd6d404aae0a105d32dde07f8f4f60e49f79a))
* **extension:** translate the vault page ([d1dad1e](https://github.com/julsql/thecode/commit/d1dad1eb3a8eb781efc5719387cf8cdb8b77c8ea))
* **extension:** use the form's login in the in-page menu ([224abdc](https://github.com/julsql/thecode/commit/224abdcc4ee0ee51763c976ae4d19086f4b641d3))
* ignore spaces around the login on the website and in the extension ([221dca8](https://github.com/julsql/thecode/commit/221dca822eeb94f7432c9c479f524cbde67950d3))
* inversion chiffres/symboles ([2edf14d](https://github.com/julsql/thecode/commit/2edf14d5522cf186f681a952c1ab4778f42be1f0))
* optional username in autofill, said out loud, and a stable website CI ([4fd9608](https://github.com/julsql/thecode/commit/4fd960843dd50c474c7ef328d91642295469da03))
* pin one canonical form for merge tie-breaks ([674bc06](https://github.com/julsql/thecode/commit/674bc06566a402d24080d280d8473eb99bd3e714))
* point every link at the monorepo ([aaab0eb](https://github.com/julsql/thecode/commit/aaab0eb62abf28b47ae83f91517d4dd785cacf0d))
* revoke the session on sign out ([f22e2a8](https://github.com/julsql/thecode/commit/f22e2a8a46ec41e4ab9ede8f3fd3e3a268d5682b))
* **security:** CodeQL language input and trivy scanners ([5552bd8](https://github.com/julsql/thecode/commit/5552bd8af95beea5824e689d896576b10fe69911))
* **security:** patch npm advisories and pin trivy correctly ([3d557c4](https://github.com/julsql/thecode/commit/3d557c4b3e1b9ef2551273eeeb8f3f7706d530c2))
* **shared:** rename vector fields to stop tripping secret scanners ([0c2dbd4](https://github.com/julsql/thecode/commit/0c2dbd430542529621ea4daf6fa1d319b9bf3168))
* stop the whole sync when a vault row was moved under another id ([0c87b79](https://github.com/julsql/thecode/commit/0c87b79aac459cd2f612689ae900e20c9cf0d019))
* use the form's login in the in-page menu and explain the key above each vault ([a0fd072](https://github.com/julsql/thecode/commit/a0fd07293ea8e08751f7b5ab5be67c9b153e37cb))
* **website:** keep a false "deleted" absent after a sync ([cec1e12](https://github.com/julsql/thecode/commit/cec1e12aeb785d3191f32eb020055a6c7f8a278f))
</details>

<details><summary>website: 3.0.0</summary>

## [3.0.0](https://github.com/julsql/thecode/compare/website-v2.0.0...website-v3.0.0) (2026-09-27)


###   BREAKING CHANGES

* **website:** sync blobs and transfer payloads use the v2 format; v1 data is no longer read.
* **website:** unlock the vault with the master key
* **shared:** v1 sync blobs and TC1 payloads are no longer readable.
* **website:** VaultEntry has no `v`; isVaultEntryV2()/keepV2Only() and VAULT_ENTRY_VERSION are replaced by dropVersion()/stripVersions().
* **shared:** vault entries no longer carry `v`; readers must drop it instead of filtering entries on it.
* **canonical:** passwords change on Android, the website and the CLI for the sites listed in docs/BREAKING-CHANGES.md.

### Features

* add a shared QR encoder, byte mode, EC level L ([c73fadc](https://github.com/julsql/thecode/commit/c73fadcf10513fb72476b78432299b0a2813003e))
* **algo:** add v2, coexisting with v1 entry by entry ([3015d4c](https://github.com/julsql/thecode/commit/3015d4ce21a45999576570d2bcd4c65e32d2551c))
* **api:** send the mail for real, and cap the free plan at five entries ([ddd37d3](https://github.com/julsql/thecode/commit/ddd37d3dfb898f0d4b2777dedb68ee0ebc55a0f3))
* **canonical:** unify domain canonicalisation across all platforms ([4b84d49](https://github.com/julsql/thecode/commit/4b84d491dcede5978379e21cf1b8091e62c60fc9))
* cap connected devices at 3 on the free plan and 10 on the paid one ([7d795d3](https://github.com/julsql/thecode/commit/7d795d34d00387e15739c050ba33e200739f8bcb))
* google ownership ([42e6c44](https://github.com/julsql/thecode/commit/42e6c440a9dea58ed4b67cea3167d3d50ffd74f1))
* hide the paid plan on the page the apps link to ([c480bdd](https://github.com/julsql/thecode/commit/c480bdd3fe01372f6937771a6462deb520f05fa1))
* let a Google account stand on its own and drop the link ([a624ce6](https://github.com/julsql/thecode/commit/a624ce6d2a4809f9187814c23ab779ee10831e50))
* make the renewal sell on the web and stay silent in the apps ([c46f20b](https://github.com/julsql/thecode/commit/c46f20b9e70947ec25490d1ad188a4d7a6465d57))
* mask the generated password and save it next to it ([642c671](https://github.com/julsql/thecode/commit/642c671bafa8a7c68433ee422617a4d79e71aae3))
* open registration and make the sign-up code optional ([9a7b97d](https://github.com/julsql/thecode/commit/9a7b97d80c4965178fdb9d2bd177612a4a8c565d))
* open registration up to a quota, then ask for a referral code ([6f22257](https://github.com/julsql/thecode/commit/6f222574dad80ba54449d754cc75092a930b588c))
* point the clients at thecode-api.julsql.fr ([1c520b7](https://github.com/julsql/thecode/commit/1c520b710007a96b733a0f35477a1f296219299e))
* reword the v2 notice and translate it on every platform ([c7f38df](https://github.com/julsql/thecode/commit/c7f38dfe68a176076d47b2ccc2c5a279b77bff12))
* **shared:** drop the version field from vault entries ([11ba36b](https://github.com/julsql/thecode/commit/11ba36bdba0daf50338b297a5ec48f3a1c26b2f8))
* **shared:** make the vault spec and fixtures v2 only ([6abd021](https://github.com/julsql/thecode/commit/6abd021e0f2405f1f786173b89bf72681c456e52))
* **shared:** per-account salt and bound ciphertexts for sync and transfer ([24cf09f](https://github.com/julsql/thecode/commit/24cf09f98dc7dbc0d04997a7dcf46f0cab371c57))
* show the v2 notice as a dialog, dismissed only by the checkbox ([abc80c2](https://github.com/julsql/thecode/commit/abc80c2dde101a1045e9ed7010872748cd7f69c4))
* store compliance  in-app account deletion, Apple token revocation, no payment steering ([dae0fc9](https://github.com/julsql/thecode/commit/dae0fc915a0c86324dedf93d6ec0e1992032912d))
* sync only what the plan allows and flag duplicate accounts ([889f342](https://github.com/julsql/thecode/commit/889f342335b30bd73aac6489ce2515e8056b02b2))
* sync the vault and settings automatically ([ddf8fce](https://github.com/julsql/thecode/commit/ddf8fce37e2433e993f2fc1f125e344b5fdbe639))
* tell the vault's key-dependence above every vault ([5c508fe](https://github.com/julsql/thecode/commit/5c508fe17ffa9994ca19eac597f631c81907b440))
* the counter becomes part of the complete plan ([7a13ccc](https://github.com/julsql/thecode/commit/7a13ccc5e022b50858a367833f5535c28c6beb1f))
* username in autofill, Safari crash fix, and Sign in with Apple ([8616833](https://github.com/julsql/thecode/commit/8616833b34eb947be20787b0a22412bbd5a1f94b))
* v2-only vault with login, lock, shared settings and Google sign-in ([70183a6](https://github.com/julsql/thecode/commit/70183a6783cae7d8b1e8da3a59f9224599270a1f))
* **vault:** encrypted transfer between devices ([4f575bc](https://github.com/julsql/thecode/commit/4f575bcbd669968ad425f06b04139ca392810a69))
* **vault:** port the vault to the website, Android and Apple ([f8b99f8](https://github.com/julsql/thecode/commit/f8b99f8f19986091bae580ebfa274446e6bf0832))
* **website:** account area, pricing page and subscription ([22f03db](https://github.com/julsql/thecode/commit/22f03db7911f6f9c85ca6ed675a801c6ccb6608e))
* **website:** add a password lock for the vault screen ([e5cdd9b](https://github.com/julsql/thecode/commit/e5cdd9b961f430d4ed2a74f5413e153cbfdfca50))
* **website:** announce the move to v2 on the generator page ([ad26c8a](https://github.com/julsql/thecode/commit/ad26c8afefa12650f1ceb590d19d5304f46e2347))
* **website:** export and import an encrypted vault ([36adab6](https://github.com/julsql/thecode/commit/36adab6a65f076505fc9cc2c0f656fe597778c63))
* **website:** generate in v2 by default, with a way back to v1 ([f7419b9](https://github.com/julsql/thecode/commit/f7419b961faf9b838fd796b9050a94866e03dbda))
* **website:** Google sign-in, credential changes and password reset ([4362609](https://github.com/julsql/thecode/commit/4362609c6d42b10f3b1f1721e6e454cc44503fa3))
* **website:** guide toward a strong master key ([9c87bbb](https://github.com/julsql/thecode/commit/9c87bbb6fe7f13b5782a87389ca553b35a6822d1))
* **website:** hide the save button in v1 ([3087b55](https://github.com/julsql/thecode/commit/3087b5529df20adbd84b4a49974779744863e3fb))
* **website:** identify website sessions to the service ([ec29da5](https://github.com/julsql/thecode/commit/ec29da581e69912e3a490d6a6f35a8f3e25f6350))
* **website:** implement v2, and renew or migrate an entry ([568786b](https://github.com/julsql/thecode/commit/568786bfb99c9b9deb48598be0cac132aafff0ca))
* **website:** keep only v2 entries in the vault ([d2277f4](https://github.com/julsql/thecode/commit/d2277f4488216cd061a1ef12fa5e72d7e3587d2a))
* **website:** keep the legal notice off the site until it can be filled ([9a18eb3](https://github.com/julsql/thecode/commit/9a18eb3481229c39bceab84d6f39370c82983d58))
* **website:** keep the vault unlocked for the key's 3-minute grace ([e69dfd3](https://github.com/julsql/thecode/commit/e69dfd3a64f44f1aba09621a4ecf924f4cf0a396))
* **website:** legal pages, data export and account deletion ([42b0f55](https://github.com/julsql/thecode/commit/42b0f55361a0518dde2d33955008c129445ba5fb))
* **website:** let the generator take the account login ([d715dbb](https://github.com/julsql/thecode/commit/d715dbb6701ea741238cbbdda5fef3fa5cbb0467))
* **website:** lock the whole session, not only the vault ([2544a9d](https://github.com/julsql/thecode/commit/2544a9d9e9ab0ee2ecdf538d604d4a0de58ed535))
* **website:** make the algorithm a mode at the top of the card ([8e42403](https://github.com/julsql/thecode/commit/8e4240351d5f7de8b54fedefd9aac152097e3111))
* **website:** mask the generated password and save it next to it ([784dee7](https://github.com/julsql/thecode/commit/784dee7820509d69a4f1367c9d17177a9fcc3b7a))
* **website:** move vault management to a locked vault page ([c18258f](https://github.com/julsql/thecode/commit/c18258fac663d8f034bd1a1d06a6a7a66278fb3f))
* **website:** per-account salt and bound ciphertexts ([4f9914b](https://github.com/julsql/thecode/commit/4f9914b31ef71cfdba326a60ef669fd2bca4c1b9))
* **website:** permanent recovery page for the v1 algorithm ([019f3c8](https://github.com/julsql/thecode/commit/019f3c8c5da40f2a8255cc976cf90a8169ae8007))
* **website:** remember default settings and share them through the account ([72aef0a](https://github.com/julsql/thecode/commit/72aef0a63089c62db8dba931e840d4a24658a3d7))
* **website:** send the Apple authorization code ([581da23](https://github.com/julsql/thecode/commit/581da237e4e4960e7dea5be66692011dcf22a2b8))
* **website:** show nothing for sale while nothing is sold ([6538e6f](https://github.com/julsql/thecode/commit/6538e6f7a82901d4b02f7b19704fcd5ceafd105b))
* **website:** show which algorithm is in force, and record it ([b18bdf6](https://github.com/julsql/thecode/commit/b18bdf627c553c2eee2c4632f4043f3a3df1b500))
* **website:** sign in with Apple ([2eda973](https://github.com/julsql/thecode/commit/2eda9736df5abcad075b832a3a1a2f90a737e7fe))
* **website:** stop versioning vault entries ([3967e6a](https://github.com/julsql/thecode/commit/3967e6a37c5045b918ee4e84d9e540e05799ab18))
* **website:** surface the vault and key fingerprint ([94487e0](https://github.com/julsql/thecode/commit/94487e059c9591e5df98341979db11fe15fa0dca))
* **website:** sync automatically ([51189a2](https://github.com/julsql/thecode/commit/51189a23f39f07e693057879ea525b9cfcf8cebc))
* **website:** sync the vault through the server ([6978165](https://github.com/julsql/thecode/commit/6978165037de08f9fd32be5b8c5351a18c172987))
* **website:** tint the generator pink in v1 ([4861807](https://github.com/julsql/thecode/commit/48618075e1c24be03016e31aceb42d7798f60da3))
* **website:** transfer the vault by QR code or file ([0e1b3c8](https://github.com/julsql/thecode/commit/0e1b3c8c7eda241b3ce857b726e7ac2d15614a22))
* **website:** unlock the vault with the master key ([66d83ea](https://github.com/julsql/thecode/commit/66d83ea8221d01b3e82d6792fe37239aeaa1cbd9))


### Bug Fixes

* **build:** @types/node manquant (build CI KO) ([e18f53d](https://github.com/julsql/thecode/commit/e18f53d65bf3494081ed3edd273b76fc5429e52e))
* **build:** add @types/node so vite.config typechecks in CI ([ee880e4](https://github.com/julsql/thecode/commit/ee880e4f96fe9e8b7fe76aefb7a8f0e7f4a396fd))
* **deps:** bump nanoid to 3.3.18 ([#15](https://github.com/julsql/thecode/issues/15)) ([bb5a8e0](https://github.com/julsql/thecode/commit/bb5a8e0f0eb8476de1d92fa84ea1a2d88b6b63d7))
* ignore spaces around the login on the website and in the extension ([221dca8](https://github.com/julsql/thecode/commit/221dca822eeb94f7432c9c479f524cbde67950d3))
* no password without a site on the website ([251651c](https://github.com/julsql/thecode/commit/251651ca67ebfc88a7a96a71bd783c3624fe32af))
* optional username in autofill, said out loud, and a stable website CI ([4fd9608](https://github.com/julsql/thecode/commit/4fd960843dd50c474c7ef328d91642295469da03))
* pin one canonical form for merge tie-breaks ([674bc06](https://github.com/julsql/thecode/commit/674bc06566a402d24080d280d8473eb99bd3e714))
* point every link at the monorepo ([aaab0eb](https://github.com/julsql/thecode/commit/aaab0eb62abf28b47ae83f91517d4dd785cacf0d))
* reset the algorithm mode to v2 on every launch ([d811ada](https://github.com/julsql/thecode/commit/d811ada57c5da17480eb7e8c3e7986ef1a9e4690))
* resolve 7 Dependabot security alerts ([f1f1fa2](https://github.com/julsql/thecode/commit/f1f1fa27ec31759cbd4e0d4374343f6c7104e97c))
* resolve 7 Dependabot security alerts ([68e20ff](https://github.com/julsql/thecode/commit/68e20ff764c65ddbda20c7996d593c6e6f91ee30))
* revoke the session on sign out ([f22e2a8](https://github.com/julsql/thecode/commit/f22e2a8a46ec41e4ab9ede8f3fd3e3a268d5682b))
* **security:** CodeQL language input and trivy scanners ([5552bd8](https://github.com/julsql/thecode/commit/5552bd8af95beea5824e689d896576b10fe69911))
* **shared:** rename vector fields to stop tripping secret scanners ([0c2dbd4](https://github.com/julsql/thecode/commit/0c2dbd430542529621ea4daf6fa1d319b9bf3168))
* stop the whole sync when a vault row was moved under another id ([0c87b79](https://github.com/julsql/thecode/commit/0c87b79aac459cd2f612689ae900e20c9cf0d019))
* **tests:** a tamper test that sometimes tampered with nothing ([4e7965e](https://github.com/julsql/thecode/commit/4e7965e9d556e3c89d4b23fa7508879abf1e16ad))
* **tests:** tamper with four characters, not one ([899200c](https://github.com/julsql/thecode/commit/899200c9a1fe935d97e2f90027d51c9e9265f20a))
* **tests:** write fixture passwords so they read as fixtures ([1e14e93](https://github.com/julsql/thecode/commit/1e14e93f4e28328c849d3735be5610a680295b5d))
* use the form's login in the in-page menu and explain the key above each vault ([a0fd072](https://github.com/julsql/thecode/commit/a0fd07293ea8e08751f7b5ab5be67c9b153e37cb))
* **website:** apply Alpine security updates in the image ([5edd6bc](https://github.com/julsql/thecode/commit/5edd6bc9adaa6662aec14bc4bf5420b213eac6e6))
* **website:** bring back the violet for v2, keep pink for v1 ([f5bd1eb](https://github.com/julsql/thecode/commit/f5bd1eb561bd8404da7800a18d3f7e627d2bb97c))
* **website:** bring back the violet for v2, keep pink for v1 ([7af7b71](https://github.com/julsql/thecode/commit/7af7b717394dad21c49c11c78e7bec9927606a08))
* **website:** describe the algorithm the product actually runs ([827dc47](https://github.com/julsql/thecode/commit/827dc47364d2198b95ec57e2b97cf82d4ec563ea))
* **website:** drop the Safari extension in favour of the Apple AutoFill apps ([02e003a](https://github.com/julsql/thecode/commit/02e003a80b797e18cdd3e0e6c3dcf22dcb85fec6))
* **website:** generate nothing without a site ([e570776](https://github.com/julsql/thecode/commit/e5707768385180db8838a08e9ea5669b99cea2d4))
* **website:** hide pricing links when opened from an app ([3641221](https://github.com/julsql/thecode/commit/364122158e9585beddad3e7e61ec66ebb66c9557))
* **website:** ignore a generation whose result arrives too late ([2e35c51](https://github.com/julsql/thecode/commit/2e35c51206e9967efd619e537b2c19efd523d930))
* **website:** keep a false "deleted" absent after a sync ([cec1e12](https://github.com/julsql/thecode/commit/cec1e12aeb785d3191f32eb020055a6c7f8a278f))
* **website:** make the vault, transfer and sync actions legible ([50e6163](https://github.com/julsql/thecode/commit/50e6163707337d6f2d669ffc9ba667f3a995a2d8))
* **website:** put the strength bar back beside what it measures ([e613275](https://github.com/julsql/thecode/commit/e613275c1544ac5d2df6f426db718f8689e9175a))
* **website:** remove the Safari extension from the website ([4228a42](https://github.com/julsql/thecode/commit/4228a42ea82f65eb253f909ce52a798661d343df))
* **website:** revoke the session on sign out ([3ed2b0d](https://github.com/julsql/thecode/commit/3ed2b0da11b15fc7b85833cc1b95b187e3e8a5a0))
* **website:** satisfy the build's stricter type checking ([139835c](https://github.com/julsql/thecode/commit/139835cf1db1077717b45c6a5d4c0c085a92213f))
* **website:** show account messages next to the field that caused them ([eb97a74](https://github.com/julsql/thecode/commit/eb97a7414dcc1a716718445a6cab1f6766a3befe))
* **website:** show the Google button again after signing out ([46bccf3](https://github.com/julsql/thecode/commit/46bccf3ff34717f2ca1f52fc8bf682140c5010c5))
* **website:** type-check the duplicate scan and sync messages ([e97c5a7](https://github.com/julsql/thecode/commit/e97c5a76a164653374ed33869554948e59c2ee2c))
* **website:** widen the vault page ([5966f59](https://github.com/julsql/thecode/commit/5966f595050bf3f982a44a0cf10fd4ddb0b4472d))
</details>

<details><summary>cli: 3.0.0</summary>

## [3.0.0](https://github.com/julsql/thecode/compare/cli-v2.0.0...cli-v3.0.0) (2026-09-27)


###   BREAKING CHANGES

* **cli:** TC1 payloads and v1 sync blobs are refused.
* **shared:** v1 sync blobs and TC1 payloads are no longer readable.
* **cli:** new_entry() no longer takes `version`, and keep_supported() is replaced by strip_versions()/drop_version().
* **shared:** vault entries no longer carry `v`; readers must drop it instead of filtering entries on it.
* **cli:** v1 entries are no longer read from the vault, and --migrate is gone. --algo 1 still generates, outside the vault.
* **canonical:** passwords change on Android, the website and the CLI for the sites listed in docs/BREAKING-CHANGES.md.

### Features

* **algo:** add v2, coexisting with v1 entry by entry ([3015d4c](https://github.com/julsql/thecode/commit/3015d4ce21a45999576570d2bcd4c65e32d2551c))
* **canonical:** unify domain canonicalisation across all platforms ([4b84d49](https://github.com/julsql/thecode/commit/4b84d491dcede5978379e21cf1b8091e62c60fc9))
* **cli:** default to v2, keep --algo 1 as the way back ([b77e410](https://github.com/julsql/thecode/commit/b77e410073ff6f9c68fbb3e6b2f803e831781b3e))
* **cli:** derive the sync key from the account salt and bind every ciphertext ([82c0d86](https://github.com/julsql/thecode/commit/82c0d865ab4fb5e63ec30cc7bda11d59ad1526fd))
* **clients:** point to the site for creating and managing an account ([592f706](https://github.com/julsql/thecode/commit/592f7065ee3f93f3d51fa72df7d083df1056f967))
* **cli:** keep the vault v2 only ([f1cdda3](https://github.com/julsql/thecode/commit/f1cdda3323b6143d6701e6d1c5ad804edd87d1f7))
* **cli:** make the registration code optional ([59e2c4b](https://github.com/julsql/thecode/commit/59e2c4b0d17797bf69974a7bcee15ac6fe8c4ffe))
* **cli:** remember default settings and share them through the account ([2531462](https://github.com/julsql/thecode/commit/2531462d1669417e663f47e38a5b3e9b49d570ec))
* **cli:** renew an entry's password with --renew ([0a3a1f5](https://github.com/julsql/thecode/commit/0a3a1f526b1fc7db8099ee23ec782de9b9a0e75f))
* **cli:** stop versioning vault entries ([5faa65e](https://github.com/julsql/thecode/commit/5faa65ef397823b1925819723768ea0e0882b576))
* **cli:** sync the vault through the server ([96c4df4](https://github.com/julsql/thecode/commit/96c4df4710e072589f69cb1aa862a559ccacd0fe))
* **lot4:** key fingerprint and variant grid ([fdd69b0](https://github.com/julsql/thecode/commit/fdd69b0a660e4034cfa3b73c9377fb1bc6343a65))
* open registration and make the sign-up code optional ([9a7b97d](https://github.com/julsql/thecode/commit/9a7b97d80c4965178fdb9d2bd177612a4a8c565d))
* point the clients at thecode-api.julsql.fr ([1c520b7](https://github.com/julsql/thecode/commit/1c520b710007a96b733a0f35477a1f296219299e))
* **shared:** drop the version field from vault entries ([11ba36b](https://github.com/julsql/thecode/commit/11ba36bdba0daf50338b297a5ec48f3a1c26b2f8))
* **shared:** make the vault spec and fixtures v2 only ([6abd021](https://github.com/julsql/thecode/commit/6abd021e0f2405f1f786173b89bf72681c456e52))
* **shared:** per-account salt and bound ciphertexts for sync and transfer ([24cf09f](https://github.com/julsql/thecode/commit/24cf09f98dc7dbc0d04997a7dcf46f0cab371c57))
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
* stop the whole sync when a vault row was moved under another id ([0c87b79](https://github.com/julsql/thecode/commit/0c87b79aac459cd2f612689ae900e20c9cf0d019))


### Documentation

* bring every README up to date ([f7c46f3](https://github.com/julsql/thecode/commit/f7c46f3de33256db386aba6cb2b277f3d4e37a56))
* bring the READMEs up to date and add the licence ([4a43a0f](https://github.com/julsql/thecode/commit/4a43a0fe19f23379798eaddc3766d9c38f1ce8c2))
* describe the five clients and the v1 fallback in the test vectors ([4e98fbd](https://github.com/julsql/thecode/commit/4e98fbd84e476b1750be409430a6bfebd5a38980))
* document the optional sign-up code ([55d8a5d](https://github.com/julsql/thecode/commit/55d8a5ded7dde545409c30ee78647bd4d8f0aa6c))
* **readme:** add status badges and document --show option ([#2](https://github.com/julsql/thecode/issues/2)) ([6831ec3](https://github.com/julsql/thecode/commit/6831ec3c443723888b496bdb84ad49eeb1b9a167))
* **readme:** fix badges after repository transfer ([#3](https://github.com/julsql/thecode/issues/3)) ([83718a1](https://github.com/julsql/thecode/commit/83718a149388d8b6ac5080c2c31f8d99623b7a30))
</details>

<details><summary>android: 3.0.0</summary>

## [3.0.0](https://github.com/julsql/thecode/compare/android-v3.0.0...android-v3.0.0) (2026-09-27)


###   BREAKING CHANGES

* **android:** v1 sync blobs and TC1 transfer payloads are no longer read.
* **shared:** v1 sync blobs and TC1 payloads are no longer readable.
* **android:** VaultPassword and the stored vault lock record are removed; any leftover record is deleted on startup.
* **android:** vault entries are written without `v`.
* **shared:** vault entries no longer carry `v`; readers must drop it instead of filtering entries on it.
* **canonical:** passwords change on Android, the website and the CLI for the sites listed in docs/BREAKING-CHANGES.md.

### Features

* add title une header bar ([8add690](https://github.com/julsql/thecode/commit/8add6904b370276cc9ac96733cc0e8456e9a909d))
* **algo:** add v2, coexisting with v1 entry by entry ([3015d4c](https://github.com/julsql/thecode/commit/3015d4ce21a45999576570d2bcd4c65e32d2551c))
* **android:** add a login field to the generator ([d9b7280](https://github.com/julsql/thecode/commit/d9b72805a6dc4c9e56181749d6bf7112f75add8a))
* **android:** add a vault screen ([fabd806](https://github.com/julsql/thecode/commit/fabd8069294b34be045ee0b57008c2e839429b86))
* **android:** announce the move to v2, once ([82a6e42](https://github.com/julsql/thecode/commit/82a6e421a3a4851be85e846da16f6044fe5100b9))
* **android:** delete the account from the app ([f69d11e](https://github.com/julsql/thecode/commit/f69d11e54ef918d3155f729cec138b45a3c98810))
* **android:** encrypt the vault for transfer ([797a22d](https://github.com/julsql/thecode/commit/797a22dcf09038454310dde549ba5323e6fba7f1))
* **android:** export and import an encrypted vault ([af69e32](https://github.com/julsql/thecode/commit/af69e321b3d102e84fba8297b50aa5b2dbee2baa))
* **android:** generate in v2 by default, with a way back to v1 ([02abc19](https://github.com/julsql/thecode/commit/02abc19a0dc4b785c8f617ef45cb66aa921712ca))
* **android:** guide toward a strong master key ([0eef55f](https://github.com/julsql/thecode/commit/0eef55f171ae7233796aa7b67be24eaa26aefa31))
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
* **android:** per-account salt and bound ciphertexts ([b8b7c4a](https://github.com/julsql/thecode/commit/b8b7c4a983d8f3be7b5b0f22a1579bcd1e50f6bb))
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
* **android:** unlock the vault with biometrics or the master key ([a7f241c](https://github.com/julsql/thecode/commit/a7f241c4c76613e2bfa7935cd0c4646a0899b3fd))
* **apps:** invite people to sync, without a word about price ([34a2d20](https://github.com/julsql/thecode/commit/34a2d2044f5364867a6b621941a011559eb90e5b))
* **canonical:** unify domain canonicalisation across all platforms ([4b84d49](https://github.com/julsql/thecode/commit/4b84d491dcede5978379e21cf1b8091e62c60fc9))
* **clients:** point to the site for creating and managing an account ([592f706](https://github.com/julsql/thecode/commit/592f7065ee3f93f3d51fa72df7d083df1056f967))
* derive v2 in autofill regardless of the entry's version ([a0f4a3b](https://github.com/julsql/thecode/commit/a0f4a3ba3815f3168b6ef97b136ec80002593072))
* hide the paid plan on the page the apps link to ([c480bdd](https://github.com/julsql/thecode/commit/c480bdd3fe01372f6937771a6462deb520f05fa1))
* internationalisation, ajout langue anglaise ([39918cb](https://github.com/julsql/thecode/commit/39918cb0d11aa533c6a9e6655a2877e64580eb4a))
* make the renewal sell on the web and stay silent in the apps ([c46f20b](https://github.com/julsql/thecode/commit/c46f20b9e70947ec25490d1ad188a4d7a6465d57))
* mask the generated password and save it next to it ([642c671](https://github.com/julsql/thecode/commit/642c671bafa8a7c68433ee422617a4d79e71aae3))
* **mobile:** show the key fingerprint on Android and Apple ([2a003f4](https://github.com/julsql/thecode/commit/2a003f4b80af6ee72b203175ec73bf88df808691))
* open registration and make the sign-up code optional ([9a7b97d](https://github.com/julsql/thecode/commit/9a7b97d80c4965178fdb9d2bd177612a4a8c565d))
* point the clients at thecode-api.julsql.fr ([1c520b7](https://github.com/julsql/thecode/commit/1c520b710007a96b733a0f35477a1f296219299e))
* reword the v2 notice and translate it on every platform ([c7f38df](https://github.com/julsql/thecode/commit/c7f38dfe68a176076d47b2ccc2c5a279b77bff12))
* **shared:** drop the version field from vault entries ([11ba36b](https://github.com/julsql/thecode/commit/11ba36bdba0daf50338b297a5ec48f3a1c26b2f8))
* **shared:** make the vault spec and fixtures v2 only ([6abd021](https://github.com/julsql/thecode/commit/6abd021e0f2405f1f786173b89bf72681c456e52))
* **shared:** per-account salt and bound ciphertexts for sync and transfer ([24cf09f](https://github.com/julsql/thecode/commit/24cf09f98dc7dbc0d04997a7dcf46f0cab371c57))
* show the v2 notice as a dialog, dismissed only by the checkbox ([abc80c2](https://github.com/julsql/thecode/commit/abc80c2dde101a1045e9ed7010872748cd7f69c4))
* store compliance  in-app account deletion, Apple token revocation, no payment steering ([dae0fc9](https://github.com/julsql/thecode/commit/dae0fc915a0c86324dedf93d6ec0e1992032912d))
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
* **android:** revoke the session on sign out ([b201a5a](https://github.com/julsql/thecode/commit/b201a5ae987a02549f15a213cb4d98e118d4d03d))
* **android:** save only TheCode passwords from autofill ([20835fe](https://github.com/julsql/thecode/commit/20835fe79a3d42f17010022f7911ccc4aa0dd2f4))
* **android:** show the v2 notice only when the app opens ([1150c87](https://github.com/julsql/thecode/commit/1150c872c94da32deb6ff0557a23cf26ec7ff669))
* **android:** stack the small security line and the save button under the password ([053484d](https://github.com/julsql/thecode/commit/053484d8bbe050abe868088c7ad0e992a4ef4a3a))
* **android:** stop calling restricted Credential Manager APIs ([5da69f7](https://github.com/julsql/thecode/commit/5da69f74c772c90268db85ee13288bf9346e333e))
* **android:** stop pointing to the paid plan outside the store ([8c2b0d8](https://github.com/julsql/thecode/commit/8c2b0d85bc1b208da25d4c2a6efde40a4d78996e))
* **android:** use the typed username in autofill ([098715c](https://github.com/julsql/thecode/commit/098715c08b420b3477a3d424fc47345121caa981))
* **apple:** make the public suffix fallback loud instead of silent ([81760b7](https://github.com/julsql/thecode/commit/81760b77bfc9edceb283b2df4b64cca4675bbc49))
* compute the fingerprint after a pause, not on every keystroke ([0f8d1d1](https://github.com/julsql/thecode/commit/0f8d1d1218b8cec347eca100468ef4b4c1bda706))
* no password without a site on the website ([251651c](https://github.com/julsql/thecode/commit/251651ca67ebfc88a7a96a71bd783c3624fe32af))
* optional username in autofill, said out loud, and a stable website CI ([4fd9608](https://github.com/julsql/thecode/commit/4fd960843dd50c474c7ef328d91642295469da03))
* pin one canonical form for merge tie-breaks ([674bc06](https://github.com/julsql/thecode/commit/674bc06566a402d24080d280d8473eb99bd3e714))
* point every link at the monorepo ([aaab0eb](https://github.com/julsql/thecode/commit/aaab0eb62abf28b47ae83f91517d4dd785cacf0d))
* reset the algorithm mode to v2 on every launch ([d811ada](https://github.com/julsql/thecode/commit/d811ada57c5da17480eb7e8c3e7986ef1a9e4690))
* revoke the session on sign out ([f22e2a8](https://github.com/julsql/thecode/commit/f22e2a8a46ec41e4ab9ede8f3fd3e3a268d5682b))
* **shared:** rename vector fields to stop tripping secret scanners ([0c2dbd4](https://github.com/julsql/thecode/commit/0c2dbd430542529621ea4daf6fa1d319b9bf3168))
* stop listing a Safari extension ([ff49da0](https://github.com/julsql/thecode/commit/ff49da0c9a7140a8a581f55363814da3bf341d7c))
* stop the whole sync when a vault row was moved under another id ([0c87b79](https://github.com/julsql/thecode/commit/0c87b79aac459cd2f612689ae900e20c9cf0d019))
* **tests:** a tamper test that sometimes tampered with nothing ([4e7965e](https://github.com/julsql/thecode/commit/4e7965e9d556e3c89d4b23fa7508879abf1e16ad))
* **tests:** tamper with four characters, not one ([899200c](https://github.com/julsql/thecode/commit/899200c9a1fe935d97e2f90027d51c9e9265f20a))
* use the form's login in the in-page menu and explain the key above each vault ([a0fd072](https://github.com/julsql/thecode/commit/a0fd07293ea8e08751f7b5ab5be67c9b153e37cb))
* **website:** keep a false "deleted" absent after a sync ([cec1e12](https://github.com/julsql/thecode/commit/cec1e12aeb785d3191f32eb020055a6c7f8a278f))


### Performance Improvements

* **android:** write the synced vault off the main thread ([f45e83f](https://github.com/julsql/thecode/commit/f45e83f5e8525a4d4d92bc1698f3142c7d451fcc))
</details>

<details><summary>apple: 3.0.0</summary>

## [3.0.0](https://github.com/julsql/thecode/compare/apple-v3.0.0...apple-v3.0.0) (2026-09-27)


###   BREAKING CHANGES

* **apple:** v1 sync blobs and TC1 payloads are no longer readable.
* **apple:** vault password records, lock method choice and lock settings are removed; the old Keychain items are deleted on launch.
* **shared:** v1 sync blobs and TC1 payloads are no longer readable.
* **apple:** VaultEntry.v, VaultEntry.version and isStorable are removed.
* **shared:** vault entries no longer carry `v`; readers must drop it instead of filtering entries on it.
* **canonical:** passwords change on Android, the website and the CLI for the sites listed in docs/BREAKING-CHANGES.md.

### Features

* **algo:** add v2, coexisting with v1 entry by entry ([3015d4c](https://github.com/julsql/thecode/commit/3015d4ce21a45999576570d2bcd4c65e32d2551c))
* app macOS avec le générateur, mode sombre/clair, bouton informaion et partager, internationalisation anglais/français ([b8e7ab5](https://github.com/julsql/thecode/commit/b8e7ab533e0b700ce5723d28229d49012af95beb))
* **apple:** add a login field to the generator screen ([a9889ae](https://github.com/julsql/thecode/commit/a9889aeef6d6bd6ae2a337326dee5916702f2740))
* **apple:** add a vault view ([1692c3a](https://github.com/julsql/thecode/commit/1692c3a55dc85bea075e58c85d314b69f90f0c05))
* **apple:** announce the move to v2, once ([b357978](https://github.com/julsql/thecode/commit/b3579786bb2246381ee2a01201662d4b766d64ab))
* **apple:** delete the account from the app ([c945ead](https://github.com/julsql/thecode/commit/c945ead830a34e532b1a0937d05e0219f7c98b09))
* **apple:** encrypt the vault before it leaves the device ([d3db6ac](https://github.com/julsql/thecode/commit/d3db6aca98b124fa0fc0cdbf39cc3d3835f97464))
* **apple:** export and import an encrypted vault ([15a3450](https://github.com/julsql/thecode/commit/15a345096902e60f9cd26955438271df9a933fff))
* **apple:** generate in v2 by default, with a way back to v1 ([094b29e](https://github.com/julsql/thecode/commit/094b29eb05a3765dae31edfa67f3a089f805c9ba))
* **apple:** give sync its own section at the top of the vault ([c48d7c9](https://github.com/julsql/thecode/commit/c48d7c9f9c62e0486928625c90d129656c998289))
* **apple:** guide toward a strong master key ([c7508dc](https://github.com/julsql/thecode/commit/c7508dc8aea2ca1fe932c7ab2c3f478e627eba61))
* **apple:** hide the save button in v1 ([2a7d4d4](https://github.com/julsql/thecode/commit/2a7d4d4de1046a3857d6cc1522c3f9736f3c9b69))
* **apple:** implement the v2 algorithm ([1989c39](https://github.com/julsql/thecode/commit/1989c398e1e9520e92d6399a442c11d6db1f3544))
* **apple:** keep only v2 entries in the vault ([6fc4e48](https://github.com/julsql/thecode/commit/6fc4e48b0f91c8f5eb6d5980ecd47f67f1290388))
* **apple:** keep the vault unlocked for the key's 3-minute grace ([1edebd1](https://github.com/julsql/thecode/commit/1edebd12e1824198a07d2597241974a8bc156a22))
* **apple:** lock the vault screen behind biometrics or a vault password ([c85e18f](https://github.com/julsql/thecode/commit/c85e18f7a394e83bdcf94df6f7a304346795673a))
* **apple:** make autofill read the vault ([9d9c0d9](https://github.com/julsql/thecode/commit/9d9c0d9b3212f2c7ed9afd908a06c10b189e5129))
* **apple:** make the algorithm a mode shown in the toolbar ([2484c97](https://github.com/julsql/thecode/commit/2484c97c9d8116ce13230ab6e63442e45ba5ac9e))
* **apple:** manage vault entries behind the lock ([5dd7343](https://github.com/julsql/thecode/commit/5dd73437d1cd4ba76a0c46fdbbaa687b8df250e4))
* **apple:** mask the generated password and save it next to it ([9182d73](https://github.com/julsql/thecode/commit/9182d736c9f421712ec1fd3fc8464fc1936eeb16))
* **apple:** offer to save the site when filling an unknown one ([6441de8](https://github.com/julsql/thecode/commit/6441de8129631df3a7886976a06ab1c9f8a1c17b))
* **apple:** offer to save unknown sites to the vault ([b104506](https://github.com/julsql/thecode/commit/b104506fe43d479632f823ef55436ee198c0bb5b))
* **apple:** open the vault and sync it from the iOS app ([ca633dc](https://github.com/julsql/thecode/commit/ca633dcf8160966aea85c20753f454c537ee10ee))
* **apple:** open the vault and sync it from the macOS app ([f7bd459](https://github.com/julsql/thecode/commit/f7bd459ffb4881f96e29b3369f2f2942af93161d))
* **apple:** per-account salt and bound ciphertexts ([e5d1d6c](https://github.com/julsql/thecode/commit/e5d1d6cd57711f525c7c488a434439b68fc2b4f9))
* **apple:** renew and migrate an entry from the vault screen ([52b1f66](https://github.com/julsql/thecode/commit/52b1f66fe21cfae1eb25e48392c8b99cddf7c948))
* **apple:** save a site's settings to the vault ([65116a3](https://github.com/julsql/thecode/commit/65116a3a1fd282882737f013a816d7de51f31f23))
* **apple:** save reproducible passwords from iOS autofill save requests ([53cc8b3](https://github.com/julsql/thecode/commit/53cc8b3dabc2c686e77fbcf84409b0892a50c7e2))
* **apple:** save the site to the vault from the macOS generator ([cf8cec1](https://github.com/julsql/thecode/commit/cf8cec10d3161b078a6b0423ede938f203304ae0))
* **apple:** send the Apple authorization code ([9987c10](https://github.com/julsql/thecode/commit/9987c10af2762d0fcf22447c4f1defa32771d8ae))
* **apple:** share default settings through the account ([5514185](https://github.com/julsql/thecode/commit/55141852aaf7577a920276aab3286ef0e58e2ca5))
* **apple:** share one session between the key and the vault ([c41c279](https://github.com/julsql/thecode/commit/c41c2793cee30e0b731a1fec5daae0e9a0061070))
* **apple:** sign in to sync with Google ([b4ee895](https://github.com/julsql/thecode/commit/b4ee895305defcca019344845e4d843314b24dbb))
* **apple:** sign in with Apple ([e6ee67d](https://github.com/julsql/thecode/commit/e6ee67d905023375e1185c18ed6555d2928b121b))
* **apple:** stop versioning vault entries ([5b0cd1a](https://github.com/julsql/thecode/commit/5b0cd1a408dfc4295c17dcb567b0fd7e575dbc72))
* **apple:** sync automatically ([e0e195c](https://github.com/julsql/thecode/commit/e0e195c1a0440e66bea7810f212f1ce55140e77d))
* **apple:** sync the vault with the encrypted service ([482a277](https://github.com/julsql/thecode/commit/482a2771f4e8ecee7af8f12b73f671c3930b0c65))
* **apple:** tint the apps pink in v1 ([b0a688e](https://github.com/julsql/thecode/commit/b0a688e56c19513480e0157f938e706d4a9a8fe0))
* **apple:** transfer the vault by QR code ([1e30b7d](https://github.com/julsql/thecode/commit/1e30b7d42925a7b35fe5b46c3b75b93fc41f0dcf))
* **apple:** unlock the vault with biometrics or the master key ([e0c18d5](https://github.com/julsql/thecode/commit/e0c18d5c97fde90d6f70618ea3915025a64bd8b5))
* **apps:** invite people to sync, without a word about price ([34a2d20](https://github.com/julsql/thecode/commit/34a2d2044f5364867a6b621941a011559eb90e5b))
* **autofill:** Add autofill provider ios target ([95e258a](https://github.com/julsql/thecode/commit/95e258addacdd52d347f419890dfb15859e7b5a5))
* biometrics requested for key using ([eab58c3](https://github.com/julsql/thecode/commit/eab58c384c3ea386d40e2c90c75b227bd77a07c9))
* **canonical:** unify domain canonicalisation across all platforms ([4b84d49](https://github.com/julsql/thecode/commit/4b84d491dcede5978379e21cf1b8091e62c60fc9))
* **clean:** Clean extension ([a590373](https://github.com/julsql/thecode/commit/a59037334e7ca8f1cc4da82e7b9ae9d071e736a8))
* **clients:** point to the site for creating and managing an account ([592f706](https://github.com/julsql/thecode/commit/592f7065ee3f93f3d51fa72df7d083df1056f967))
* derive v2 in autofill regardless of the entry's version ([a0f4a3b](https://github.com/julsql/thecode/commit/a0f4a3ba3815f3168b6ef97b136ec80002593072))
* domain instead of site name ([ccc1bf9](https://github.com/julsql/thecode/commit/ccc1bf9d982ed00b8fc0d7b6ce4f14bc14c5ad21))
* hide the paid plan on the page the apps link to ([c480bdd](https://github.com/julsql/thecode/commit/c480bdd3fe01372f6937771a6462deb520f05fa1))
* **input:** mise en forme de la sélection du mot de passe dans le navigateur ([4b014a8](https://github.com/julsql/thecode/commit/4b014a801d21e780401b53364631b7630b5a6666))
* **macos-autofill:** add deterministic AutoFill credential provider ([34bfa3a](https://github.com/julsql/thecode/commit/34bfa3ad93514394eb5235fefce26fdb557ba8e9))
* **macos:** native AutoFill credential provider, replacing the Safari extension ([f20d620](https://github.com/julsql/thecode/commit/f20d620daadb3f7f21af907da9f39bcfcc97b048))
* **macos:** replace Safari extension section with AutoFill guidance ([8de314f](https://github.com/julsql/thecode/commit/8de314fa6fcbdc9d9be8974988d802a805a5fd74))
* make the renewal sell on the web and stay silent in the apps ([c46f20b](https://github.com/julsql/thecode/commit/c46f20b9e70947ec25490d1ad188a4d7a6465d57))
* mask the generated password and save it next to it ([642c671](https://github.com/julsql/thecode/commit/642c671bafa8a7c68433ee422617a4d79e71aae3))
* meilleure gestion de la clef ([f79a18a](https://github.com/julsql/thecode/commit/f79a18abceddffd3161c77bb1d5abf37c03927c0))
* **mobile:** show the key fingerprint on Android and Apple ([2a003f4](https://github.com/julsql/thecode/commit/2a003f4b80af6ee72b203175ec73bf88df808691))
* open registration and make the sign-up code optional ([9a7b97d](https://github.com/julsql/thecode/commit/9a7b97d80c4965178fdb9d2bd177612a4a8c565d))
* point the clients at thecode-api.julsql.fr ([1c520b7](https://github.com/julsql/thecode/commit/1c520b710007a96b733a0f35477a1f296219299e))
* reword the v2 notice and translate it on every platform ([c7f38df](https://github.com/julsql/thecode/commit/c7f38dfe68a176076d47b2ccc2c5a279b77bff12))
* **screen:** add screen release 1.1.0 ([ac95951](https://github.com/julsql/thecode/commit/ac959516e8b226e9f16f1689fbc88ae355ebba03))
* **shared:** drop the version field from vault entries ([11ba36b](https://github.com/julsql/thecode/commit/11ba36bdba0daf50338b297a5ec48f3a1c26b2f8))
* **shared:** make the vault spec and fixtures v2 only ([6abd021](https://github.com/julsql/thecode/commit/6abd021e0f2405f1f786173b89bf72681c456e52))
* **shared:** per-account salt and bound ciphertexts for sync and transfer ([24cf09f](https://github.com/julsql/thecode/commit/24cf09f98dc7dbc0d04997a7dcf46f0cab371c57))
* show the v2 notice as a dialog, dismissed only by the checkbox ([abc80c2](https://github.com/julsql/thecode/commit/abc80c2dde101a1045e9ed7010872748cd7f69c4))
* store compliance  in-app account deletion, Apple token revocation, no payment steering ([dae0fc9](https://github.com/julsql/thecode/commit/dae0fc915a0c86324dedf93d6ec0e1992032912d))
* sync only what the plan allows and flag duplicate accounts ([889f342](https://github.com/julsql/thecode/commit/889f342335b30bd73aac6489ce2515e8056b02b2))
* sync the vault and settings automatically ([ddf8fce](https://github.com/julsql/thecode/commit/ddf8fce37e2433e993f2fc1f125e344b5fdbe639))
* tell the vault's key-dependence above every vault ([5c508fe](https://github.com/julsql/thecode/commit/5c508fe17ffa9994ca19eac597f631c81907b440))
* the counter becomes part of the complete plan ([7a13ccc](https://github.com/julsql/thecode/commit/7a13ccc5e022b50858a367833f5535c28c6beb1f))
* unit test for PasswordUtils ([387cb79](https://github.com/julsql/thecode/commit/387cb794fdb0657b8af3f9600c049eebbbadb060))
* username in autofill, Safari crash fix, and Sign in with Apple ([8616833](https://github.com/julsql/thecode/commit/8616833b34eb947be20787b0a22412bbd5a1f94b))
* v2-only vault with login, lock, shared settings and Google sign-in ([70183a6](https://github.com/julsql/thecode/commit/70183a6783cae7d8b1e8da3a59f9224599270a1f))
* **vault:** port the vault to the website, Android and Apple ([f8b99f8](https://github.com/julsql/thecode/commit/f8b99f8f19986091bae580ebfa274446e6bf0832))
* Version 1.0.0 ([3dac294](https://github.com/julsql/thecode/commit/3dac2946cf839f752b0e946fc86aae2eb1ac0ac3))


### Bug Fixes

* align the save button right and make it larger on iOS and Android ([3b397c3](https://github.com/julsql/thecode/commit/3b397c3328b10a08bc2f3930306a13e41568cdaa))
* **apple:** ask for biometrics as soon as the vault opens ([81623e8](https://github.com/julsql/thecode/commit/81623e8f93da108465b1d4fc79e5b3116d1cd34f))
* **apple:** drop the placeholder of the empty key field ([6701316](https://github.com/julsql/thecode/commit/6701316600f30aa142466b6695d9dd1dce729a6c))
* **apple:** enable paste, keep auth alive briefly, make length editable ([d8ce359](https://github.com/julsql/thecode/commit/d8ce359f5a52f6e73ef4c4d038b8d3585a389bb5))
* **apple:** enable paste, keep auth alive briefly, make length editable ([5adc500](https://github.com/julsql/thecode/commit/5adc5002b03d2d29dfcd25b4b13aff62e32444e0))
* **apple:** keep the vault reachable with the key locked on iOS ([937e0f3](https://github.com/julsql/thecode/commit/937e0f3ee7398263daee81b45b51db325608ea70))
* **apple:** let AutoFill take a username and never hand Safari an empty one ([1b66973](https://github.com/julsql/thecode/commit/1b66973cac7f7d67d17671b4b9bfed16a8f6ce25))
* **apple:** let the masked key be typed and accept the device password ([9a6a2a0](https://github.com/julsql/thecode/commit/9a6a2a0e80183aa8161544b408ddc9503227142c))
* **apple:** let the sandboxed macOS app reach the sync service ([f1b631b](https://github.com/julsql/thecode/commit/f1b631b992c84504e1a342ef39632e9dec6b2121))
* **apple:** make the AutoFill username optional and say what it means ([13d0322](https://github.com/julsql/thecode/commit/13d032240215d38cd03455bc72fcd0f4dc66a21c))
* **apple:** make the empty key field say how to fill it ([1285640](https://github.com/julsql/thecode/commit/12856406356c086d85fa5b5f88feb77cefd8acd1))
* **apple:** make the public suffix fallback loud instead of silent ([81760b7](https://github.com/julsql/thecode/commit/81760b77bfc9edceb283b2df4b64cca4675bbc49))
* **apple:** mask the key the same way whether locked or not ([434bba6](https://github.com/julsql/thecode/commit/434bba6cadecd182fd1d7e8feee85dd158af85bf))
* **apple:** match Android's session handling, and show the fingerprint ([f9c562e](https://github.com/julsql/thecode/commit/f9c562e8501f67db49ccd4f90c1bfbaabdf877f8))
* **apple:** move the master key out of plain text into the keychain ([834c59c](https://github.com/julsql/thecode/commit/834c59ca9056f57e2dce2ec3fdbcca23e825a5ba))
* **apple:** never push default settings that were never changed ([e0249fd](https://github.com/julsql/thecode/commit/e0249fdde8a70423cc0ac83f7dd7963613123a0f))
* **apple:** never wipe the vault because one entry is unreadable ([cc10cea](https://github.com/julsql/thecode/commit/cc10cea4ddaed95fe42bdd388e83e8523373e062))
* **apple:** put the iOS save button next to the security line ([3fc3585](https://github.com/julsql/thecode/commit/3fc358575b203fbfdbe4bf4e7d83881e73fa49e3))
* **apple:** require authentication to open the vault ([3e9db84](https://github.com/julsql/thecode/commit/3e9db84dc6b4da69e4c9489f352659680be6e324))
* **apple:** restore the v2 notice wording chosen by the product owner ([1646950](https://github.com/julsql/thecode/commit/1646950c466ce355e7873da7b146a3e2be3acebf))
* **apple:** revoke the session on sign out ([fc12a8b](https://github.com/julsql/thecode/commit/fc12a8b5a6e498cdbb68fccabadad518c0405eb1))
* **apple:** show a sign-in button in the macOS vault ([5cdf8b7](https://github.com/julsql/thecode/commit/5cdf8b7f0656aee9e8836fab308e7c8e87981748))
* **apple:** show the v2 notice on macOS, and lay it out properly ([30d3fb1](https://github.com/julsql/thecode/commit/30d3fb15917c520817bba36042d11fcbc6fb86c2))
* **apple:** stack the small security line and the save button under the password ([015bd57](https://github.com/julsql/thecode/commit/015bd57109a75757854aa292501d69f02e55829b))
* **apple:** stop pointing to the paid plan outside the store ([dee3336](https://github.com/julsql/thecode/commit/dee333694d5e8082257762ef495d9b009df26773))
* **apple:** translate the vault screens ([acea7d0](https://github.com/julsql/thecode/commit/acea7d01259dd72777d622da96e21d7e0f27edc9))
* compute the fingerprint after a pause, not on every keystroke ([0f8d1d1](https://github.com/julsql/thecode/commit/0f8d1d1218b8cec347eca100468ef4b4c1bda706))
* **macos-autofill:** cancel the request when Touch ID is cancelled ([4b42bb8](https://github.com/julsql/thecode/commit/4b42bb89914ab339c009ea6fac8870fd8ccba2f5))
* **macos-autofill:** cancel the request when Touch ID is cancelled ([2601dc6](https://github.com/julsql/thecode/commit/2601dc6fa2bc2595c2b25da35cd708b4971e7610))
* **macos-autofill:** make the credential provider discoverable by macOS ([162b0a9](https://github.com/julsql/thecode/commit/162b0a9598eab36b30728ec875f6a78b7c42bb42))
* **macos-autofill:** open the app when no key is set instead of hanging ([5aea841](https://github.com/julsql/thecode/commit/5aea8417dd55d0ceed03d30929acc5bee47ccc95))
* **macos:** drop orphaned js-test lockfile ([b73a647](https://github.com/julsql/thecode/commit/b73a6470b6268a4e42ab868299400831a4bda4c3))
* **macos:** drop orphaned js-test lockfile ([4f6c151](https://github.com/julsql/thecode/commit/4f6c1510a52d41056046548e49b05c717edfc63a))
* optional username in autofill, said out loud, and a stable website CI ([4fd9608](https://github.com/julsql/thecode/commit/4fd960843dd50c474c7ef328d91642295469da03))
* pin one canonical form for merge tie-breaks ([674bc06](https://github.com/julsql/thecode/commit/674bc06566a402d24080d280d8473eb99bd3e714))
* revoke the session on sign out ([f22e2a8](https://github.com/julsql/thecode/commit/f22e2a8a46ec41e4ab9ede8f3fd3e3a268d5682b))
* **shared:** rename vector fields to stop tripping secret scanners ([0c2dbd4](https://github.com/julsql/thecode/commit/0c2dbd430542529621ea4daf6fa1d319b9bf3168))
* stop listing a Safari extension ([ff49da0](https://github.com/julsql/thecode/commit/ff49da0c9a7140a8a581f55363814da3bf341d7c))
* stop the whole sync when a vault row was moved under another id ([0c87b79](https://github.com/julsql/thecode/commit/0c87b79aac459cd2f612689ae900e20c9cf0d019))
* **tests:** a tamper test that sometimes tampered with nothing ([4e7965e](https://github.com/julsql/thecode/commit/4e7965e9d556e3c89d4b23fa7508879abf1e16ad))
* **tests:** tamper with four characters, not one ([899200c](https://github.com/julsql/thecode/commit/899200c9a1fe935d97e2f90027d51c9e9265f20a))
* use the form's login in the in-page menu and explain the key above each vault ([a0fd072](https://github.com/julsql/thecode/commit/a0fd07293ea8e08751f7b5ab5be67c9b153e37cb))
* **website:** keep a false "deleted" absent after a sync ([cec1e12](https://github.com/julsql/thecode/commit/cec1e12aeb785d3191f32eb020055a6c7f8a278f))
</details>

---
This PR was generated with [Release Please](https://github.com/googleapis/release-please). See [documentation](https://github.com/googleapis/release-please#release-please).