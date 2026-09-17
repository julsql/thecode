# TheCode Apple App (iOS & macOS)

## 🍏 Native iOS and macOS applications for TheCode
Includes the Safari browser extension on both platforms

## ✨ Overview
This repository contains the official **TheCode applications for iOS and macOS**, including their integrated **Safari extensions**.

They allow users to generate secure, deterministic passwords based on:
- the **website domain**, and
- a **secret key** chosen by the user

The Apple app ecosystem provides:
- a **macOS desktop application**
- a **Safari extension for macOS**
- an **iOS application** to generate passwords manually
- a **Safari extension for iOS** that uses the same secret key

## 🖥️ macOS Application & Safari Extension
The macOS app includes:

### macOS App (soon)
- Full password generator (offline, deterministic)
- No storage of generated passwords
- Quick access to the algorithm and settings

### Safari Extension (macOS)
- Detects password fields on websites
- Generates deterministic passwords using your secret key
- Fills them automatically
- Uses the **same logic** as the cross-browser thecode-extension

### Security on macOS
- Your secret key is **never sent**
- When the worker stops (normal MV3 behavior), the key is erased and must be entered again
<!-- - It is **derived** and kept **in memory only** while the Safari extension’s service worker is active-->

## 📱 iOS Application & Safari Extension
The iOS ecosystem includes:

### iOS App
- Standalone password generator (manual generation)
- Easy way to enter your secret key and generate passwords on the go
- Manages the key for the Safari extension

### Safari Extension (iOS)
- Works directly inside Safari on iPhone/iPad
- Suggests deterministic passwords based on the same key
- Has a popup UI, but it is informational only (settings are managed through the app)

### Key Sharing on iOS
- The secret key is securely stored using iOS storage mechanisms
- It is **shared between the app and the Safari extension**
- This allows the extension to generate passwords without asking for the key every time
- The key is never transmitted externally

## 🔐 Security Summary

### macOS
Secret key is not persisted and never stored unencrypted
Key is kept only in memory while the extension's service worker is alive

### iOS
Secret key is stored securely (Keychain / App Group)
Shared between the app and the Safari extension to ensure smooth UX
Never stored or transmitted outside the device

### Both platforms
Passwords are never stored
All calculations are done locally on the device
Generated passwords depend only on domain + key, making them deterministic

## 📦 Installation

### macOS & iOS
Open the project on XCode and run it

### 📱 App Store:
https://apps.apple.com/app/thecode-password-manager/id6753169043

## 🛠 Development
Coming soon… (or add your build instructions here)

## 🤝 Contributing
Contributions are welcome!
You can help improve UI, security handling, or Safari extension behavior.

Feel free to open **issues** or submit **pull requests**.

## 📄 License
Distributed under the Apache License.
