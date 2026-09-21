# TheCode — Google Play Store Listing (English)

Ready-to-paste content for the Play Console — English (US/UK/global) locale. All Google character limits are observed.

---

## 1. App name *(max 30 characters)*

**Primary**
```
TheCode — Password Generator
```
*(28 characters)*

**Alternates**
- `TheCode: Vaultless Passwords` *(28)*
- `TheCode — Local Password Gen` *(28)*
- `TheCode Password Manager` *(24)*

---

## 2. Short description *(max 80 characters)*

**Primary**
```
Regenerate every password from one secret key. Nothing is ever stored.
```
*(70 characters)*

**Alternates**
- `Deterministic, offline, SHA-256 password generator. No vault, no cloud.` *(70)*
- `One key. Endless passwords. Zero storage. Fully offline and open source.` *(72)*
- `A vaultless password manager: every password is rebuilt on demand.` *(66)*

---

## 3. Full description *(max 4 000 characters)*

```
TheCode reinvents the password manager: no password is ever stored. Every password is regenerated on the fly, locally, from a single secret key only you know.

━━━━━━━━━━━━━━━━━━━━━
ONE KEY. INFINITE PASSWORDS.
━━━━━━━━━━━━━━━━━━━━━

The idea is simple: you remember ONE secret key. For every site, TheCode combines your key with the site's name and runs SHA-256 to produce a unique, reproducible password.

→ Same key + same site = exactly the same password, every single time.
→ Different sites = completely different passwords.
→ No database. No vault to protect. Nothing to sync.

━━━━━━━━━━━━━━━━━━━━━
FEATURES
━━━━━━━━━━━━━━━━━━━━━

• Fully local SHA-256 deterministic generation
• Adjustable length from 4 to 40 characters
• Choose your character classes: lowercase, uppercase, digits, symbols
• Real-time entropy meter and security level (in bits)
• System-wide Autofill Service (Android 8.0+): TheCode suggests a password directly inside any app or website, unlocked with your fingerprint or face
• Biometric authentication to reveal the key or approve autofill
• One-tap copy to clipboard
• Quick share to any app
• Light, dark, or system theme
• Material Design 3 — clean and fluid
• No account required — no ads — no telemetry

━━━━━━━━━━━━━━━━━━━━━
ABSOLUTE PRIVACY
━━━━━━━━━━━━━━━━━━━━━

• Your key NEVER leaves your phone.
• No password is saved — neither locally nor in the cloud.
• No internet connection needed — the app runs entirely offline.
• Android backups (device transfer, cloud backup) are intentionally disabled for sensitive preferences.
• Open source under the Apache 2.0 license — everything is auditable.

No vault means no leak is possible. Your passwords don't exist anywhere until you regenerate them.

━━━━━━━━━━━━━━━━━━━━━
A FULL ECOSYSTEM
━━━━━━━━━━━━━━━━━━━━━

TheCode follows you everywhere, with the same key:

• Android app (you're here)
• iOS and macOS apps
• Browser extensions: Chrome, Firefox, Safari, Edge, Brave, Opera
• Online generator at thecode.julsql.fr

The same key on every platform instantly restores all your passwords.

━━━━━━━━━━━━━━━━━━━━━
WHO IS IT FOR?
━━━━━━━━━━━━━━━━━━━━━

• You're tired of password vaults getting breached
• You want to leave LastPass, 1Password, Bitwarden or Dashlane behind
• You switch phones often and hate reconfiguring everything
• You want access to your accounts without depending on any third-party service
• You love elegant, minimalist tools

━━━━━━━━━━━━━━━━━━━━━
HOW IT WORKS
━━━━━━━━━━━━━━━━━━━━━

1. Pick a strong secret key (memorize it — it lives only in your head)
2. Type a site name (e.g. "google.com")
3. Tune the length and allowed character classes
4. The password appears instantly
5. Copy, share it, or let the autofill service insert it for you

To log back in later: same key, same site name → same password.

━━━━━━━━━━━━━━━━━━━━━
OPEN SOURCE & FREE
━━━━━━━━━━━━━━━━━━━━━

TheCode is completely free. No in-app purchases. No subscription. No ads. The source code is published under the Apache 2.0 license and auditable by anyone.

Take back control of your passwords. Download TheCode.
```
*(≈ 3 100 characters — comfortable margin under the 4 000 limit)*

---

## 4. Promotional text / What's new *(max 500 characters)*

**For version 2.2**
```
• Android Autofill Service: TheCode suggests passwords inside any app or web page.
• Biometric authentication to reveal your key or approve autofill.
• Reworked entropy meter.
• Light / dark / system theme.
• Compatible with Android 5.0 → 14, optimized for Android 14.
```
*(≈ 320 characters)*

---

## 5. Keywords / ASO (Play Store Optimization)

Google Play has no dedicated keyword field — keywords are extracted from the title + short description + long description. The text above is written to naturally include the searches that matter most.

**Primary targets**
- password manager
- vaultless password
- password generator
- deterministic password
- SHA-256 password
- open source password manager
- offline password manager
- no cloud password
- Android autofill password
- biometric password

