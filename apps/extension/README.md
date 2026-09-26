# TheCode Browser Extension

## 🧩 Generate secure, deterministic passwords directly inside your browser

Works on Chrome, Edge, Brave, Firefox (desktop & Android), and Safari

## ✨ Overview

The TheCode Browser Extension automatically generates secure, unique passwords for every website using:

- the website domain, and
- your secret key (session key)

With TheCode, you never store passwords and never need to remember them.

Just enter the same secret key again, and the extension will regenerate the exact same password for each website.

➡️ One key to unlock secure passwords everywhere.\
➡️ No stored password. Sync is optional and end-to-end encrypted.

## 🔧 Features

- 🔍 Detects password fields on any website
- ⚡ Suggests a deterministic password generated from your session key + domain
- 🔒 Never stores generated passwords
- 💾 Your master key is kept in `storage.session`: in memory only, erased when the browser closes
- 📒 A local vault remembers each site's login, length and characters — never the password
- 🔄 Optional sync of the vault, end-to-end encrypted, with an email or Google account
- 🌍 Works across Chrome, Edge, Brave, Firefox (desktop & Android), and Safari
- 🧪 Password generation algorithm is fully unit-tested

Your master key is never transmitted nor written to disk.
All generation is performed locally within the browser.

## 🔐 How It Works

1. You open the extension popup
2. You enter your session key
3. The background service worker holds the key in `storage.session` (memory only)
4. When you visit a site, the extension:

- detects password fields
- identifies the domain
- generates a deterministic password
- injects it into the form field

The key survives service worker restarts, but not a browser restart: it must then be re-entered.

## Installation

You can download TheCode from the official browser extension stores:

- [Chrome](https://chromewebstore.google.com/detail/thecode/jeknefpalcipdlnbeboefonmnlejepen)
- [Edge](https://chromewebstore.google.com/detail/thecode/jeknefpalcipdlnbeboefonmnlejepen)
- [Firefox](https://addons.mozilla.org/fr/firefox/addon/thecode/)
- [Safari](https://apps.apple.com/app/thecode-password-manager/id6753169043)
- [Brave](https://chromewebstore.google.com/detail/thecode/jeknefpalcipdlnbeboefonmnlejepen)
- and other Chromium-based browsers (see Chrome link)

## 📦 Installation for developpment

Download the extension archive from the [Releases page](https://github.com/julsql/thecode/releases/).

### Chrome / Edge / Brave

1. Download and unzip the extension archive
2. Open:

- `chrome://extensions`
- or `edge://extensions`

3. Enable Developer mode
4. Click Load unpacked
5. Select the extension folder (thecode-extension)
6. Open the extension icon and enter your session key

### Firefox

1. Download and unzip the extension archive
2. Copy the `safari-firefox` manifest into the `manifest.json`
3. Open: `about:debugging#/runtime/this-firefox`
4. Click Load Temporary Add-on
5. Select `manifest.json`
6. Open the extension icon and enter your session key

### Firefox for Android

Firefox for Android only installs extensions that are signed by Mozilla
(distributed through addons.mozilla.org) or loaded via Firefox Nightly's
custom collection feature.

To test the build locally with Firefox Nightly:

1. Download and unzip the extension archive
2. Copy the `firefox-android` manifest into the `manifest.json`
3. In Firefox Nightly on Android, enable: Settings > About Firefox Nightly
   (tap the logo 5 times) > Custom Add-on collection
4. Provide your AMO collection containing the signed XPI of TheCode
5. Open Settings > Add-ons, install TheCode, then open it from the menu and
   enter your session key

Production install: use the AMO listing once published
([Firefox add-on page](https://addons.mozilla.org/fr/firefox/addon/thecode/)).

### Safari

1. Download and unzip the extension archive
2. Copy the `safari-firefox` manifest into the `manifest.json`
3. Enable Developer Mode in Safari
4. Go to: `Safari > Settings > Developer`
5. Click Add Extension…
6. Select the extension folder
7. Open the extension and enter your session key

## 🔒 Security & Behavior

- Your master key is not logged, not synced, and never written to disk (`storage.session` only)
- Generated passwords are never saved — only inserted into the active field
- The vault screen is locked behind a vault password, kept as a PBKDF2 hash in `storage.local`
- Without an account, the extension contacts no server

## 🔏 Permissions & data

| Permission                    | Why                                                                                                   |
| ----------------------------- | ----------------------------------------------------------------------------------------------------- |
| `storage`                     | Vault, settings, vault-lock hash and sync session on the device; master key in `storage.session`      |
| `activeTab`                   | Know the current tab's site when the popup opens                                                      |
| `identity`                    | Only for the optional "Continue with Google" sign-in (`launchWebAuthFlow`, scopes `openid email`)     |
| `<all_urls>` + content script | Find password fields on any login page and offer the computed password; nothing from the page is sent |

With a sync account, the server receives the account email, the account password (kept as an
Argon2id hash) or the Google ID token, and the vault encrypted end to end. No analytics, no
tracking, no remote code. Store answers: `docs/store-privacy.md`; policy:
https://thecode.julsql.fr/en/privacy.

## 🧪 Testing

The password generation algorithm and supporting logic are covered by unit tests to ensure deterministic, correct behavior.

## 🛠 Development Notes

- Chrome/Edge/Brave use the default manifest (or `chrome-brave-edge`)
- Firefox desktop & Safari require the `safari-firefox` manifest
- Firefox for Android requires the `firefox-android` manifest (adds the
  `gecko_android` block, drops `theme_icons`, uses PNG toolbar icons)
- Safari builds must be packaged through Xcode
- MV3 service workers may stop/restart at any moment — the key lives in `storage.session`, never on disk

## 🤝 Contributing

Contributions are welcome!
Bug fixes, browser improvements, UI changes, and manifest updates are all appreciated.
Please open an issue or submit a pull request.

## 📄 License

Distributed under the Apache License.
