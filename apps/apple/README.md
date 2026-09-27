# TheCode Apple Apps (iOS, iPadOS & macOS)

## 🍏 Native iOS, iPadOS and macOS applications for TheCode

With AutoFill credential providers on both platforms

## ✨ Overview

This folder contains the official **TheCode applications for iPhone, iPad and Mac**, and their
**AutoFill extensions**.

They generate secure, deterministic passwords from:

- the **website domain** (plus an optional username and a counter), and
- a **secret key** chosen by the user

Passwords are never stored: each one is recomputed on demand with algorithm v2 (PBKDF2-SHA256 +
HMAC-SHA256). The legacy v1 algorithm stays available for one-off generation, to find a password set
on a site before v2.

The Apple app ecosystem provides:

- an **iOS / iPadOS application**
- a **macOS application**
- an **AutoFill credential provider** for each, that fills the username and the password in Safari
  and in other apps

## 🔧 Features

- Deterministic password generator, fully offline
- Length from 4 to 40 characters, choice of character sets
- Master key strength guidance and key fingerprint, to check the key was typed correctly
- **Local vault** (optional): remembers each site's settings and username — never the password —
  with renewal (counter) and linked domains
- Vault unlocked with **Face ID / Touch ID** or the device passcode, or with the master key on a
  device without authentication. "Lock" locks the whole session
- **Transfer without an account**: encrypted QR code or file (`TC2`)
- **Optional account**: email/password, Google or Apple. The vault and the default settings sync
  automatically, end-to-end encrypted (per-account salt, AES-256-GCM bound to each entry id)
- Account deletion from the app

## 🔑 AutoFill

Enable it in **Settings → Passwords → Password Options** (iOS) or **System Settings → General →
AutoFill & Passwords** (macOS), then pick TheCode.

- The extension identifies the domain and proposes the vault's username for it
- The password is computed on the fly after authentication, then filled
- Nothing is written back: generation is deterministic

## 🔐 Security Summary

### Master key

Stored in the keychain, encrypted at rest and tied to this device. Shared with the AutoFill
extension through the app's keychain access group. Never written to the app group container, and
never leaves the device (earlier versions kept it in plain text there; it is migrated on first
launch).

### Everywhere

- Passwords are never stored
- All calculations are done locally on the device
- With an account, the server only receives encrypted blocks it cannot read
- No ads, no trackers

## 📦 Installation

### 📱 App Store

https://apps.apple.com/app/thecode-password-manager/id6753169043

### From source

Open `thecode.xcodeproj` in Xcode and run the `TheCode` (iOS / iPadOS) or `TheCode for Mac` scheme.

## 🛠 Development

- `Shared/` holds the code common to iOS and macOS. Some of it is copied from the monorepo's
  `shared/apple/`: edit the source there and run `make sync-shared` from the repository root.
- Conformance with the shared test vectors: `make test-conformance-apple` from the repository root
  (needs an iOS simulator).

### "Continue with Google" (sync account)

Both apps offer Google sign-in for the sync account, next to email/password and Apple. No SDK:
`ASWebAuthenticationSession` + OAuth 2.0 authorization code with PKCE, no client secret. The Google
id_token is sent to `POST {endpoint}/v1/auth/google`.

The button is hidden until a client id is configured:

1. Google Cloud Console → APIs & Services → Credentials → _Create OAuth client ID_ → type **iOS**,
   bundle id `fr.julsql.thecode` (the same client serves the Mac app, which shares that bundle id).
2. In the Xcode project (project-level build settings, both configurations), set
   `GOOGLE_IOS_CLIENT_ID` to the client id, e.g. `123-abc.apps.googleusercontent.com`.
   - `Info.plist` key `GoogleIOSClientID` of both apps reads `$(GOOGLE_IOS_CLIENT_ID)`.
   - The redirect URL scheme (`com.googleusercontent.apps.123-abc`) is derived from it by
     `GOOGLE_IOS_REVERSED_CLIENT_ID` and registered in both `Info.plist`s: nothing else to edit.
3. Add the same client id to the API's accepted Google audiences.

Redirect URI used: `com.googleusercontent.apps.<id>:/oauth2redirect`.

### "Sign in with Apple"

Native `AuthenticationServices` flow; the identity token is sent to `POST {endpoint}/v1/auth/apple`.
The bundle id must be listed in the API's accepted Apple audiences.

## 🤝 Contributing

Contributions are welcome! You can help improve the UI, security handling, or AutoFill behavior.

Feel free to open **issues** or submit **pull requests**.

## 📄 License

Distributed under the Apache License 2.0 — see `LICENSE`.
