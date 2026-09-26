/**
 * Compte, offres et abonnement.
 *
 * Le site est le seul endroit où l'on gère son compte : les applications et
 * les extensions se connectent et synchronisent, rien de plus. Un écran de
 * facturation par plateforme multiplierait les endroits où une erreur de
 * droits peut se glisser, pour un geste qu'on fait deux fois par an.
 *
 * Rien de sensible ne transite ici : le carnet est chiffré ailleurs, et les
 * moyens de paiement restent chez Stripe.
 */

import { authorized, loadSession, request, saveSession, type Session } from "@/sync";

/** Ce que la page du compte affiche. */
export interface AccountInfo {
  email: string;
  plan: string;
  subscriptionStatus: string;
  entryCount: number;
  maxEntries: number;
  deviceCount: number;
  maxDevices: number;
  emailVerified: boolean;
  planSource: string;
  currentPeriodEnd: string | null;
  hasPendingCoupon: boolean;
  billingAvailable: boolean;
  plansEnforced: boolean;
  /** Faux pour un compte créé par Google qui n'a pas posé de mot de passe. */
  hasPassword: boolean;
  googleLinked: boolean;
  /** Adresse en attente de confirmation, vide s'il n'y en a pas. */
  pendingEmail: string;
}

/** Les tarifs, lisibles sans compte. */
export interface PlanInfo {
  /** Faux : tout est ouvert, rien n'est vendu. */
  plansEnforced: boolean;
  priceMonthlyCents: number;
  currency: string;
  billingAvailable: boolean;
  freeMaxEntries: number;
  freeMaxDevices: number;
  proMaxEntries: number;
  proMaxDevices: number;
}

export interface Device {
  id: string;
  label: string;
  /** Session du site : hors du plafond d'appareils, mais déconnectable. */
  web: boolean;
  createdAt: string;
  expiresAt: string;
}

export async function fetchAccount(session: Session): Promise<AccountInfo> {
  const body = await authorized(session, (token) =>
    request(`${session.endpoint}/v1/auth/me`, { token }),
  );
  return {
    email: body.email,
    plan: body.plan,
    subscriptionStatus: body.subscription_status,
    entryCount: body.entry_count,
    maxEntries: body.max_entries,
    deviceCount: body.device_count,
    maxDevices: body.max_devices,
    emailVerified: body.email_verified,
    planSource: body.plan_source,
    currentPeriodEnd: body.current_period_end ?? null,
    hasPendingCoupon: body.has_pending_coupon,
    billingAvailable: body.billing_available,
    plansEnforced: Boolean(body.plans_enforced),
    hasPassword: body.has_password ?? true,
    googleLinked: Boolean(body.google_linked),
    pendingEmail: body.pending_email ?? "",
  };
}

export async function fetchPlans(endpoint: string): Promise<PlanInfo> {
  const body = await request(`${endpoint}/v1/billing/plans`);
  return {
    plansEnforced: Boolean(body.plans_enforced),
    priceMonthlyCents: body.price_monthly_cents,
    currency: body.currency,
    billingAvailable: body.billing_available,
    freeMaxEntries: body.free_max_entries,
    freeMaxDevices: body.free_max_devices,
    proMaxEntries: body.pro_max_entries,
    proMaxDevices: body.pro_max_devices,
  };
}

export async function fetchDevices(session: Session): Promise<Device[]> {
  const body = (await authorized(session, (token) =>
    request(`${session.endpoint}/v1/account/devices`, { token }),
  )) as Array<{
    id: string;
    label: string;
    client?: string;
    created_at: string;
    expires_at: string;
  }>;

  return body.map((row) => ({
    id: row.id,
    label: row.label,
    web: row.client === "web",
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  }));
}

export async function revokeDevice(session: Session, id: string): Promise<void> {
  await authorized(session, (token) =>
    request(`${session.endpoint}/v1/account/devices/${id}`, { token, method: "DELETE" }),
  );
}

/** Applique un code de parrainage ou un code à vie au compte connecté. */
export async function redeemCode(session: Session, code: string): Promise<string> {
  const body = await authorized(session, (token) =>
    request(`${session.endpoint}/v1/account/code`, { token, payload: { code } }),
  );
  return body.message as string;
}

/**
 * Ouvre le paiement et rend l'adresse où envoyer le navigateur.
 *
 * `returnPath` reste un chemin interne : le serveur refuse tout le reste, un
 * retour de paiement qui atterrit ailleurs que sur le site serait le meilleur
 * moment pour faire saisir des identifiants.
 */
