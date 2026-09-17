# TheCode Website

## 🌐 Official landing page, documentation hub, and online password generator for TheCode

Live website: https://thecode.julsql.fr

## ✨ Overview

This repository contains the full website for TheCode, serving as both:

- a **public landing page** introducing the project
- a **documentation and support hub** (installation guides, privacy policy…)
- an **online deterministic password generator** that runs entirely in the browser

The website explains how TheCode works, provides download links for all official apps (Android, iOS, macOS, browser extension), and allows users to generate their passwords directly online with no signup, no database, and no tracking.

## 🔐 TheCode in a Nutshell

TheCode generates secure, unique passwords for each website using:

- the **website** or **service name**
- a **secret key** chosen by the user

The algorithm combines these values, hashes them using **SHA-256**, and converts the hash into a password according to a customizable character set.

➡️ **Same key + same website = same secure password**\
➡️ **Different websites = different passwords**

Your secret key is **neither transmitted nor stored** — all generation happens locally in the browser, in the mobile apps, and in the extensions.

## 🌟 Website Features

The website provides:

### 🔧 Online Password Generator

A fully client-side generator that mirrors all features of the app.

### 📘 Documentation & Help

- How the algorithm works
- How to install and use the apps
- Tips for choosing a secret key
- Frequently asked questions

### 📱 Download Links

Direct links to:

- TheCode Android app
- TheCode iOS/macOS app
- TheCode browser extension

### 🔒 Privacy Policy

A clear explanation of how no data is collected, stored, or transmitted.

### 🎨 Project Presentation

An introduction to the philosophy of TheCode, its open ecosystem, and available tools.

## 🛠️ Tech Stack

The website is built with:

- **Vue 3**
- **Vite**
- **TypeScript**

## 📦 Installation

Clone the repository and install dependencies:

```shell
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

Run tests with:
npm test

## 🤝 Contributing

Contributions are welcome!
Feel free to open **issues** or submit **pull requests** to improve the website, UI, translations, accessibility, or performance.

## 📄 License

This project is released under the Apache License.
See the LICENSE file for details.
