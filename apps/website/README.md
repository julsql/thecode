# TheCode Website

## 🌐 Official landing page, documentation hub, and online password generator for TheCode

Live website: https://thecode.julsql.fr

## ✨ Overview

This folder contains the full website for TheCode, serving as:

- a **public landing page** introducing the project
- a **documentation and support hub** (tutorial, privacy policy, terms…)
- an **online deterministic password generator** that runs entirely in the browser
- a **vault and account space**, for those who want to sync their settings between devices

The website explains how TheCode works, provides download links for all official apps (Android,
iOS/iPadOS/macOS, browser extension), and lets users generate their passwords directly online.
No account is needed to generate a password; no ads, no trackers.

## 🔐 TheCode in a Nutshell

TheCode generates secure, unique passwords for each website using:

- the **website** or **service name** (plus an optional username and a counter)
- a **secret key** chosen by the user

Algorithm v2 stretches the key with **PBKDF2-SHA256** (600,000 iterations), then derives each
password with **HMAC-SHA256** and converts the result into a password according to a customizable
character set. The legacy v1 algorithm (SHA-256) is only kept on a dedicated page, to find a
password set on a site before v2.

➡️ **Same key + same website = same secure password**\
➡️ **Different websites = different passwords**

Your secret key is **never transmitted nor stored** — all generation happens locally in the
browser, in the mobile apps, and in the extension.

## 🌟 Website Features

### 🔧 Online Password Generator

A fully client-side generator, with the same algorithm as the apps, master key strength guidance
and key fingerprint.

### 📒 Vault

An optional local vault (in the browser's `localStorage`) that remembers each site's settings and
username — never the password. It opens with the master key; "Lock" locks the whole session.
Transfer to or from another device by encrypted QR code or file (`TC2`), without an account.

### 👤 Account & Sync

An optional account (email/password, Google or Apple; registration is open) syncs the vault and the
default settings automatically, end-to-end encrypted (per-account salt, AES-256-GCM bound to each
entry id). The account page also lists connected devices and offers data export and account
deletion.

### 📘 Documentation & Help

- How the algorithm works
- How to install and use the apps
- Tips for choosing a secret key
- Frequently asked questions

### 📱 Download Links

Direct links to:

- TheCode Android app
- TheCode iOS/iPadOS/macOS app
- TheCode browser extension (Chrome, Firefox, Edge, Brave)

### 🔒 Privacy Policy

A clear explanation of what is stored, where, and what the sync service can and cannot see.

## 🛠️ Tech Stack

The website is built with:

- **Vue 3** + **Vue Router**
- **Vite**
- **TypeScript**
- **Vitest**

The sync service it talks to (`https://thecode-api.julsql.fr`) lives in `apps/api/`.

## 📦 Installation

From the repository root, `make setup` installs everything. Or, for the website alone:

```shell
cd apps/website
npm install
```

Start the development server:

```shell
npm run dev
```

Build for production:

```shell
npm run build
```

Preview the production build:

```shell
npm run preview
```

## 🧪 Tests

```shell
npm test
```

Conformance with the shared test vectors runs with `make test-conformance` from the repository
root.

## 🤝 Contributing

Contributions are welcome! Feel free to open **issues** or submit **pull requests** to improve the
website, UI, translations, accessibility, or performance.

## 📄 License

This project is released under the Apache License 2.0. See the `LICENSE` file for details.
