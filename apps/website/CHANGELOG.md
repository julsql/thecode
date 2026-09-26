# Changelog

## [3.0.0](https://github.com/julsql/thecode/compare/website-v2.0.0...website-v3.0.0) (2026-09-26)


### ⚠ BREAKING CHANGES

* **website:** VaultEntry has no `v`; isVaultEntryV2()/keepV2Only() and VAULT_ENTRY_VERSION are replaced by dropVersion()/stripVersions().
* **shared:** vault entries no longer carry `v`; readers must drop it instead of filtering entries on it.
* **canonical:** passwords change on Android, the website and the CLI for the sites listed in docs/BREAKING-CHANGES.md.

### Features

* add a shared QR encoder, byte mode, EC level L ([c73fadc](https://github.com/julsql/thecode/commit/c73fadcf10513fb72476b78432299b0a2813003e))
* add property google ([1f19c30](https://github.com/julsql/thecode/commit/1f19c30a53e85bc0d817c560ca28e8baaa5633df))
* **algo:** add v2, coexisting with v1 entry by entry ([3015d4c](https://github.com/julsql/thecode/commit/3015d4ce21a45999576570d2bcd4c65e32d2551c))
* **api:** ajout d'une api pour générer le code ([349b2f6](https://github.com/julsql/thecode/commit/349b2f68e280130036927da43fb31b7abbb6e922))
* **api:** send the mail for real, and cap the free plan at five entries ([ddd37d3](https://github.com/julsql/thecode/commit/ddd37d3dfb898f0d4b2777dedb68ee0ebc55a0f3))
* **canonical:** unify domain canonicalisation across all platforms ([4b84d49](https://github.com/julsql/thecode/commit/4b84d491dcede5978379e21cf1b8091e62c60fc9))
* cap connected devices at 3 on the free plan and 10 on the paid one ([7d795d3](https://github.com/julsql/thecode/commit/7d795d34d00387e15739c050ba33e200739f8bcb))
* google ownership ([42e6c44](https://github.com/julsql/thecode/commit/42e6c440a9dea58ed4b67cea3167d3d50ffd74f1))
* hide the paid plan on the page the apps link to ([c480bdd](https://github.com/julsql/thecode/commit/c480bdd3fe01372f6937771a6462deb520f05fa1))
* let a Google account stand on its own and drop the link ([a624ce6](https://github.com/julsql/thecode/commit/a624ce6d2a4809f9187814c23ab779ee10831e50))
* make the renewal sell on the web and stay silent in the apps ([c46f20b](https://github.com/julsql/thecode/commit/c46f20b9e70947ec25490d1ad188a4d7a6465d57))
* mask the generated password and save it next to it ([642c671](https://github.com/julsql/thecode/commit/642c671bafa8a7c68433ee422617a4d79e71aae3))
* open registration up to a quota, then ask for a referral code ([6f22257](https://github.com/julsql/thecode/commit/6f222574dad80ba54449d754cc75092a930b588c))
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
* **vault:** encrypted transfer between devices ([4f575bc](https://github.com/julsql/thecode/commit/4f575bcbd669968ad425f06b04139ca392810a69))
* **vault:** port the vault to the website, Android and Apple ([f8b99f8](https://github.com/julsql/thecode/commit/f8b99f8f19986091bae580ebfa274446e6bf0832))
* **website:** account area, pricing page and subscription ([22f03db](https://github.com/julsql/thecode/commit/22f03db7911f6f9c85ca6ed675a801c6ccb6608e))
* **website:** add a password lock for the vault screen ([e5cdd9b](https://github.com/julsql/thecode/commit/e5cdd9b961f430d4ed2a74f5413e153cbfdfca50))
* **website:** announce the move to v2 on the generator page ([ad26c8a](https://github.com/julsql/thecode/commit/ad26c8afefa12650f1ceb590d19d5304f46e2347))
* **website:** export and import an encrypted vault ([36adab6](https://github.com/julsql/thecode/commit/36adab6a65f076505fc9cc2c0f656fe597778c63))
* **website:** generate in v2 by default, with a way back to v1 ([f7419b9](https://github.com/julsql/thecode/commit/f7419b961faf9b838fd796b9050a94866e03dbda))
* **website:** Google sign-in, credential changes and password reset ([4362609](https://github.com/julsql/thecode/commit/4362609c6d42b10f3b1f1721e6e454cc44503fa3))
* **website:** hide the save button in v1 ([3087b55](https://github.com/julsql/thecode/commit/3087b5529df20adbd84b4a49974779744863e3fb))
* **website:** identify website sessions to the service ([ec29da5](https://github.com/julsql/thecode/commit/ec29da581e69912e3a490d6a6f35a8f3e25f6350))
* **website:** implement v2, and renew or migrate an entry ([568786b](https://github.com/julsql/thecode/commit/568786bfb99c9b9deb48598be0cac132aafff0ca))
* **website:** keep only v2 entries in the vault ([d2277f4](https://github.com/julsql/thecode/commit/d2277f4488216cd061a1ef12fa5e72d7e3587d2a))
* **website:** keep the legal notice off the site until it can be filled ([9a18eb3](https://github.com/julsql/thecode/commit/9a18eb3481229c39bceab84d6f39370c82983d58))
* **website:** keep the vault unlocked for the key's 3-minute grace ([e69dfd3](https://github.com/julsql/thecode/commit/e69dfd3a64f44f1aba09621a4ecf924f4cf0a396))
* **website:** legal pages, data export and account deletion ([42b0f55](https://github.com/julsql/thecode/commit/42b0f55361a0518dde2d33955008c129445ba5fb))
* **website:** let the generator take the account login ([d715dbb](https://github.com/julsql/thecode/commit/d715dbb6701ea741238cbbdda5fef3fa5cbb0467))
* **website:** make the algorithm a mode at the top of the card ([8e42403](https://github.com/julsql/thecode/commit/8e4240351d5f7de8b54fedefd9aac152097e3111))
* **website:** mask the generated password and save it next to it ([784dee7](https://github.com/julsql/thecode/commit/784dee7820509d69a4f1367c9d17177a9fcc3b7a))
* **website:** move vault management to a locked vault page ([c18258f](https://github.com/julsql/thecode/commit/c18258fac663d8f034bd1a1d06a6a7a66278fb3f))
* **website:** permanent recovery page for the v1 algorithm ([019f3c8](https://github.com/julsql/thecode/commit/019f3c8c5da40f2a8255cc976cf90a8169ae8007))
* **website:** remember default settings and share them through the account ([72aef0a](https://github.com/julsql/thecode/commit/72aef0a63089c62db8dba931e840d4a24658a3d7))
* **website:** show nothing for sale while nothing is sold ([6538e6f](https://github.com/julsql/thecode/commit/6538e6f7a82901d4b02f7b19704fcd5ceafd105b))
* **website:** show which algorithm is in force, and record it ([b18bdf6](https://github.com/julsql/thecode/commit/b18bdf627c553c2eee2c4632f4043f3a3df1b500))
* **website:** sign in with Apple ([2eda973](https://github.com/julsql/thecode/commit/2eda9736df5abcad075b832a3a1a2f90a737e7fe))
* **website:** stop versioning vault entries ([3967e6a](https://github.com/julsql/thecode/commit/3967e6a37c5045b918ee4e84d9e540e05799ab18))
* **website:** surface the vault and key fingerprint ([94487e0](https://github.com/julsql/thecode/commit/94487e059c9591e5df98341979db11fe15fa0dca))
* **website:** sync automatically ([51189a2](https://github.com/julsql/thecode/commit/51189a23f39f07e693057879ea525b9cfcf8cebc))
* **website:** sync the vault through the server ([6978165](https://github.com/julsql/thecode/commit/6978165037de08f9fd32be5b8c5351a18c172987))
* **website:** tint the generator pink in v1 ([4861807](https://github.com/julsql/thecode/commit/48618075e1c24be03016e31aceb42d7798f60da3))
* **website:** transfer the vault by QR code or file ([0e1b3c8](https://github.com/julsql/thecode/commit/0e1b3c8c7eda241b3ce857b726e7ac2d15614a22))


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
* **security:** CodeQL language input and trivy scanners ([5552bd8](https://github.com/julsql/thecode/commit/5552bd8af95beea5824e689d896576b10fe69911))
* **shared:** rename vector fields to stop tripping secret scanners ([0c2dbd4](https://github.com/julsql/thecode/commit/0c2dbd430542529621ea4daf6fa1d319b9bf3168))
* **tests:** a tamper test that sometimes tampered with nothing ([4e7965e](https://github.com/julsql/thecode/commit/4e7965e9d556e3c89d4b23fa7508879abf1e16ad))
* **tests:** tamper with four characters, not one ([899200c](https://github.com/julsql/thecode/commit/899200c9a1fe935d97e2f90027d51c9e9265f20a))
* **tests:** write fixture passwords so they read as fixtures ([1e14e93](https://github.com/julsql/thecode/commit/1e14e93f4e28328c849d3735be5610a680295b5d))
* use the form's login in the in-page menu and explain the key above each vault ([a0fd072](https://github.com/julsql/thecode/commit/a0fd07293ea8e08751f7b5ab5be67c9b153e37cb))
* **website:** apply Alpine security updates in the image ([5edd6bc](https://github.com/julsql/thecode/commit/5edd6bc9adaa6662aec14bc4bf5420b213eac6e6))
* **website:** bring back the violet for v2, keep pink for v1 ([f5bd1eb](https://github.com/julsql/thecode/commit/f5bd1eb561bd8404da7800a18d3f7e627d2bb97c))
* **website:** bring back the violet for v2, keep pink for v1 ([7af7b71](https://github.com/julsql/thecode/commit/7af7b717394dad21c49c11c78e7bec9927606a08))
* **website:** describe the algorithm the product actually runs ([827dc47](https://github.com/julsql/thecode/commit/827dc47364d2198b95ec57e2b97cf82d4ec563ea))
* **website:** generate nothing without a site ([e570776](https://github.com/julsql/thecode/commit/e5707768385180db8838a08e9ea5669b99cea2d4))
* **website:** ignore a generation whose result arrives too late ([2e35c51](https://github.com/julsql/thecode/commit/2e35c51206e9967efd619e537b2c19efd523d930))
* **website:** keep a false "deleted" absent after a sync ([cec1e12](https://github.com/julsql/thecode/commit/cec1e12aeb785d3191f32eb020055a6c7f8a278f))
* **website:** make the vault, transfer and sync actions legible ([50e6163](https://github.com/julsql/thecode/commit/50e6163707337d6f2d669ffc9ba667f3a995a2d8))
* **website:** put the strength bar back beside what it measures ([e613275](https://github.com/julsql/thecode/commit/e613275c1544ac5d2df6f426db718f8689e9175a))
* **website:** satisfy the build's stricter type checking ([139835c](https://github.com/julsql/thecode/commit/139835cf1db1077717b45c6a5d4c0c085a92213f))
* **website:** show account messages next to the field that caused them ([eb97a74](https://github.com/julsql/thecode/commit/eb97a7414dcc1a716718445a6cab1f6766a3befe))
* **website:** show the Google button again after signing out ([46bccf3](https://github.com/julsql/thecode/commit/46bccf3ff34717f2ca1f52fc8bf682140c5010c5))
* **website:** type-check the duplicate scan and sync messages ([e97c5a7](https://github.com/julsql/thecode/commit/e97c5a76a164653374ed33869554948e59c2ee2c))
* **website:** widen the vault page ([5966f59](https://github.com/julsql/thecode/commit/5966f595050bf3f982a44a0cf10fd4ddb0b4472d))

## [2.0.0](https://github.com/julsql/thecode/compare/website-v1.0.0...website-v2.0.0) (2026-09-18)


### ⚠ BREAKING CHANGES

* **canonical:** passwords change on Android, the website and the CLI for the sites listed in docs/BREAKING-CHANGES.md.

### Features

* **algo:** add v2, coexisting with v1 entry by entry ([52c7393](https://github.com/julsql/thecode/commit/52c7393791408b9b7f875e7ef624989d0ebbc2e6))
* **canonical:** unify domain canonicalisation across all platforms ([e8b1a21](https://github.com/julsql/thecode/commit/e8b1a21cf69e04aa7e67bec4e92c2250b2005484))
* **vault:** encrypted transfer between devices ([ee69ac8](https://github.com/julsql/thecode/commit/ee69ac859dc3cb3e13018447e24f232ac1da068c))
* **vault:** port the vault to the website, Android and Apple ([ede5737](https://github.com/julsql/thecode/commit/ede5737a4afd109797aeb6a30bf009973182a701))
* **website:** permanent recovery page for the v1 algorithm ([b3f0c50](https://github.com/julsql/thecode/commit/b3f0c50c18444218cf91107f65ac29719b8eb770))

## 1.0.0 (2026-09-18)


### Bug Fixes

* **security:** CodeQL language input and trivy scanners ([c7eace0](https://github.com/julsql/thecode/commit/c7eace0b09beab5195c2096372694fcc31f4827e))
* **shared:** rename vector fields to stop tripping secret scanners ([e1c4b25](https://github.com/julsql/thecode/commit/e1c4b25cc3a2ba2a4983c49136b605004ad5d28c))
