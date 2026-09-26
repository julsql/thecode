# TheCode — App Store Listing (iOS and macOS, English)

Ready-to-paste content for App Store Connect, for the iPhone/iPad app and the Mac app. Apple's
character limits are given and observed.

---

## 1. Name _(max 30 characters)_

```
TheCode — Password Manager
```

_(26 characters)_

## 2. Subtitle _(max 30 characters)_

```
Passwords, never stored
```

_(23 characters)_

Alternate: `One key, no stored passwords` _(28)_

## 3. Promotional text _(max 170 characters)_

Editable without a new version.

```
No password is stored, anywhere: each one is recomputed on demand from your key. No account needed, works offline, on all your devices.
```

_(≈ 135 characters)_

## 4. Description _(max 4,000 characters)_

```
Your passwords are stored NOWHERE. Not on your device, not on a server, not in an encrypted vault. TheCode recomputes each one on demand, from a single master key only you know and the site's name.

That is what sets it apart from other password managers: there is no password database to hack, lose or leak.

ONE KEY. ONE PASSWORD PER SITE.
• Same key + same site = exactly the same password, on every device.
• Different sites = unrelated passwords.
• Nothing to steal: no password is ever saved.

The derivation (PBKDF2 with 600,000 iterations, then HMAC-SHA256) is documented, tested and reproducible: your passwords do not depend on any service staying alive.

ALL STORAGE IS OPTIONAL
The app works fully without a vault, without an account and without sync: a key and a site name are all it needs.
• Local vault (optional): keep each site's username, length and characters — never the password. It stays on the device, locked with Face ID, Touch ID or a dedicated password.
• Transfer without an account: send the vault to your other TheCode apps with an encrypted QR code or an encrypted file.
• Account (optional): automatic sync of the vault and default settings, end-to-end encrypted. The server never sees your master key, your sites or your usernames. Sign in with email, Google or Apple.

FEATURES
• AutoFill on iPhone, iPad and Mac: TheCode offers the password in Safari and in apps, with the account's username
• System save prompts: TheCode only keeps an account when it can recompute its password
• Password masked by default, revealed with one tap
• Length from 4 to 40 characters; lowercase, uppercase, digits, symbols
• No ads, no trackers, no analytics

PRIVACY
• Your master key never leaves your device: it is kept in the keychain.
• Without an account, the app contacts no server: everything works offline.
• With an account, the vault is encrypted on the device before it leaves: the server sees neither your sites nor your usernames.
• The camera is only used to read a transfer QR code; no image is saved.
• Open source under the Apache 2.0 licence.

ONE PROJECT, ON ALL YOUR DEVICES
TheCode is a fully integrated, cross-platform project:
• iPhone and iPad app
• Mac app
• Android app
• Extensions for Chrome, Firefox, Edge, Brave and Safari
• Website thecode.julsql.fr
The same key gives you the same passwords on each of them, even without an account or sync.

NO ADS
No ads, no trackers. Generation, the vault and AutoFill work without an account; an account is only used to sync your devices.

HOW IT WORKS
1. Pick a long master key and remember it: it cannot be recovered.
2. Type a site (e.g. "apple.com") and, if needed, the username.
3. The password appears. Copy it, or let AutoFill insert it.
4. Turn TheCode on in Settings > General > AutoFill & Passwords (iOS), or System Settings > General > AutoFill & Passwords (macOS).
```

_(≈ 2 900 characters)_

## 5. Keywords _(max 100 characters, comma-separated, no spaces)_

```
password,generator,vaultless,never stored,security,key,autofill,offline,open source,deterministic
```

_(97 characters)_ — "manager" is already in the name, which Apple indexes.

## 6. What's New in this version _(max 4,000 characters)_

```
• Vault lock: Face ID, Touch ID or a dedicated password
• v2 vault, with a username per account
• AutoFill with the username, optional
• System save prompts, when TheCode can recompute the password
• Password masked by default
• Automatic, end-to-end encrypted sync
• Default settings shared across your devices
• Sign in with Apple or with Google
```

## 7. URLs

| Field                 | Value                                                          |
| --------------------- | -------------------------------------------------------------- |
| Support URL           | https://thecode.julsql.fr/en/contact                           |
| Marketing URL         | https://thecode.julsql.fr                                      |
| Privacy Policy URL    | https://thecode.julsql.fr/en/privacy                           |
| Terms of Use (EULA)   | Apple's standard EULA, or https://thecode.julsql.fr/en/terms   |
| Copyright             | `2026 <publisher name>` — see `apps/website/src/legal/identity.ts` |

## 8. General information

| Field              | Value                                                        |
| ------------------ | ------------------------------------------------------------ |
| Primary category   | Utilities                                                    |
| Secondary category | Productivity                                                 |
| Age rating         | 4+                                                           |
| In-app purchases   | None         |
| Platforms          | iPhone, iPad, Mac                                            |
| App Privacy        | See [`docs/store-privacy.md`](../../docs/store-privacy.md)   |

**App Review information**: the app works without an account. For sync, provide a demo account
(email and password). Mention that the AutoFill provider is turned on in Settings.