**Competitors to mention naturally**
LastPass, 1Password, Bitwarden, Dashlane, KeePass — used above in a comparative phrasing that complies with Google Play policy.

---

## 6. Category & rating

| Field | Value |
|---|---|
| Primary category | **Tools** |
| Secondary category | Productivity |
| Play Store tags | `Security`, `Productivity` |
| Target audience | Everyone (3+) |
| Contains ads | **No** |
| In-app purchases | **No** |
| Content access | Unrestricted |

**IARC questionnaire**
- No violence, no sensitive content → PEGI 3 / ESRB Everyone.

---

## 7. Contact details & links

| Field | Value to enter |
|---|---|
| App website | https://thecode.julsql.fr |
| Developer email | *(your public contact address)* |
| Privacy policy | https://thecode.julsql.fr/privacy *(to confirm / create)* |
| Source code | GitHub link: https://github.com/julsql/thecode |

> **Important:** Google requires a valid, publicly accessible privacy policy URL. If it doesn't exist yet, create a dedicated page on thecode.julsql.fr before publishing.

---

## 8. Data Safety declaration

Required section in Play Console. Correct answers for TheCode:

### Data collected
**None.** The app collects, transmits, and shares no user data.

### Data shared with third parties
**None.**

### Security practices
- ☑ Data is encrypted in transit *(not applicable — no data is sent)*
- ☑ Users can request data deletion *(not applicable — no data is stored server-side)*
- ☑ The app follows Mobile App Security best practices *(MASVS)*

### Sensitive local storage
- The user's key is stored in the app's private `SharedPreferences`
- Android backups are disabled (`android:allowBackup="false"` in the manifest)
- Access is gated by biometric authentication for key reveal and autofill

---

## 9. Permissions to justify

If Google asks why you request sensitive permissions:

| Permission | Justification |
|---|---|
| `BIND_AUTOFILL_SERVICE` | Password autofill service — the app's core feature, equivalent to iOS Autofill. |
| `USE_BIOMETRIC` / `USE_FINGERPRINT` | Protects the secret key and gates sensitive operations via fingerprint/face. |
| Internet access | **None** — the app does not request the `INTERNET` permission. |

The lack of an Internet permission is a selling point: highlight it in the description and in the Play Console answers.

---

## 10. Required graphic assets

| Asset | Format | Dimensions | Notes |
|---|---|---|---|
| Play Store icon | 32-bit PNG | 512 × 512 px | Reuse the existing TheCode logo |
| Feature graphic | PNG / JPG | 1024 × 500 px | **Required** — banner at the top of the listing |
| Phone screenshots | PNG / JPG | min 320 px short side, max 3840 px long side | Min 2, max 8. Recommended: 1080 × 1920 |
| 7" tablet screenshots | Optional | 1024 × 600 px min | Recommended |
| 10" tablet screenshots | Optional | 1280 × 800 px min | Recommended |
| Promo video | YouTube | — | Optional but recommended (30 s to 2 min) |

### Screenshots to produce (suggestions)
1. **Main screen** with a generated password for `google.com`, "Security: Very High" badge
2. **Length slider** + character class checkboxes
3. **Autofill activation** + Android system Autofill screen
4. **Biometric prompt** during autofill
5. **Dark mode** on the same main screen
6. **Help screen** explaining the principle in one sentence

### Feature graphic suggestions
- Left text: "One key. No vault. Nothing to leak."
- Right visual: TheCode logo + phone mockup
- Colors: app palette (check `colors.xml`)

---

## 11. Marketing positioning (recap)

**Unique promise**
> *"The only password manager that stores nothing."*

**Three pillars to hammer home**
1. **Zero storage** = zero possible leak
2. **100% local** = no cloud dependency
3. **Only one key to remember** = no vault to protect

**Common objections** (to surface in the website FAQ and the developer "About" section):
- *"What if I lose my key?"* → only you know your key, but you can re-enter it on any device, at any time, and recover everything.
- *"What if someone guesses my key?"* → SHA-256 is cryptographically strong; pick a long key, like a passphrase.
- *"Why is this better than an encrypted vault?"* → vaults can leak (Bitwarden, LastPass…). TheCode has nothing to leak.

---

## 12. Pre-publication checklist

- [ ] Bump `versionCode` to 12 and `versionName` to 2.2 *(already done in `app/build.gradle`)*
- [ ] Build a signed release AAB (`./gradlew bundleRelease`)
- [ ] Verify `targetSdk` is ≥ 34 (Android 14) — required by Play Store
- [ ] Prepare 6 screenshots at 1080 × 1920
- [ ] Build the 1024 × 500 feature graphic
- [ ] Publish the privacy policy on thecode.julsql.fr
- [ ] Fill the IARC questionnaire in the console
- [ ] Fill the Data Safety section
- [ ] Submit to internal testing first, then production
- [ ] Schedule the release alongside website and extension announcements

---

*Listing copy generated for the Play Store — app version: 2.2 (versionCode 12).*
