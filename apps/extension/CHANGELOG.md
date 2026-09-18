# Changelog

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
