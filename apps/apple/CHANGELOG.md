# Changelog

## [4.0.0](https://github.com/julsql/thecode/compare/apple-v3.0.0...apple-v4.0.0) (2026-09-26)


### ⚠ BREAKING CHANGES

* **apple:** VaultEntry.v, VaultEntry.version and isStorable are removed.
* **shared:** vault entries no longer carry `v`; readers must drop it instead of filtering entries on it.
* **canonical:** passwords change on Android, the website and the CLI for the sites listed in docs/BREAKING-CHANGES.md.

### Features

* **algo:** add v2, coexisting with v1 entry by entry ([3015d4c](https://github.com/julsql/thecode/commit/3015d4ce21a45999576570d2bcd4c65e32d2551c))
* app macOS avec le générateur, mode sombre/clair, bouton informaion et partager, internationalisation anglais/français ([b8e7ab5](https://github.com/julsql/thecode/commit/b8e7ab533e0b700ce5723d28229d49012af95beb))
* **apple:** add a login field to the generator screen ([a9889ae](https://github.com/julsql/thecode/commit/a9889aeef6d6bd6ae2a337326dee5916702f2740))
* **apple:** add a vault view ([1692c3a](https://github.com/julsql/thecode/commit/1692c3a55dc85bea075e58c85d314b69f90f0c05))
* **apple:** announce the move to v2, once ([b357978](https://github.com/julsql/thecode/commit/b3579786bb2246381ee2a01201662d4b766d64ab))
* **apple:** encrypt the vault before it leaves the device ([d3db6ac](https://github.com/julsql/thecode/commit/d3db6aca98b124fa0fc0cdbf39cc3d3835f97464))
* **apple:** export and import an encrypted vault ([15a3450](https://github.com/julsql/thecode/commit/15a345096902e60f9cd26955438271df9a933fff))
* **apple:** generate in v2 by default, with a way back to v1 ([094b29e](https://github.com/julsql/thecode/commit/094b29eb05a3765dae31edfa67f3a089f805c9ba))
* **apple:** give sync its own section at the top of the vault ([c48d7c9](https://github.com/julsql/thecode/commit/c48d7c9f9c62e0486928625c90d129656c998289))
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
* **apple:** renew and migrate an entry from the vault screen ([52b1f66](https://github.com/julsql/thecode/commit/52b1f66fe21cfae1eb25e48392c8b99cddf7c948))
* **apple:** save a site's settings to the vault ([65116a3](https://github.com/julsql/thecode/commit/65116a3a1fd282882737f013a816d7de51f31f23))
* **apple:** save reproducible passwords from iOS autofill save requests ([53cc8b3](https://github.com/julsql/thecode/commit/53cc8b3dabc2c686e77fbcf84409b0892a50c7e2))
* **apple:** save the site to the vault from the macOS generator ([cf8cec1](https://github.com/julsql/thecode/commit/cf8cec10d3161b078a6b0423ede938f203304ae0))
* **apple:** share default settings through the account ([5514185](https://github.com/julsql/thecode/commit/55141852aaf7577a920276aab3286ef0e58e2ca5))
* **apple:** share one session between the key and the vault ([c41c279](https://github.com/julsql/thecode/commit/c41c2793cee30e0b731a1fec5daae0e9a0061070))
* **apple:** sign in to sync with Google ([b4ee895](https://github.com/julsql/thecode/commit/b4ee895305defcca019344845e4d843314b24dbb))
* **apple:** sign in with Apple ([e6ee67d](https://github.com/julsql/thecode/commit/e6ee67d905023375e1185c18ed6555d2928b121b))
* **apple:** stop versioning vault entries ([5b0cd1a](https://github.com/julsql/thecode/commit/5b0cd1a408dfc4295c17dcb567b0fd7e575dbc72))
* **apple:** sync automatically ([e0e195c](https://github.com/julsql/thecode/commit/e0e195c1a0440e66bea7810f212f1ce55140e77d))
* **apple:** sync the vault with the encrypted service ([482a277](https://github.com/julsql/thecode/commit/482a2771f4e8ecee7af8f12b73f671c3930b0c65))
* **apple:** tint the apps pink in v1 ([b0a688e](https://github.com/julsql/thecode/commit/b0a688e56c19513480e0157f938e706d4a9a8fe0))
* **apple:** transfer the vault by QR code ([1e30b7d](https://github.com/julsql/thecode/commit/1e30b7d42925a7b35fe5b46c3b75b93fc41f0dcf))
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
* point the clients at thecode-api.julsql.fr ([1c520b7](https://github.com/julsql/thecode/commit/1c520b710007a96b733a0f35477a1f296219299e))
* reword the v2 notice and translate it on every platform ([c7f38df](https://github.com/julsql/thecode/commit/c7f38dfe68a176076d47b2ccc2c5a279b77bff12))
* **screen:** add screen release 1.1.0 ([ac95951](https://github.com/julsql/thecode/commit/ac959516e8b226e9f16f1689fbc88ae355ebba03))
* **shared:** drop the version field from vault entries ([11ba36b](https://github.com/julsql/thecode/commit/11ba36bdba0daf50338b297a5ec48f3a1c26b2f8))
* **shared:** make the vault spec and fixtures v2 only ([6abd021](https://github.com/julsql/thecode/commit/6abd021e0f2405f1f786173b89bf72681c456e52))
* show the v2 notice as a dialog, dismissed only by the checkbox ([abc80c2](https://github.com/julsql/thecode/commit/abc80c2dde101a1045e9ed7010872748cd7f69c4))
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
* **apple:** show a sign-in button in the macOS vault ([5cdf8b7](https://github.com/julsql/thecode/commit/5cdf8b7f0656aee9e8836fab308e7c8e87981748))
* **apple:** show the v2 notice on macOS, and lay it out properly ([30d3fb1](https://github.com/julsql/thecode/commit/30d3fb15917c520817bba36042d11fcbc6fb86c2))
* **apple:** stack the small security line and the save button under the password ([015bd57](https://github.com/julsql/thecode/commit/015bd57109a75757854aa292501d69f02e55829b))
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
* **shared:** rename vector fields to stop tripping secret scanners ([0c2dbd4](https://github.com/julsql/thecode/commit/0c2dbd430542529621ea4daf6fa1d319b9bf3168))
* **tests:** a tamper test that sometimes tampered with nothing ([4e7965e](https://github.com/julsql/thecode/commit/4e7965e9d556e3c89d4b23fa7508879abf1e16ad))
* **tests:** tamper with four characters, not one ([899200c](https://github.com/julsql/thecode/commit/899200c9a1fe935d97e2f90027d51c9e9265f20a))
* use the form's login in the in-page menu and explain the key above each vault ([a0fd072](https://github.com/julsql/thecode/commit/a0fd07293ea8e08751f7b5ab5be67c9b153e37cb))
* **website:** keep a false "deleted" absent after a sync ([cec1e12](https://github.com/julsql/thecode/commit/cec1e12aeb785d3191f32eb020055a6c7f8a278f))

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
