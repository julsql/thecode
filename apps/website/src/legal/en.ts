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
  updated: UPDATED,
  intro: [
    TRANSLATION_NOTE,
    "TheCode is a password manager that stores no passwords: they are recomputed on your " +
      "device from your master key. This page says exactly what is collected, and what is not.",
    "Without an account, nothing at all is collected: generation, the vault and autofill work " +
      "offline, without contacting any server.",
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
        "your email address, which identifies the account;",
        "your account password, never in clear: only an Argon2id hash is kept;",
        "if you sign in with Google: the technical identifier Google sends us, and the " +
          "associated address;",
        "connected devices: a label you choose, sign-in and expiry dates;",
        "your plan, subscription status and Stripe customer id;",
        "your vault, encrypted: the service receives opaque blocks it cannot decrypt;",
        "technical logs containing your IP address, kept a few days to spot abuse and " +
          "diagnose failures.",
      ],
    },
    {
      heading: "What we cannot know",
      paragraphs: [
        "The vault is encrypted on your device with a key derived from your master key, which " +
          "we never have. We therefore know neither the sites you save, nor your logins, nor " +
          "your settings, nor your passwords.",
        "What the service does see, and which is worth stating rather than implying perfect " +
          "secrecy: how many entries your vault holds, which ones change, and how often you " +
          "sync.",
      ],
    },
    {
      heading: "Why, and on what basis",
      items: [
        "Performance of the contract: creating and keeping your account, syncing your vault, " +
          "handling your subscription.",
        "Legal obligation: keeping billing records.",
        "Legitimate interest: protecting the service against abuse, diagnosing failures.",
      ],
    },
    {
      heading: "Who else has access",
      items: [
        "Stripe Payments Europe, Ltd. — payment and invoicing. Stripe receives your email " +
          "address and your payment details, which we never see.",
        'Google Ireland Ltd. — only if you choose "Continue with Google".',
        IDENTITY.host
          ? `Our host, ${IDENTITY.host}, running the server in the European Union.`
          : "Our host, running the server in the European Union.",
      ],
      paragraphs: [
        "Your data is never sold, rented or passed on for advertising. There is no tracker, " +
          "no analytics and no advertising cookie.",
        "Where a processor handles data outside the European Union, the transfer is covered by " +
          "the European Commission's standard contractual clauses.",
      ],
    },
    {
      heading: "Cookies and local storage",
      paragraphs: [
        "The site sets no cookies. Your vault and your session live in your browser's local " +
          "storage: they stay on your device and are never sent as they are.",
      ],
    },
    {
      heading: "How long",
      items: [
        "Account and vault: as long as the account exists. Deletion is immediate and final.",
        "Database backups: seven days at most.",
        "Technical logs: a few days.",
        "Billing records: ten years, as accounting law requires.",
      ],
    },
    {
      heading: "Your rights",
      paragraphs: [
        "From the account page you can, at any time: export all of your data to a file, " +
          "correct your address, change your password and delete your account for good.",
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
