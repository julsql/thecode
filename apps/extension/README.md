# TheCode Browser Extension

## 🧩 Generate secure, deterministic passwords directly inside your browser
Works on Chrome, Edge, Brave, Firefox, and Safari

## ✨ Overview
The TheCode Browser Extension automatically generates secure, unique passwords for every website using:
- the website domain, and
- your secret key (session key)

With TheCode, you never store passwords and never need to remember them.

Just enter the same secret key again, and the extension will regenerate the exact same password for each website.

➡️ One key to unlock secure passwords everywhere.\
➡️ No storage, no sync, no risk.

## 🔧 Features
- 🔍 Detects password fields on any website
- ⚡ Suggests a deterministic password generated from your session key + domain
- 🔒 Never stores generated passwords
- 💾 Your session key is kept only in memory while the service worker is active
- 🌍 Works across Chrome, Edge, Brave, Firefox, and Safari
- 🧪 Password generation algorithm is fully unit-tested
- 🧂 Optional local storage of a non-secret salt per site to allow consistent derivations after browser restarts

Your session key is neither transmitted nor persisted.
All generation is performed locally within the browser.

## 🔐 How It Works
1. You open the extension popup
2. You enter your session key
3. The background service worker holds the derived key in memory only
4. When you visit a site, the extension:
- detects password fields
- identifies the domain
- generates a deterministic password
- injects it into the form field

If the service worker is restarted (MV3 behavior), the session key is lost and must be re-entered.

## Installation
You can download TheCode from the official browser extension stores:
- [Chrome](https://chromewebstore.google.com/detail/thecode/jeknefpalcipdlnbeboefonmnlejepen)
- [Edge](https://chromewebstore.google.com/detail/thecode/jeknefpalcipdlnbeboefonmnlejepen)
- [Firefox](https://addons.mozilla.org/fr/firefox/addon/thecode/)
- [Safari](https://apps.apple.com/app/thecode-password-manager/id6753169043)
- [Brave](https://chromewebstore.google.com/detail/thecode/jeknefpalcipdlnbeboefonmnlejepen)
- and other Chromium-based browsers (see Chrome link)

## 📦 Installation for developpment
Download the extension archive from the [Releases page](https://github.com/TheCodeDevLab/thecode-extension/releases/).

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

### Safari
1. Download and unzip the extension archive
2. Copy the `safari-firefox` manifest into the `manifest.json`
3. Enable Developer Mode in Safari
4. Go to: `Safari > Settings > Developer`
5. Click Add Extension…
6. Select the extension folder
7. Open the extension and enter your session key

## 🔒 Security & Behavior
- Your session key is not stored, not logged, and not synced
- A derived version of the key is kept only in memory by the MV3 service worker
- Generated passwords are never saved — only inserted into the active field
- If the service worker shuts down (normal MV3 behavior), the key must be re-entered

## 🧪 Testing
The password generation algorithm and supporting logic are covered by unit tests to ensure deterministic, correct behavior.

## 🛠 Development Notes
- Chrome/Edge/Brave use the default manifest (or `chrome-brave-edge`)
- Firefox & Safari require the `safari-firefox` manifest
- Safari builds must be packaged through Xcode
- MV3 service workers may stop/restart at any moment — session key persistence is intentionally avoided for security

## 🤝 Contributing
Contributions are welcome!
Bug fixes, browser improvements, UI changes, and manifest updates are all appreciated.
Please open an issue or submit a pull request.

## 📄 License
Distributed under the Apache License.
