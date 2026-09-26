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
One key, no stored passwords
```

_(28 characters)_

Alternate: `Passwords, never stored` _(23)_

## 3. Promotional text _(max 170 characters)_

Editable without a new version.

```
New: vault lock with Face ID or Touch ID, AutoFill with your username, and optional end-to-end encrypted sync.
```

_(≈ 110 characters)_

## 4. Description _(max 4,000 characters)_

```
TheCode is a password manager that stores no passwords. Each one is recomputed on your device, on demand, from a master key only you know and the site's name.

ONE KEY. ONE PASSWORD PER SITE.
• Same key + same site = exactly the same password, on every device.
• Different sites = unrelated passwords.
• Nothing to steal: no password is saved, neither on the device nor on a server.

The derivation (PBKDF2 with 600,000 iterations, then HMAC-SHA256) is documented, tested and reproducible: your passwords do not depend on any service staying alive.

FEATURES
• AutoFill on iPhone, iPad and Mac: TheCode offers the password in Safari and in apps, with the account's username
• Vault: keep each site's username, length and characters — never the password
• System save prompts: TheCode only keeps an account when it can recompute its password
• Vault lock with Face ID, Touch ID or a dedicated password
• Password masked by default, revealed with one tap
• Length from 4 to 40 characters; lowercase, uppercase, digits, symbols
• Default settings remembered, and shared across your devices with an account
• Move your vault to another device with an encrypted QR code
• Optional automatic sync, end-to-end encrypted
• Sign in with Apple, with Google or with an email address
• No ads, no trackers, no analytics

PRIVACY
• Your master key never leaves your device: it is kept in the keychain.
• Without an account, the app contacts no server: everything works offline.
• With an account, the vault is encrypted on the device before it leaves: the server sees neither your sites nor your usernames.
• The camera is only used to read a transfer QR code; no image is saved.
• Open source under the Apache 2.0 licence.

EVERYWHERE, WITH THE SAME KEY
iPhone, iPad and Mac apps, the Android app, extensions for Chrome, Firefox, Edge, Brave and Safari, and the website thecode.julsql.fr. The same key gives you the same passwords on each of them, even without sync.

FREE, WITH A COMPLETE PLAN
Generation, the vault and AutoFill are free and unlimited. A free account syncs a few entries across three devices; the complete plan lifts those limits.

HOW IT WORKS
1. Pick a long master key and remember it: it cannot be recovered.
2. Type a site (e.g. "apple.com") and, if needed, the username.
3. The password appears. Copy it, or let AutoFill insert it.
4. Turn TheCode on in Settings > General > AutoFill & Passwords (iOS), or System Settings > General > AutoFill & Passwords (macOS).
```

_(≈ 2 700 characters)_

## 5. Keywords _(max 100 characters, comma-separated, no spaces)_

```
password,generator,vault,security,key,autofill,offline,open source,deterministic,login
```

_(86 characters)_ — "manager" is already in the name, which Apple indexes.

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
| In-app purchases   | None (the complete plan is taken out on the website)         |
| Platforms          | iPhone, iPad, Mac                                            |
| App Privacy        | See [`docs/store-privacy.md`](../../docs/store-privacy.md)   |

**App Review information**: the app works without an account. For sync, provide a demo account
(email and password). Mention that the AutoFill provider is turned on in Settings.
