# TheCode Browser Extension

## 🧩 Generate secure, deterministic passwords directly inside your browser

Works on Chrome, Firefox (desktop), Edge and Brave

## ✨ Overview

The TheCode Browser Extension computes a secure, unique password for every website from:

- the website domain (plus an optional username and a counter), and
- your master key (session key)

With TheCode, you never store passwords and never need to remember them.

Just enter the same master key again, and the extension will regenerate the exact same password for
each website.

➡️ One key to unlock secure passwords everywhere.\
➡️ No stored password. Sync is optional and end-to-end encrypted.

## 🔧 Features

- 🔍 Detects password fields on any website and offers the password in an in-page menu
- ⚡ Algorithm v2 (PBKDF2-SHA256 + HMAC-SHA256); v1 stays available for one-off generation, to find
  a password set before v2
- 🔒 Never stores generated passwords
- 💾 Your master key is kept in `storage.session`: in memory only, erased when the browser closes
- 📒 A local vault remembers each site's login, length and characters — never the password
- 🔐 The vault opens with the master key; "Lock" locks the whole session
- 📲 Transfer the vault without an account, by encrypted QR code or file (`TC2`)
- 🔄 Optional account (email/password or Google): the vault and the default settings sync
  automatically, end-to-end encrypted
- 💪 Master key strength guidance and key fingerprint
- 🧪 Password generation algorithm is fully unit-tested against the shared test vectors

Your master key is never transmitted nor written to disk. All generation is performed locally within
the browser.

## 🔐 How It Works

1. You open the extension popup
2. You enter your master key
3. The background service worker holds the key in `storage.session` (memory only)
4. When you visit a site, the extension:

- detects password fields
- identifies the domain and, if the vault knows it, the login
- computes the deterministic password
- offers to fill it into the form

The key survives service worker restarts, but not a browser restart: it must then be re-entered.

## Installation

You can download TheCode from the official browser extension stores:

- [Chrome](https://chromewebstore.google.com/detail/thecode/jeknefpalcipdlnbeboefonmnlejepen)
- [Firefox](https://addons.mozilla.org/fr/firefox/addon/thecode/)
- [Edge](https://chromewebstore.google.com/detail/thecode/jeknefpalcipdlnbeboefonmnlejepen)
- [Brave](https://chromewebstore.google.com/detail/thecode/jeknefpalcipdlnbeboefonmnlejepen)
- and other Chromium-based browsers (see Chrome link)

On iPhone, iPad and Mac, use the [Apple apps](../apple/README.md) and their AutoFill instead.

## 📦 Installation for development

From the repository root, `make pack-extension` builds `dist/extension/chrome/` and
`dist/extension/firefox/` (each with the right `manifest.json`), plus a zip of each.

### Chrome / Edge / Brave

1. Run `make pack-extension`
2. Open `chrome://extensions` or `edge://extensions`
3. Enable Developer mode
4. Click Load unpacked
5. Select `dist/extension/chrome`
6. Open the extension icon and enter your master key

### Firefox

1. Run `make pack-extension`
2. Open `about:debugging#/runtime/this-firefox`
3. Click Load Temporary Add-on
4. Select `dist/extension/firefox/manifest.json`
5. Open the extension icon and enter your master key

## 🔒 Security & Behavior

- Your master key is not logged, not synced, and never written to disk (`storage.session` only)
- Generated passwords are never saved — only inserted into the active field
- The vault screen opens with the master key, compared in constant time; no fingerprint of the key
  is ever stored
- Without an account, the extension contacts no server

## 🔏 Permissions & data

| Permission                    | Why                                                                                                   |
| ----------------------------- | ----------------------------------------------------------------------------------------------------- |
| `storage`                     | Vault, settings and sync session on the device; master key in `storage.session`                       |
| `activeTab`                   | Know the current tab's site when the popup opens                                                      |
| `identity`                    | Only for the optional "Continue with Google" sign-in (`launchWebAuthFlow`, scopes `openid email`)     |
| `<all_urls>` + content script | Find password fields on any login page and offer the computed password; nothing from the page is sent |

With a sync account, the server receives the account email, the account password (kept as an
Argon2id hash) or the Google ID token, and the vault encrypted end to end. No analytics, no
tracking, no remote code. Store answers: `docs/store-privacy.md`; policy:
https://thecode.julsql.fr/en/privacy.

## 🧪 Testing

- Unit tests (Jest): `cd js-test && npm test`
- Conformance with the shared vectors: `make test-conformance` from the repository root
- End-to-end (Playwright): `make test-e2e` from the repository root

## 🛠 Development Notes

- Chrome/Edge/Brave use `manifest-chrome-brave-edge.json` (service worker), also the default
  `manifest.json`
- Firefox desktop uses `manifest-safari-firefox.json` (background scripts)
- MV3 service workers may stop/restart at any moment — the key lives in `storage.session`, never on
  disk

## 🤝 Contributing

Contributions are welcome! Bug fixes, browser improvements, UI changes, and manifest updates are all
appreciated. Please open an issue or submit a pull request.

## 📄 License

Distributed under the Apache License 2.0 — see `LICENSE`.
