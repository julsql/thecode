# Changelog

## [2.5.0](https://github.com/julsql/thecode/compare/website-v2.4.0...website-v2.5.0) (2026-09-20)


### Features

* hide the paid plan on the page the apps link to ([bfed357](https://github.com/julsql/thecode/commit/bfed357e4d290f34179941f992a58b57faaa41da))
* make the renewal sell on the web and stay silent in the apps ([1bf8588](https://github.com/julsql/thecode/commit/1bf85889b90a62699669ce5069b7cb0e6dece946))
* **website:** keep the legal notice off the site until it can be filled ([997ab30](https://github.com/julsql/thecode/commit/997ab30f88d540198e3259da29b971e0d4dd7770))


### Bug Fixes

* **website:** describe the algorithm the product actually runs ([0a05fa9](https://github.com/julsql/thecode/commit/0a05fa9401864f8732803c301ec2bedb784b5e5e))

## [2.4.0](https://github.com/julsql/thecode/compare/website-v2.3.0...website-v2.4.0) (2026-09-19)


### Features

* let a Google account stand on its own and drop the link ([4b59373](https://github.com/julsql/thecode/commit/4b59373de2fa560ce1176b495f4bfaf38fab71b0))


### Bug Fixes

* **tests:** write fixture passwords so they read as fixtures ([3d9efb2](https://github.com/julsql/thecode/commit/3d9efb2f544ef799764b27a458ae6e7d0f25b468))

## [2.3.0](https://github.com/julsql/thecode/compare/website-v2.2.0...website-v2.3.0) (2026-09-19)


### Features

* **api:** send the mail for real, and cap the free plan at five entries ([a44983e](https://github.com/julsql/thecode/commit/a44983e103e672cc79ef088cf7bcadc5b25cb251))
* open registration up to a quota, then ask for a referral code ([6129342](https://github.com/julsql/thecode/commit/612934203584e306d1a728879bda2208f162b770))
* show the v2 notice as a dialog, dismissed only by the checkbox ([33af5c9](https://github.com/julsql/thecode/commit/33af5c900511f324facb973c2aa30f97df8baee8))
* the counter becomes part of the complete plan ([e21b66c](https://github.com/julsql/thecode/commit/e21b66ca1131a54558d18047c1d416ebc99209b2))
* **website:** account area, pricing page and subscription ([0445da5](https://github.com/julsql/thecode/commit/0445da5d2fb36f0ba0e367682c5a03a45487e2b9))
* **website:** announce the move to v2 on the generator page ([0b46d91](https://github.com/julsql/thecode/commit/0b46d91104ec2195a89c697df2cd16a3090bcd87))
* **website:** generate in v2 by default, with a way back to v1 ([c1ad058](https://github.com/julsql/thecode/commit/c1ad05879196bc91241ccf299a6b0133af937953))
* **website:** Google sign-in, credential changes and password reset ([34309e2](https://github.com/julsql/thecode/commit/34309e2901c49f4514ac719cfb28605f2f7b9191))
* **website:** legal pages, data export and account deletion ([edfb80d](https://github.com/julsql/thecode/commit/edfb80dd41b30674f19afaabdd8efbe4019c80e5))
* **website:** make the algorithm a mode at the top of the card ([dba8819](https://github.com/julsql/thecode/commit/dba88194059a7d6241a38e0014140174e024b272))
* **website:** show nothing for sale while nothing is sold ([a9d530a](https://github.com/julsql/thecode/commit/a9d530a4b0369f94469b53fc45545546ee848a39))
* **website:** show which algorithm is in force, and record it ([a9db00e](https://github.com/julsql/thecode/commit/a9db00e22e22ddb3052e6e68ee8660ef99cfadd4))


### Bug Fixes

* reset the algorithm mode to v2 on every launch ([49e1648](https://github.com/julsql/thecode/commit/49e1648e2af068f9dfcbd8ba7e67b2d3e82708b3))
* **tests:** a tamper test that sometimes tampered with nothing ([2927ee5](https://github.com/julsql/thecode/commit/2927ee5a80744b488c6d34cf66f88e1f6406c6af))
* **tests:** tamper with four characters, not one ([94e5643](https://github.com/julsql/thecode/commit/94e56433579e9b4af74bfc2a5704437f69a18cc6))
* **website:** ignore a generation whose result arrives too late ([87f88c6](https://github.com/julsql/thecode/commit/87f88c62469e54b9b9e46bd1580c96c48b72c2aa))
* **website:** put the strength bar back beside what it measures ([69fc532](https://github.com/julsql/thecode/commit/69fc53286d8a19ba000cc5ca0537577f8f5e7521))

## [2.2.0](https://github.com/julsql/thecode/compare/website-v2.1.0...website-v2.2.0) (2026-09-19)


### Features

* add a shared QR encoder, byte mode, EC level L ([e4a414f](https://github.com/julsql/thecode/commit/e4a414f625c0b12a8f78edc321ccabad6a245fcd))
* **website:** export and import an encrypted vault ([b5eaec5](https://github.com/julsql/thecode/commit/b5eaec50889ab7e605fb2b5b26c57a6f4de7349c))
* **website:** implement v2, and renew or migrate an entry ([0b9ddbb](https://github.com/julsql/thecode/commit/0b9ddbb76dcd8dee0e40e6d4b914e68496823c2b))
* **website:** transfer the vault by QR code or file ([3f4e31c](https://github.com/julsql/thecode/commit/3f4e31c00b47b766bc89ff688a4e25b9e711a1a6))


### Bug Fixes

* **website:** make the vault, transfer and sync actions legible ([e7a5c5a](https://github.com/julsql/thecode/commit/e7a5c5a251a60d6a6198ed108d5c486adf2163b2))
* **website:** satisfy the build's stricter type checking ([7408843](https://github.com/julsql/thecode/commit/74088435b6492be825302031b6da13a1eabad995))

## [2.1.0](https://github.com/julsql/thecode/compare/website-v2.0.0...website-v2.1.0) (2026-09-18)


### Features

* point the clients at thecode-api.julsql.fr ([2a35656](https://github.com/julsql/thecode/commit/2a3565629c5bbbd148f0684c8963f2fa31e64f4e))
* **website:** surface the vault and key fingerprint ([a5ac5ce](https://github.com/julsql/thecode/commit/a5ac5ce6609c4c89b47c72c406bd1ebba19f60da))
* **website:** sync the vault through the server ([de6b565](https://github.com/julsql/thecode/commit/de6b565ad78288f3712ad2af528677d0a834e72f))


### Bug Fixes

* pin one canonical form for merge tie-breaks ([9419141](https://github.com/julsql/thecode/commit/9419141677ee42ac00babdada94468b5b1b9c9ac))
* **website:** keep a false "deleted" absent after a sync ([e414a29](https://github.com/julsql/thecode/commit/e414a299b06e9936f978bfc90cde0a164e23a50b))

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