export async function startCheckout(
  session: Session,
  options: { promoCode?: string; returnPath: string },
): Promise<string> {
  const body = await authorized(session, (token) =>
    request(`${session.endpoint}/v1/billing/checkout`, {
      token,
      payload: { promo_code: options.promoCode ?? "", return_path: options.returnPath },
    }),
  );
  return body.url as string;
}

/** Portail Stripe : changement d'offre, moyen de paiement, résiliation. */
export async function openPortal(session: Session, returnPath: string): Promise<string> {
  const body = await authorized(session, (token) =>
    request(`${session.endpoint}/v1/billing/portal`, {
      token,
      payload: { return_path: returnPath },
    }),
  );
  return body.url as string;
}

/** Confirme une adresse depuis le lien reçu : pas de session nécessaire. */
export async function verifyEmail(endpoint: string, token: string): Promise<void> {
  await request(`${endpoint}/v1/auth/verify`, { payload: { token } });
}

export async function resendVerification(session: Session, lang: string): Promise<void> {
  await authorized(session, (token) =>
    request(`${session.endpoint}/v1/auth/verify/resend`, { token, payload: { lang } }),
  );
}

/** Vrai quand l'offre donne droit au compteur et aux plafonds larges. */
export function isPaidPlan(plan: string | undefined): boolean {
  return plan === "pro";
}

/**
 * Relit l'offre du compte et la garde avec la session.
 *
 * Silencieux en cas d'échec : la génération marche hors ligne, et un service
 * injoignable ne doit pas empêcher d'ouvrir son carnet. L'offre connue reste
 * alors celle de la dernière fois.
 */
export async function refreshPlan(session: Session): Promise<string | undefined> {
  try {
    const info = await fetchAccount(session);
    const current = loadSession();
    if (current) saveSession({ ...current, plan: info.plan });
    return info.plan;
  } catch {
    return loadSession()?.plan;
  }
}

/**
 * Change le mot de passe du compte.
 *
 * `currentPassword` est vide pour un compte créé par Google, qui n'en a pas
 * encore : en exiger un lui interdirait d'en poser un, donc lui interdirait
 * les applications, qui ne savent se connecter qu'ainsi.
 */
export async function changePassword(
  session: Session,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  await authorized(session, (token) =>
    request(`${session.endpoint}/v1/account/password`, {
      token,
      payload: { current_password: currentPassword, new_password: newPassword },
    }),
  );
}

/** Demande un changement d'adresse : rien ne bouge avant le lien reçu. */
export async function changeEmail(
  session: Session,
  newEmail: string,
  password: string,
  lang: string,
): Promise<void> {
  await authorized(session, (token) =>
    request(`${session.endpoint}/v1/account/email`, {
      token,
      payload: { new_email: newEmail, password, lang },
    }),
  );
}

/** Demande un lien de réinitialisation. Pas de session : on l'a perdue. */
export async function forgotPassword(endpoint: string, email: string, lang: string): Promise<void> {
  await request(`${endpoint}/v1/auth/password/forgot`, { payload: { email, lang } });
}

/** Repose un mot de passe depuis le lien reçu, et ouvre une session. */
export async function resetPassword(
  endpoint: string,
  token: string,
  password: string,
): Promise<Session> {
  const body = await request(`${endpoint}/v1/auth/password/reset`, {
    payload: { token, password },
  });
  return {
    endpoint,
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
  };
}

/**
 * Télécharge tout ce que le service garde du compte.
 *
 * Le fichier est fabriqué dans le navigateur à partir de la réponse : rien
 * n'est déposé quelque part au passage.
 */
export async function exportAccount(session: Session): Promise<unknown> {
  return authorized(session, (token) =>
    request(`${session.endpoint}/v1/account/export`, { token }),
  );
}

/**
 * Efface le compte, son carnet et ses sessions.
 *
 * L'adresse est recopiée et le mot de passe demandé : l'un dit que c'est bien
 * vous, l'autre que vous saviez ce que vous faisiez.
 */
export async function deleteAccount(
  session: Session,
  password: string,
  confirmEmail: string,
): Promise<void> {
  await authorized(session, (token) =>
    request(`${session.endpoint}/v1/account`, {
      token,
      method: "DELETE",
      payload: { password, confirm_email: confirmEmail },
    }),
  );
}

/**
 * Détache le compte Google.
 *
 * Le service refuse tant qu'aucun mot de passe n'est défini : ce serait
 * fermer la seule porte d'entrée du compte.
 */
export async function unlinkGoogle(session: Session): Promise<void> {
  await authorized(session, (token) =>
    request(`${session.endpoint}/v1/account/google`, { token, method: "DELETE" }),
  );
}
