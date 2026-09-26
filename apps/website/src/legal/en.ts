/**
 * Legal documents, English version.
 *
 * A courtesy translation of the French originals, which govern: the service is
 * operated from France and sold under French law. Saying so is fairer than
 * letting an English reader believe the translation is the contract.
 */

import { IDENTITY, PRICE } from "./identity";
import { missing, type LegalDoc } from "./types";

const UPDATED = "19 September 2026";
const PRIVACY_UPDATED = "26 September 2026";
const price = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: PRICE.currency,
  minimumFractionDigits: PRICE.cents % 100 === 0 ? 0 : 2,
}).format(PRICE.cents / 100);

const f = (value: string) => missing(value, "en");

const TRANSLATION_NOTE =
  "This is a courtesy translation. The French version is the one that governs: " +
  "the service is operated from France and sold under French law.";

export const legalNotice: LegalDoc = {
  title: "Legal notice",
  updated: UPDATED,
  intro: [TRANSLATION_NOTE],
  sections: [
    {
      heading: "Publisher",
      items: [
        `Publisher: ${f(IDENTITY.editor)}`,
        `Legal status: ${f(IDENTITY.status)}`,
        `Address: ${f(IDENTITY.address)}`,
        `Company number (SIRET): ${f(IDENTITY.siret)}`,
        `VAT number: ${IDENTITY.vat || "not applicable (VAT exemption)"}`,
        `Publication director: ${f(IDENTITY.director)}`,
        `Contact: ${IDENTITY.email}`,
      ],
    },
    {
      heading: "Hosting",
      items: [`Host: ${f(IDENTITY.host)}`, `Address: ${f(IDENTITY.hostAddress)}`],
      paragraphs: ["The site and the sync service run on a server located in the European Union."],
    },
    {
      heading: "Intellectual property",
      paragraphs: [
        "TheCode's source code is published under a free software licence and stays publicly " +
          "readable. The name, brand and logo remain the publisher's property.",
        "The generation algorithm is documented and deliberately reproducible: that is what " +
          "makes your passwords independent of this service's survival.",
      ],
    },
    {
      heading: "Reporting a problem",
      paragraphs: [
        `Any question, complaint or report can be sent to ${IDENTITY.email}. Security issues ` +
          "go to the same address and are handled first.",
      ],
    },
  ],
};

const termsDoc: LegalDoc = {
  title: "Terms of sale",
  updated: UPDATED,
  intro: [
    TRANSLATION_NOTE,
    "These terms cover the complete plan. The free plan and password generation need neither " +
      "an account nor a payment: nothing is being sold there.",
  ],
  sections: [
    {
      heading: "1. What the service does",
      paragraphs: [
        "TheCode computes passwords from a master key only you know. Those passwords are " +
          "stored nowhere: they are recomputed each time, on your device.",
        "What is sold is **syncing** your vault between your devices, through the server. The " +
          "vault is encrypted on your device before it leaves: the service can read neither " +
          "your sites nor your logins.",
      ],
    },
    {
      heading: "2. Plans and prices",
      items: [
        "Free plan: unlimited offline generation, local vault, syncing capped in entries and " +
          "devices.",
        `Complete plan: ${price} per month, taxes included, syncing without those caps.`,
      ],
      paragraphs: [
        "Prices include tax. Any price change is announced at least one month ahead and only " +
          "applies to later periods.",
      ],
    },
    {
      heading: "3. Ordering and payment",
      paragraphs: [
        "Subscriptions are taken out from the account page on the site. Payment is handled by " +
          "Stripe Payments Europe, Ltd. No card details pass through or rest on our servers.",
        "The subscription is monthly and renews automatically until cancelled.",
      ],
    },
    {
      heading: "4. Cancellation",
      paragraphs: [
        "You can cancel at any time from the account page, without reason and without charge. " +
          "Cancellation takes effect at the end of the period already paid for.",
        "Deleting your account cancels the subscription immediately.",
        "The publisher may terminate an account in case of clearly abusive use, after notice " +
          "by email, refunding the started period pro rata.",
      ],
    },
    {
      heading: "5. Right of withdrawal",
      paragraphs: [
        "You have fourteen days from your first payment to ask for a refund, without having " +
          `to justify it, by writing to ${IDENTITY.email}.`,
        "You keep that right even though the service starts immediately at your request: we " +
          "chose not to ask you to waive it.",
      ],
    },
    {
      heading: "6. Availability",
      paragraphs: [
        "The sync service is provided with the care of a running service, without a " +
          "contractual guarantee of permanent availability. Interruptions may happen for " +
          "maintenance or incidents.",
        "An interruption never stops you using your passwords: they are computed offline, on " +
          "your device, and your vault stays there. That is a property of the design, not a " +
          "commercial promise.",
      ],
    },
    {
      heading: "7. Your responsibilities, and ours",
      paragraphs: [
        "**Your master key cannot be recovered.** The service does not know it, does not " +
          "store it, and can neither remind you of it nor reset it. Forgetting it means " +
          "losing access to the passwords it computes. Your account password, on the other " +
          "hand, can be reset: it only guards syncing.",
        "Keeping your master key and your devices up to date is yours. Protecting the " +
          "service, encrypting what travels and telling you what we keep is ours.",
        "The publisher's liability is limited to the amounts paid for the subscription over " +
          "the last twelve months, except in case of gross negligence or personal injury, and " +
          "except where mandatory law provides otherwise.",
      ],
    },
    {
      heading: "8. Personal data",
      paragraphs: [
        "How your data is handled is set out in the privacy policy. You can export your data " +
          "and delete your account at any time from the account page.",
      ],
    },
    {
      heading: "9. Changes to these terms",
      paragraphs: [
        "Any substantial change is announced by email at least one month before it takes " +
          "effect. You remain free to cancel without charge within that period.",
      ],
    },
    {
      heading: "10. Governing law and disputes",
      paragraphs: [
        "These terms are governed by French law.",
        "In case of a dispute, an amicable solution will be sought first. A consumer may then " +
          `refer the matter free of charge to the consumer ombudsman: ${f(IDENTITY.mediator)}. ` +
          "Failing agreement, the competent courts are those designated by the applicable " +
          "rules.",
      ],
    },
  ],
};

