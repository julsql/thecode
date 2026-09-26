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
No password is ever stored, anywhere: each one is recomputed from your one key.
```

_(79 characters)_

**Alternates**

- `The password manager that stores no passwords. No account, works offline.` _(74)_
- `One key, one site, one password recomputed on demand. Never stored.` _(67)_

---

## 3. Full description _(max 4 000 characters)_

```
Your passwords are stored NOWHERE. Not on your phone, not on a server, not in an encrypted vault. TheCode recomputes each one on demand, from a single master key only you know and the site's name.

That is what sets it apart from other password managers: there is no password database to hack, lose or leak.

━━━━━━━━━━━━━━━━━━━━━
ONE KEY. ONE PASSWORD PER SITE.
━━━━━━━━━━━━━━━━━━━━━

→ Same key + same site = exactly the same password, every time, on every device.
→ Different sites = unrelated passwords.
→ Nothing to steal: no password is ever saved.

The derivation (PBKDF2 with 600,000 iterations, then HMAC-SHA256) is documented, tested and reproducible: your passwords do not depend on any service staying alive.

━━━━━━━━━━━━━━━━━━━━━
ALL STORAGE IS OPTIONAL
━━━━━━━━━━━━━━━━━━━━━

The app works fully without a vault, without an account and without sync: a key and a site name are all it needs.

• Local vault (optional): keep each site's username, length and characters — never the password. It stays on the phone, locked with biometrics or a dedicated password.
• Transfer without an account: send the vault to your other TheCode apps with an encrypted QR code or an encrypted file.
• Account (optional): automatic sync of the vault and default settings, end-to-end encrypted. The server never sees your master key, your sites or your usernames. Sign in with email or Google.

━━━━━━━━━━━━━━━━━━━━━
FEATURES
━━━━━━━━━━━━━━━━━━━━━

• Android autofill: TheCode offers the password inside apps and web pages, with the account's username
• Save suggestions: a new site is offered to the vault
• Password masked by default, revealed with one tap
• Length from 4 to 40 characters; lowercase, uppercase, digits, symbols
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
ONE PROJECT, ON ALL YOUR DEVICES
━━━━━━━━━━━━━━━━━━━━━

TheCode is a fully integrated, cross-platform project:

• Android app (you are here)
• iPhone and iPad app
• Mac app
• Extensions for Chrome, Firefox, Edge, Brave and Safari
• Website thecode.julsql.fr

The same key gives you the same passwords on each of them, even without an account or sync.

━━━━━━━━━━━━━━━━━━━━━
NO ADS
━━━━━━━━━━━━━━━━━━━━━

No ads, no trackers. Generation, the vault and autofill work without an account; an account is only used to sync your devices.

━━━━━━━━━━━━━━━━━━━━━
HOW IT WORKS
━━━━━━━━━━━━━━━━━━━━━

1. Pick a long master key and remember it: it cannot be recovered.
2. Type a site (e.g. "google.com") and, if needed, the username.
3. The password appears. Copy it, or let autofill insert it.

Later, on any device: same key, same site → same password.
```

_(≈ 3 100 characters)_

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

_(≈ 286 characters)_

---

## 5. Keywords / ASO

Google Play has no keyword field: titles and descriptions are indexed. Target queries, woven in
above:

- password manager
- password generator
- deterministic / vaultless / never-stored password
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
| In-app purchases | **No** |
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

1. **No password stored, anywhere** = nothing to leak; this is what sets it apart from the market
2. **All storage is optional** = the app works without a vault, an account or sync
3. **Storage can stay local** = vault on the device, locked, transferable by encrypted QR code or
   file without an account
4. **Optional account** = end-to-end encrypted sync, the server sees nothing
5. **One cross-platform project** = Android, iPhone, iPad, Mac, extensions, website: same key, same
   passwords

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
