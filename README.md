# TheCode

Deterministic password manager: one master key plus a site name gives you the same password every
time, on every device. No password is ever stored — each one is recomputed on demand.

- **Algorithm v2**: PBKDF2-SHA256 (600,000 iterations) on the master key, then HMAC-SHA256 over the
  site, the login and a counter. v1 (`SHA-256(site + key)`) is only kept for one-off generation, to
  find a password set on a site before v2.
- **Local vault** (optional): remembers each site's settings and username — never a password.
  Unlocked with biometrics in the apps, or with the master key in the extension, on the website and
  on devices without authentication. "Lock" locks the whole session.
- **Account and sync** (optional): email/password (every client, CLI included), Google on the
  graphical clients, Apple on the Apple apps and the website. Registration is open. The vault and the default settings sync automatically, end-to-end encrypted
  (per-account salt, AES-256-GCM bound to each entry id): the server only ever sees opaque blocks.
- **Transfer without an account**: encrypted QR code or file (`TC2` format).
- **Autofill**: Android autofill service, iOS/macOS AutoFill credential providers (with the
  username), in-page menu in the browser extension.
- Master key strength guidance, account deletion from the apps.
- No ads, no trackers, open source.

Five clients share one algorithm, plus an optional sync API — which is exactly why this is a
monorepo.

## Layout

| Path              | What it is                                                                      |
| ----------------- | ------------------------------------------------------------------------------- |
| `shared/`         | **Source of truth.** Test vectors, specs, fixtures, public suffix list          |
| `apps/website/`   | Vue 3 + Vite web app — [thecode.julsql.fr](https://thecode.julsql.fr)           |
| `apps/extension/` | Browser extension (Chrome, Firefox desktop, Edge, Brave)                        |
| `apps/android/`   | Android app (Java) with an autofill service                                     |
| `apps/apple/`     | iOS, iPadOS and macOS apps (Swift) with AutoFill credential providers           |
| `apps/cli/`       | Python CLI                                                                      |
| `apps/api/`       | FastAPI sync service (zero-knowledge, PostgreSQL) — optional, deployed with k8s |
| `e2e/`            | Playwright end-to-end tests of the extension                                    |
| `scripts/`        | Shared-file sync and conformance helpers                                        |

Specs live in `shared/spec/`: `algo-v2.md`, `vault-sync.md`, `vault-transfer.md`,
`vault-merge.md`, `vault-lock.md`, `default-settings.md`, `fingerprint.md`, `key-strength.md`.

## Why a monorepo

The same password must come out of all five clients, byte for byte. A one-character divergence
locks a user out of their accounts.

`shared/test-vectors.json` holds the frozen v1 and v2 vectors, and every client is tested against
that one file. Per-platform tests were not enough: Android and Apple each had their own
domain-normalisation tests, with different cases, and the divergence between them survived
precisely because neither suite tested the other's cases.

`shared/` is copied into each toolchain rather than referenced in place, because Xcode and Gradle
handle out-of-project references poorly. `scripts/check-shared.sh` fails the build if any copy
drifts from the source.

## Getting started

```sh
make setup              # local dev environment
make test-conformance   # shared vectors across implementations
make test               # everything except the native platforms
make test-e2e           # Playwright on the extension
make sync-shared        # after editing anything in shared/
```

Apple conformance needs an iOS simulator, so it lives in its own target:

```sh
make test-conformance-apple
```

Each app's README covers its own build and tests.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). In short: never edit a copy of a `shared/` file — edit the
source and run `make sync-shared`.

The `v1` and `v2` sections of `shared/test-vectors.json` are **frozen**: those passwords are in
production. If conformance fails, fix the implementation, never the vector. Changes that alter an
existing password are listed in [docs/BREAKING-CHANGES.md](docs/BREAKING-CHANGES.md).

Commits follow [Conventional Commits](https://www.conventionalcommits.org).

## License

[Apache License 2.0](LICENSE) for the whole repository, except `apps/cli/`, which is under the
[MIT License](apps/cli/LICENSE).