const privacyDoc: LegalDoc = {
  title: "Privacy policy",
  updated: PRIVACY_UPDATED,
  intro: [
    TRANSLATION_NOTE,
    "TheCode is a password manager that stores no passwords: they are recomputed on your " +
      "device from your master key. This page says exactly what is collected, and what is not.",
    "Without an account, nothing at all is collected: generation, the vault and autofill work " +
      "offline, without contacting any server. The account serves one optional purpose: " +
      "syncing your vault between your devices.",
  ],
  sections: [
    {
      heading: "Data controller",
      paragraphs: [
        IDENTITY.editor
          ? `${IDENTITY.editor}, ${IDENTITY.address}. Contact: ${IDENTITY.email}.`
          : `The data controller can be reached at ${IDENTITY.email}.`,
      ],
    },
    {
      heading: "What we collect, if you create an account",
      items: [
        "your email address, which identifies the account, and the date you confirmed it;",
        "your account password, never in clear: only an Argon2id hash is kept. An account " +
          "opened with Google or Apple has none until you set one;",
        "if you sign in with Google: the technical identifier Google sends us and the " +
          "associated address, verified by Google;",
        "if you sign in with Apple: the technical identifier Apple sends us and the address " +
          "Apple shares — your Apple ID address, or a private relay address if you chose to " +
          "hide yours;",
        "connected devices: the device name as the system reports it (phone model, iPhone or " +
          'Mac name, "extension", "website"), the kind of client (app or site), sign-in and ' +
          "expiry dates and whether the session is still valid. The session token is only " +
          "kept hashed;",
        "your plan, where it comes from, your subscription status and period end, and your " +
          "Stripe customer and subscription ids;",
        "the invitation, referral or lifetime codes you used, and when;",
        "links sent by email (address confirmation, address change, password reset): a hashed " +
          "token, its expiry date and, for a change, the new address requested;",
        "your vault and default settings, encrypted: the service receives opaque blocks it " +
          "cannot decrypt. Only the entries your plan allows to sync are sent; the others stay " +
          "on your device;",
        "technical logs containing your IP address, kept a few days to spot abuse and " +
          "diagnose failures.",
      ],
    },
    {
      heading: "What we cannot know",
      paragraphs: [
        "The vault and default settings are encrypted on your device (AES-256-GCM) with a key " +
          "derived from your master key, which we never have. We therefore know neither the " +
          "sites you save, nor your logins, nor your settings, nor your passwords — which are " +
          "not stored anywhere anyway.",
        "Your master key and the password that locks the vault screen never leave your " +
          "device. Biometrics (Face ID, Touch ID, fingerprint) are checked by the system: we " +
          "receive nothing from them.",
        "What the service does see, and which is worth stating rather than implying perfect " +
          "secrecy: how many entries are synced, which ones change, how often you sync, how " +
          "many devices you use and the IP addresses they connect from.",
      ],
    },
    {
      heading: "What stays on your devices",
      items: [
        "Your master key: in the keychain on iPhone, iPad and Mac, encrypted by the Keystore " +
          "on Android. In the extension it is only kept in memory for the browser session and " +
          "is erased when the browser closes. The website does not keep it.",
        "The vault, settings and vault lock (a PBKDF2 hash of the password, never the " +
          "password): in the app's private storage, or in the extension's or browser's local " +
          "storage.",
        "Autofill (Android's autofill service, the iOS and macOS credential provider): the " +
          "system tells TheCode which site or app is asking, the password is computed on the " +
          "device, and nothing is sent.",
        "The camera, on phones, is only used to read the QR code of a vault shown on another " +
          "device: no image is saved or sent.",
      ],
    },
    {
      heading: "The browser extension",
      paragraphs: ["The extension asks for the following permissions, and uses them only so:"],
      items: [
        "access to all sites and a page script: finding password fields and offering, next " +
          "to them, the password computed for the site. The page is only read around those " +
          "fields (the typed login included), and nothing from it is kept or sent;",
        "active tab: knowing the site of the open tab when you click the extension;",
        "storage: keeping the vault, settings and sync session on the device, and the master " +
          "key in memory for the browser session;",
        'identity: only for "Continue with Google". Google returns a token holding your ' +
          "identifier and address, nothing else; the extension accesses no other Google " +
          "service.",
      ],
    },
    {
      heading: "Why, and on what basis",
      items: [
        "Performance of the contract: creating and keeping your account, syncing your vault, " +
          "sending you the emails the account needs, handling your subscription.",
        "Legal obligation: keeping billing records.",
        "Legitimate interest: protecting the service against abuse, diagnosing failures.",
      ],
      paragraphs: [
        "We send no marketing email: only those the account requires (address confirmation, " +
          "address change, forgotten password).",
      ],
    },
    {
      heading: "Who else has access",
      items: [
        "Stripe Payments Europe, Ltd. — payment and invoicing. Stripe receives your email " +
          "address, your account identifier and your payment details, which we never see.",
        'Google Ireland Ltd. — only if you choose "Continue with Google".',
        'Apple Distribution International Ltd. — only if you choose "Sign in with Apple".',
        "Our email provider, through which account emails are sent: it receives your address " +
          "and the content of those emails.",
        IDENTITY.host
          ? `Our host, ${IDENTITY.host}, running the server in the European Union.`
          : "Our host, running the server in the European Union.",
      ],
      paragraphs: [
        "Your data is never sold, rented or passed on for advertising. There is no tracker, " +
          "no analytics, no crash reporting and no advertising cookie — not on the site, not " +
          "in the apps, not in the extension.",
        "Where a processor handles data outside the European Union, the transfer is covered by " +
          "the European Commission's standard contractual clauses.",
      ],
    },
    {
      heading: "Cookies and local storage",
      paragraphs: [
        "The site sets no cookies. Your vault, settings and session live in your browser's " +
          "local storage: they stay on your device and are never sent as they are.",
        'The "Continue with Google" and "Sign in with Apple" buttons load a script from ' +
          "Google or Apple, and only on the account page. Those services then apply their own " +
          "rules, cookies included.",
      ],
    },
    {
      heading: "How long",
      items: [
        "Account, vault, settings, devices and codes used: as long as the account exists. " +
          "Deletion is immediate and final.",
        "Links sent by email: valid 24 hours, 2 hours for a password reset.",
        "Device sessions: 30 days without renewal, or until you sign the device out.",
        "Database backups: seven days at most.",
        "Technical logs: a few days.",
        "Billing records: ten years, as accounting law requires.",
      ],
    },
    {
      heading: "Your rights",
      paragraphs: [
        "From the account page you can, at any time: export all of your data to a file, see " +
          "and sign out your devices, correct your address, change your password, unlink " +
          "Google or Apple and delete your account for good. Deletion also cancels the " +
          "subscription.",
        "The exported file holds your vault as we keep it, that is encrypted: only your " +
          "master key opens it.",
        "You also have the rights of access, rectification, erasure, restriction, objection " +
          "and portability under the GDPR. To exercise them other than from the site: " +
          `${IDENTITY.email}.`,
        "You may lodge a complaint with the French data protection authority (CNIL, " +
          "www.cnil.fr) if you believe your rights are not respected.",
      ],
    },
    {
      heading: "In case of a breach",
      paragraphs: [
        "Should a data breach occur, the people concerned and the supervisory authority would " +
          "be informed within the time limits set by the GDPR. Encrypting the vault on the " +
          "device is precisely what makes such a leak useless to whoever obtains it.",
      ],
    },
  ],
};

/**
 * Les conditions de vente, précédées d'un avertissement tant que rien n'est
 * vendu : publier des conditions pour une offre qui n'existe pas tromperait
 * sur ce que le service propose.
 */
export const terms = (plansOpen: boolean): LegalDoc =>
  plansOpen
    ? termsDoc
    : {
        ...termsDoc,
        intro: [
          "No paid plan is offered today: the whole service is free. These terms will apply the day subscriptions open.",
          ...(termsDoc.intro || []),
        ],
      };

export const privacy = (plansOpen: boolean): LegalDoc =>
  plansOpen
    ? privacyDoc
    : {
        ...privacyDoc,
        intro: [
          ...(privacyDoc.intro || []),
          "No payment is offered today: Stripe is not involved yet, and no data is sent to it.",
        ],
      };
