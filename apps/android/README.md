# TheCode Android App

> 🤖 Official Android application for TheCode\
> Generate deterministic, secure passwords directly on your device

## ✨ Overview
This repository contains the **Android application** for **TheCode**, a deterministic password generator that creates secure, unique passwords for every website using:
- the **website or service name**, and
- your **secret key**

The Android app provides a fast and privacy-focused way to generate your passwords locally — without storing anything and without requiring an account.

> The Android app does **not** include a browser extension.\
> It is a standalone generator designed for quick on-device usage.

## 🔧 Features
- 🔐 **Deterministic password generation**\
Same key + same domain = same password
- 🔄 **Different websites automatically yield different passwords**
- 🎛️ Adjustable settings:
    - password length
    - character sets (lowercase, uppercase, numbers, symbols)
- 📴 **Fully offline** — no network needed
- 💾 **Nothing stored** — passwords are never saved or transmitted
- ⚡ Modern and simple Android interface

## 🔒 Security
- Your secret key is **never uploaded, never synced, and never transmitted**
- Passwords are **not saved** anywhere
- All operations are performed **locally on your device**
- The app stores **no generated passwords and no website history**
You only need to remember one key, and you can regenerate all your passwords anytime.

## 📱 Installation
The app is available on the Google Play Store:
👉 https://play.google.com/store/apps/details?id=fr.juliette.thecode

## 🛠 Development
### Requirements
- Android Studio (latest version)
- Android SDK 21+
- Java (recommended setup)

### Build & Run
Clone the repository and open it in Android Studio:
```shell
git clone git@github.com:TheCodeDevLab/TheCode_Android.git
```
Then build and run the project via Android Studio.

## 🤝 Contributing
Contributions are welcome!\
You can help improve the UI, add features, or enhance performance.

Feel free to open an **issue** or submit a **pull request**.

## 📄 License
This project is distributed under the Apache License.
