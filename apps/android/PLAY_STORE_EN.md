# TheCode — Google Play Store Listing (English)

Ready-to-paste content for the Play Console — English (US/UK/global) locale. All Google character
limits are observed.

---

## 1. App name _(max 30 characters)_

**Primary**

```
TheCode — Password Manager
```

_(26 characters)_

**Alternates**

- `TheCode: Computed Passwords` _(27)_
- `TheCode Password Generator` _(26)_

---

## 2. Short description _(max 80 characters)_

**Primary**

```
Passwords recomputed on your device from one key. None of them is ever stored.
```

_(78 characters)_

**Alternates**

- `One key, one site, one password. Offline, no account required.` _(63)_
- `A password manager that stores no passwords. Open source.` _(57)_

---

## 3. Full description _(max 4 000 characters)_

```
TheCode is a password manager that stores no passwords. Each one is recomputed on your phone, on demand, from a master key only you know and the site's name.

━━━━━━━━━━━━━━━━━━━━━
ONE KEY. ONE PASSWORD PER SITE.
━━━━━━━━━━━━━━━━━━━━━

→ Same key + same site = exactly the same password, every time, on every device.
→ Different sites = unrelated passwords.
→ Nothing to steal: no password is saved, neither on the phone nor on a server.

The derivation (PBKDF2 with 600,000 iterations, then HMAC-SHA256) is documented, tested and reproducible: your passwords do not depend on any service staying alive.

━━━━━━━━━━━━━━━━━━━━━
FEATURES
━━━━━━━━━━━━━━━━━━━━━

• Android autofill: TheCode offers the password inside apps and web pages, with the account's username
• Vault: keep each site's username, length and characters — never the password
• Save suggestions: a new site is offered to the vault
• Vault lock with biometrics or a dedicated password
• Password masked by default, revealed with one tap
• Length from 4 to 40 characters; lowercase, uppercase, digits, symbols
• Default settings remembered, and shared across your devices with an account
• Move your vault to another device with an encrypted QR code
• Optional automatic sync, end-to-end encrypted
• Sign in with Google or with an email address
• Dark, light or system theme
• No ads, no trackers, no analytics

━━━━━━━━━━━━━━━━━━━━━
PRIVACY
━━━━━━━━━━━━━━━━━━━━━

• Your master key never leaves your phone. It is encrypted there by the Android Keystore.
• Without an account, the app contacts no server: everything works offline.
• With an account, the vault is encrypted on the phone before it leaves: the server sees neither your sites nor your usernames.
• The camera is only used to read a transfer QR code; no image is saved.
• Open source under the Apache 2.0 licence: everything can be checked.

━━━━━━━━━━━━━━━━━━━━━
EVERYWHERE, WITH THE SAME KEY
━━━━━━━━━━━━━━━━━━━━━

• Android app (you are here)
• iPhone, iPad and Mac apps
• Extensions for Chrome, Firefox, Edge, Brave and Safari
• Website thecode.julsql.fr

The same key gives you the same passwords on each of them, even without sync.

━━━━━━━━━━━━━━━━━━━━━
FREE, WITH A COMPLETE PLAN
━━━━━━━━━━━━━━━━━━━━━

Generation, the vault and autofill are free and unlimited, with no ads. A free account syncs a few entries across three devices. The complete plan lifts those limits.

━━━━━━━━━━━━━━━━━━━━━
HOW IT WORKS
━━━━━━━━━━━━━━━━━━━━━

1. Pick a long master key and remember it: it cannot be recovered.
2. Type a site (e.g. "google.com") and, if needed, the username.
3. The password appears. Copy it, or let autofill insert it.

Later, on any device: same key, same site → same password.
```

_(≈ 2 900 characters)_

---

## 4. What's new _(max 500 characters)_

**For this release**

```
• Vault lock: biometrics or a dedicated password
• v2 vault with a username per account
• Autofill with the username
• Offer to add a new site to the vault
• Password masked by default
• Automatic, end-to-end encrypted sync
• Default settings shared across devices
• Sign in with Google
```

_(≈ 310 characters)_

---

## 5. Keywords / ASO

Google Play has no keyword field: titles and descriptions are indexed. Target queries, woven in
above:

- password manager
- password generator
- deterministic / vaultless password
- Android autofill
- biometric password
- open source, offline

---

## 6. Category & rating

| Field            | Value                                                  |
| ---------------- | ------------------------------------------------------ |
| Primary category | **Tools**                                              |
| Play tags        | `Security`, `Productivity`                             |
| Target audience  | 18+ (not designed for children)                        |
| Contains ads     | **No**                                                 |
| In-app purchases | **No** (the complete plan is taken out on the website) |
| Content access   | Unrestricted; an account is never required             |

**IARC questionnaire**: no sensitive content → PEGI 3 / ESRB Everyone.

**Review access**: the app works without an account. To test sync, provide a demo account (email and
password) under "App access".

---

## 7. Contact details & links

| Field                         | Value                                |
| ----------------------------- | ------------------------------------ |
| App website                   | https://thecode.julsql.fr            |
| Developer email               | contact@thecode.julsql.fr            |
| Privacy policy                | https://thecode.julsql.fr/en/privacy |
| Account deletion (web URL)    | https://thecode.julsql.fr/en/account |
| Source code                   | https://github.com/julsql/thecode    |

---

## 8. Data Safety declaration

Full, justified answers (in French): [`docs/store-privacy.md`](../../docs/store-privacy.md).

In short: data collected **Yes**, only with an optional account; email address and user ID, not
shared, for app functionality and account management; the vault is end-to-end encrypted and
therefore not declared; encrypted in transit **Yes**; deletion **Yes**.

---

## 9. Permissions to justify

| Permission                         | Justification                                                                        |
| ---------------------------------- | ------------------------------------------------------------------------------------ |
| `INTERNET`, `ACCESS_NETWORK_STATE` | Optional sync and Google sign-in. Without an account, no server is contacted.        |
| `CAMERA` (optional)                | Reading the QR code of a vault shown on another device. No image is saved or sent.   |
| `BIND_AUTOFILL_SERVICE`            | Autofill service, the app's core feature.                                            |
| Biometrics                         | Unlocking the master key and the vault; checked by the system.                       |

---

## 10. Required graphic assets

| Asset             | Format      | Dimensions                                 | Notes                      |
| ----------------- | ----------- | ------------------------------------------ | -------------------------- |
| Play Store icon   | 32-bit PNG  | 512 × 512 px                               | Current TheCode logo       |
| Feature graphic   | PNG / JPG   | 1024 × 500 px                              | **Required**               |
| Phone screenshots | PNG / JPG   | min 320 px short side, max 3840 px long side | 2 to 8; 1080 × 1920      |
| Tablet screenshots | Optional   | 1024 × 600 / 1280 × 800 px min             | Recommended                |

### Screenshots to produce

1. Main screen: masked password for `google.com`, username filled in
2. Vault: entry list, sync section on top
3. Vault lock: biometric prompt
4. Autofill inside an app, with the username
5. Offer to add a site to the vault
6. Dark mode

---

## 11. Positioning

**Promise**: _"The password manager that stores no passwords."_

1. **No stored password** = nothing to leak
2. **Offline by default** = sync is a choice, end-to-end encrypted
3. **One key to remember**, which never leaves the device

Objections:

- _"What if I forget my key?"_ → nobody can recover it, not even the service. Pick a memorable
  passphrase.
- _"What if my account leaks?"_ → the vault is encrypted with a key derived from the master key,
  which the server never has.

---

## 12. Pre-publication checklist

- [ ] Align `versionName` / `versionCode` in `app/build.gradle` (2.3 / 13) with the published
      version (the CHANGELOG says 3.0.0)
- [ ] Build a signed release AAB (`./gradlew bundleRelease`)
- [ ] Prepare the screenshots
- [ ] Fill in Data Safety from `docs/store-privacy.md`
- [ ] Enter the account deletion URL
- [ ] Provide a demo account for review
- [ ] Submit to internal testing, then production
