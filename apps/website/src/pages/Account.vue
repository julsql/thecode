<template>
  <div class="page-wrapper">
    <header class="page-hero">
      <div class="page-hero-inner">
        <h1>{{ t("acc_title") }}</h1>
        <p class="page-hero-sub">{{ t("acc_lead") }}</p>
      </div>
    </header>

    <div class="content-container fadeIn">
      <div class="account-card">
        <!-- Déconnecté : se connecter ou créer un compte, rien d'autre. -->
        <template v-if="!connected">
          <div class="tabs" role="tablist">
            <button
              type="button"
              role="tab"
              :class="{ active: mode === 'login' }"
              :aria-selected="mode === 'login'"
              @click="mode = 'login'"
            >
              {{ t("acc_tab_login") }}
            </button>
            <button
              type="button"
              role="tab"
              :class="{ active: mode === 'register' }"
              :aria-selected="mode === 'register'"
              @click="mode = 'register'"
            >
              {{ t("acc_tab_register") }}
            </button>
          </div>

          <div class="field-row">
            <input
              id="acc_email"
              v-model="email"
              type="email"
              :placeholder="t('acc_email')"
              autocomplete="username"
            />
          </div>
          <div class="field-row">
            <input
              id="acc_password"
              v-model="password"
              type="password"
              :placeholder="t('acc_password')"
              :autocomplete="mode === 'register' ? 'new-password' : 'current-password'"
            />
          </div>

          <template v-if="mode === 'register'">
            <!-- Deux saisies : une faute de frappe sur un mot de passe qu'on
                 ne relit jamais ne se découvre qu'à la connexion suivante. -->
            <div class="field-row">
              <input
                id="acc_password_confirm"
                v-model="passwordConfirm"
                type="password"
                :placeholder="t('acc_password_confirm')"
                autocomplete="new-password"
              />
            </div>
            <div class="field-row">
              <input
                id="acc_code"
                v-model="code"
                type="text"
                :placeholder="t('acc_code')"
                autocomplete="off"
              />
            </div>

            <p v-if="billingOpen" class="choose-plan">{{ t("acc_choose_plan") }}</p>
            <div v-if="billingOpen" class="plan-choice">
              <button
                type="button"
                class="plan-option"
                :class="{ active: chosenPlan === 'free' }"
                @click="chosenPlan = 'free'"
              >
                <strong>{{ t("pricing_free_name") }}</strong>
                <small>{{ t("pricing_free_price") }}</small>
              </button>
              <button
                type="button"
                class="plan-option plan-option--featured"
                :class="{ active: chosenPlan === 'pro' }"
                @click="chosenPlan = 'pro'"
              >
                <span class="plan-badge">{{ t("pricing_recommended") }}</span>
                <strong>{{ t("pricing_pro_name") }}</strong>
                <small>{{ formattedPrice }}{{ t("pricing_per_month") }}</small>
              </button>
            </div>
          </template>

          <div class="panel-actions">
            <button v-if="mode === 'login'" type="button" class="ghost-btn primary" @click="signIn">
              {{ t("acc_login_btn") }}
            </button>
            <button v-else type="button" class="ghost-btn primary" @click="createAccount">
              {{ t("acc_register_btn") }}
            </button>
            <router-link v-if="!fromApp" class="ghost-btn" :to="localePath('pricing')">
              {{ t("nav_pricing") }}
            </router-link>
          </div>

          <p v-if="mode === 'login'" class="hint">
            <button type="button" class="link-btn" @click="forgot">
              {{ t("acc_forgot") }}
            </button>
          </p>

          <!-- Le bouton Google n'apparaît que si le service l'annonce et si
               son script a pu se charger : un bouton qui ne répond pas serait
               pire que pas de bouton. -->
          <div v-show="googleReady" class="google-zone">
            <p class="separator">
              <span>{{ t("acc_or") }}</span>
            </p>
            <div ref="googleButton" class="google-button"></div>
          </div>

          <p v-if="freeSlots !== null && freeSlots > 0" class="hint">
            {{ freeSlots }} compte(s) encore disponible(s) sans code.
          </p>
        </template>

        <!-- Connecté : l'état du compte, puis ce qu'on peut en faire. -->
        <template v-else>
          <div class="account-head">
            <div>
              <p class="account-email">{{ info?.email }}</p>
              <p class="account-badges">
                <span class="badge" :class="info?.emailVerified ? 'badge--ok' : 'badge--warn'">
                  {{ info?.emailVerified ? t("acc_verified") : t("acc_unverified") }}
                </span>
                <span class="badge badge--plan">{{ planLabel }}</span>
              </p>
            </div>
            <button type="button" class="ghost-btn small" @click="signOut">
              {{ t("acc_logout") }}
            </button>
          </div>

          <p v-if="info && !info.emailVerified" class="hint">
            <button type="button" class="ghost-btn small" @click="resend">
              {{ t("acc_verify_resend") }}
            </button>
          </p>

          <dl class="usage">
            <div>
              <dt>{{ t("acc_usage_entries") }}</dt>
              <dd>
                {{ info?.entryCount
                }}<template v-if="plansOpen"> / {{ info?.maxEntries }}</template>
              </dd>
            </div>
            <div>
              <dt>{{ t("acc_usage_devices") }}</dt>
              <dd>
                {{ info?.deviceCount
                }}<template v-if="plansOpen"> / {{ info?.maxDevices }}</template>
              </dd>
            </div>
            <div v-if="renewal">
              <dt>{{ t("acc_renews") }}</dt>
              <dd>{{ renewal }}</dd>
            </div>
          </dl>

          <section v-if="billingOpen" class="panel">
            <h3 class="panel-title">{{ t("acc_plan") }}</h3>
            <p v-if="info?.hasPendingCoupon" class="hint">{{ t("acc_pending_coupon") }}</p>

            <template v-if="isPro">
              <div class="panel-actions">
                <button type="button" class="ghost-btn primary" @click="manage">
                  {{ t("acc_manage") }}
                </button>
              </div>
            </template>
            <template v-else>
              <div class="field-row">
                <input
                  id="acc_promo"
                  v-model="promoCode"
                  type="text"
                  :placeholder="t('acc_promo')"
                  autocomplete="off"
                />
              </div>
              <div class="panel-actions">
                <button type="button" class="ghost-btn primary" @click="upgrade">
                  {{ t("acc_upgrade") }}
                </button>
                <router-link v-if="!fromApp" class="ghost-btn" :to="localePath('pricing')">
                  {{ t("nav_pricing") }}
                </router-link>
              </div>
            </template>
            <p v-if="info && !info.billingAvailable" class="hint">
              {{ t("acc_billing_unavailable") }}
            </p>
          </section>

          <section class="panel">
            <h3 class="panel-title">{{ t("acc_sign_in_title") }}</h3>
            <!-- Les deux portes d'entrée du compte, côte à côte : on ne ferme
                 pas la dernière sans le savoir. -->
            <p class="account-badges">
              <span class="badge" :class="info?.hasPassword ? 'badge--ok' : 'badge--warn'">
                {{ info?.hasPassword ? t("acc_password_set_yes") : t("acc_password_set_no") }}
              </span>
              <span class="badge" :class="info?.googleLinked ? 'badge--ok' : ''">
                {{ info?.googleLinked ? t("acc_google_linked") : t("acc_google_none") }}
              </span>
            </p>
            <div v-if="info?.googleLinked" class="panel-actions unlink-actions">
              <button
                type="button"
                class="ghost-btn small"
                :disabled="!info?.hasPassword"
                @click="unlink"
              >
                {{ t("acc_google_unlink") }}
              </button>
            </div>
            <p v-if="info?.googleLinked && !info?.hasPassword" class="hint">
              {{ t("acc_google_needs_password") }}
            </p>
          </section>

          <section class="panel">
            <h3 class="panel-title">{{ t("acc_password_title") }}</h3>
            <!-- Un compte créé par Google n'a pas de mot de passe : il en pose
                 un ici, et c'est ce qui lui ouvre les applications. -->
            <p v-if="info && !info.hasPassword" class="hint">{{ t("acc_password_none") }}</p>
            <div v-if="info && info.hasPassword" class="field-row">
              <input
                id="acc_current_password"
                v-model="currentPassword"
                type="password"
                :placeholder="t('acc_password_current')"
                autocomplete="current-password"
              />
            </div>
            <div class="field-row">
              <input
                id="acc_new_password"
                v-model="newPassword"
                type="password"
                :placeholder="t('acc_password_new')"
                autocomplete="new-password"
              />
              <input
                id="acc_new_password_confirm"
                v-model="newPasswordConfirm"
                type="password"
                :placeholder="t('acc_password_confirm')"
                autocomplete="new-password"
              />
            </div>
            <div class="panel-actions">
              <button type="button" class="ghost-btn" @click="submitPassword">
                {{ info && info.hasPassword ? t("acc_password_change") : t("acc_password_set") }}
              </button>
            </div>
          </section>

          <section class="panel">
            <h3 class="panel-title">{{ t("acc_email_title") }}</h3>
            <p v-if="info && info.pendingEmail" class="hint">
              {{ t("acc_email_pending") }} {{ info.pendingEmail }}
            </p>
            <div class="field-row">
              <input
                id="acc_new_email"
                v-model="newEmail"
                type="email"
                :placeholder="t('acc_email_new')"
                autocomplete="off"
              />
              <input
                v-if="info && info.hasPassword"
                id="acc_email_password"
                v-model="emailPassword"
                type="password"
                :placeholder="t('acc_password')"
                autocomplete="current-password"
              />
            </div>
            <div class="panel-actions">
              <button type="button" class="ghost-btn" @click="submitEmail">
                {{ t("acc_email_change") }}
              </button>
            </div>
          </section>

          <section class="panel">
            <h3 class="panel-title">{{ t("acc_code_title") }}</h3>
            <p v-if="plansOpen && !billingOpen && !isPro" class="panel-lead">
              {{ t("acc_code_unlocks") }}
            </p>
            <div class="field-row">
              <input
                id="acc_redeem"
                v-model="code"
                type="text"
                :placeholder="t('acc_code')"
                autocomplete="off"
              />
              <button type="button" class="ghost-btn" @click="applyCode">
                {{ t("acc_code_apply") }}
              </button>
            </div>
          </section>

          <section class="panel">
            <h3 class="panel-title">{{ t("acc_danger_title") }}</h3>
            <p class="panel-lead">{{ t("acc_export_lead") }}</p>
            <div class="panel-actions">
              <button type="button" class="ghost-btn" @click="downloadData">
                {{ t("acc_export") }}
              </button>
            </div>

            <h3 class="panel-title danger-title">{{ t("acc_delete_title") }}</h3>
            <p class="panel-lead">{{ t("acc_delete_lead") }}</p>
            <div class="field-row">
              <input
                id="acc_delete_email"
                v-model="deleteEmail"
                type="email"
                :placeholder="t('acc_delete_confirm')"
                autocomplete="off"
              />
              <input
                v-if="info && info.hasPassword"
                id="acc_delete_password"
                v-model="deletePassword"
                type="password"
                :placeholder="t('acc_password')"
                autocomplete="current-password"
              />
            </div>
            <div class="panel-actions">
              <button
                type="button"
                class="ghost-btn danger"
                :disabled="deleteEmail !== info?.email"
                @click="removeAccount"
              >
                {{ t("acc_delete_btn") }}
              </button>
            </div>
          </section>

          <section class="panel">
            <h3 class="panel-title">{{ t("acc_devices_title") }}</h3>
            <p v-if="devices.length === 0" class="hint">{{ t("acc_device_none") }}</p>
            <ul v-else class="device-list">
              <li v-for="device in devices" :key="device.id">
                <span class="device-name">{{ device.label }}</span>
                <span class="device-date">
                  {{ t("acc_device_since") }} {{ formatDate(device.createdAt) }}
                </span>
                <button type="button" class="ghost-btn small" @click="disconnect(device.id)">
                  {{ t("acc_device_disconnect") }}
                </button>
              </li>
            </ul>
            <p class="hint">{{ t("acc_sync_hint") }}</p>
          </section>
        </template>

        <p v-if="message" class="hint account-message">{{ message }}</p>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "@/i18n";
import {
  changeEmail,
  changePassword,
  deleteAccount,
  exportAccount,
  fetchAccount,
  fetchDevices,
  fetchPlans,
  forgotPassword,
  openPortal,
  redeemCode,
  resendVerification,
  revokeDevice,
  startCheckout,
  unlinkGoogle,
  type AccountInfo,
  type Device,
} from "@/account";
import { renderGoogleButton } from "@/google";
import { loadService, service } from "@/service";
import {
  clearSession,
  DEFAULT_ENDPOINT,
  googleSignIn,
  loadSession,
  login,
  register,
  registrationState,
  saveSession,
  SyncError,
} from "@/sync";

export default defineComponent({
  name: "Account",
  setup() {
    const { t, lang, localePath } = useI18n();
    const route = useRoute();

    const connected = ref(Boolean(loadSession()));
    const mode = ref<"login" | "register">("login");
    const email = ref("");
    const password = ref("");
    const passwordConfirm = ref("");
    const code = ref("");
    const promoCode = ref("");
    // L'offre payante est proposée par défaut : c'est elle qui fait vivre le
    // service, et refuser prend un clic, comme l'accepter.
    const chosenPlan = ref<"free" | "pro">("pro");
    const message = ref("");
    const info = ref<AccountInfo | null>(null);
    const devices = ref<Device[]>([]);
    const freeSlots = ref<number | null>(null);
    const currentPassword = ref("");
    const newPassword = ref("");
    const newPasswordConfirm = ref("");
    const newEmail = ref("");
    const emailPassword = ref("");
    const deleteEmail = ref("");
    const deletePassword = ref("");
    const googleButton = ref<HTMLElement | null>(null);
    const googleReady = ref(false);
    const priceCents = ref(200);
    const currency = ref("EUR");

    const isPro = computed(() => info.value?.plan === "pro");
    // Les offres s'appliquent-elles ? Le service seul le sait.
    loadService();
    const plansOpen = computed(() => service.plans.plansEnforced);
    /**
     * Arrivé depuis une application ?
     *
     * Les règles des magasins interdisent qu'une app oriente vers un paiement
     * hors de leur système, et un examinateur suit les liens. La page d'arrivée
     * ne montre donc ni prix ni abonnement : c'est un formulaire de création de
     * compte, rien d'autre.
     *
     * Non mémorisé : quelqu'un qui navigue ensuite sur le site de son plein gré
     * n'a pas à rester bridé.
     */
    const fromApp = computed(() => route.query.from === "app");

    // Peut-on payer ? Autre question : aujourd'hui le déblocage passe par un
    // code, et proposer un abonnement mènerait à une impasse.
    const billingOpen = computed(() => service.plans.billingAvailable && !fromApp.value);

    const planLabel = computed(() => {
      if (info.value?.planSource === "lifetime") return t("acc_plan_lifetime");
      // Annoncer « offre complète » à quelqu'un qui n'a rien pris, parce que
      // tout est ouvert, sonnerait comme une facture à venir.
      if (!plansOpen.value) return t("acc_plan_open");
      return isPro.value ? t("acc_plan_pro") : t("acc_plan_free");
    });

    const locale = computed(() => (lang.value === "fr" ? "fr-FR" : "en-GB"));

    const formattedPrice = computed(() =>
      new Intl.NumberFormat(locale.value, {
        style: "currency",
        currency: currency.value,
        minimumFractionDigits: priceCents.value % 100 === 0 ? 0 : 2,
      }).format(priceCents.value / 100),
    );

    const renewal = computed(() =>
      info.value?.currentPeriodEnd ? formatDate(info.value.currentPeriodEnd) : "",
    );

    function formatDate(value: string): string {
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString(locale.value);
    }

    /** Le chemin de retour après Stripe, langue comprise. */
    const returnPath = () => `/${lang.value}/account`;

    async function refresh() {
      const session = loadSession();
      if (!session) {
        connected.value = false;
        return;
      }
      try {
        info.value = await fetchAccount(session);
        devices.value = await fetchDevices(session);
        connected.value = true;
      } catch (e) {
        // Un jeton périmé ne doit pas laisser la page dans un état où elle
        // prétend être connectée sans rien pouvoir faire.
        if (e instanceof SyncError && e.message.startsWith("401")) {
          clearSession();
          connected.value = false;
          return;
        }
        message.value = (e as Error).message;
      }
    }

    onMounted(async () => {
      if (route.query.checkout === "success") message.value = t("acc_checkout_success");
      if (route.query.checkout === "cancel") message.value = t("acc_checkout_cancel");

      try {
        const plans = await fetchPlans(DEFAULT_ENDPOINT);
        priceCents.value = plans.priceMonthlyCents;
        currency.value = plans.currency;
      } catch {
        // Le prix affiché reste celui par défaut : la page doit fonctionner
        // même si le service ne répond pas.
      }

      try {
        const state = await registrationState(DEFAULT_ENDPOINT);
        freeSlots.value = state.freeSlots;
        if (state.googleClientId && googleButton.value) {
          googleReady.value = await renderGoogleButton(
            googleButton.value,
            state.googleClientId,
            continueWithGoogle,
            lang.value,
          );
        }
      } catch {
        freeSlots.value = null;
      }

      await refresh();
    });

    function checkCredentials(withConfirmation: boolean): boolean {
      if (!email.value || !password.value) {
        message.value = t("acc_fill");
        return false;
      }
      if (withConfirmation && password.value.length < 12) {
        message.value = t("acc_password_short");
        return false;
      }
      if (withConfirmation && password.value !== passwordConfirm.value) {
        message.value = t("acc_password_mismatch");
        return false;
      }
      return true;
    }

    /**
     * Traduit un refus de connexion dû à la limite d'appareils. 402 : l'offre
     * gratuite, que débloquer lève ; 403 : le plafond de l'offre complète.
     * `closed403` dit si un 403 peut venir d'autre chose — les inscriptions
     * fermées, pour une connexion Google qui crée le compte.
     */
    function signInError(e: unknown, closed403 = false): string {
      if (e instanceof SyncError && e.status === 402) {
        return t("acc_device_limit_free").replace("{n}", String(service.plans.freeMaxDevices));
      }
      if (e instanceof SyncError && e.status === 403 && !closed403) {
        return t("acc_device_limit_pro").replace("{n}", String(service.plans.proMaxDevices));
      }
      return (e as Error).message;
    }

    async function signIn() {
      if (!checkCredentials(false)) return;
      message.value = t("acc_connecting");
      try {
        saveSession(await login(DEFAULT_ENDPOINT, email.value, password.value));
        password.value = "";
        message.value = t("acc_connected");
        await refresh();
      } catch (e) {
        message.value = signInError(e);
      }
    }

    async function createAccount() {
      if (!checkCredentials(true)) return;
      message.value = t("acc_creating");
      try {
        saveSession(
          await register(DEFAULT_ENDPOINT, email.value, password.value, code.value, lang.value),
        );
        password.value = "";
        passwordConfirm.value = "";
        code.value = "";
        message.value = t("acc_created");
        await refresh();

        // L'offre choisie à l'inscription mène directement au paiement : la
        // choisir puis devoir la rechoisir ailleurs serait un pas de plus pour
        // rien.
        if (billingOpen.value && chosenPlan.value === "pro" && info.value?.plan !== "pro") {
          await upgrade();
        }
      } catch (e) {
        message.value = (e as Error).message;
      }
    }

    async function continueWithGoogle(idToken: string) {
      message.value = t("acc_connecting");
      try {
        saveSession(await googleSignIn(DEFAULT_ENDPOINT, idToken, code.value, lang.value));
        code.value = "";
        message.value = t("acc_connected");
        await refresh();
      } catch (e) {
        message.value = signInError(e, true);
      }
    }

    async function forgot() {
      if (!email.value) {
        message.value = t("acc_fill");
        return;
      }
      try {
        await forgotPassword(DEFAULT_ENDPOINT, email.value, lang.value);
      } catch {
        // Le service peut être injoignable ; la réponse reste la même, elle ne
        // doit rien dire de l'existence du compte.
      }
      message.value = t("acc_forgot_sent");
    }

    async function submitPassword() {
      const session = loadSession();
      if (!session) return;
      if (newPassword.value.length < 12) {
        message.value = t("acc_password_short");
        return;
      }
      if (newPassword.value !== newPasswordConfirm.value) {
        message.value = t("acc_password_mismatch");
        return;
      }
      try {
        await changePassword(session, currentPassword.value, newPassword.value);
        currentPassword.value = "";
        newPassword.value = "";
        newPasswordConfirm.value = "";
        message.value = t("acc_password_changed");
        await refresh();
      } catch (e) {
        message.value = (e as Error).message;
      }
    }

    async function submitEmail() {
      const session = loadSession();
      if (!session || !newEmail.value) {
        message.value = t("acc_fill");
        return;
      }
      try {
        await changeEmail(session, newEmail.value, emailPassword.value, lang.value);
        newEmail.value = "";
        emailPassword.value = "";
        message.value = t("acc_email_sent");
        await refresh();
      } catch (e) {
        message.value = (e as Error).message;
      }
    }

    async function unlink() {
      const session = loadSession();
      if (!session) return;
      try {
        await unlinkGoogle(session);
        message.value = t("acc_google_unlinked");
        await refresh();
      } catch (e) {
        message.value = (e as Error).message;
      }
    }

    async function downloadData() {
      const session = loadSession();
      if (!session) return;
      try {
        const data = await exportAccount(session);
        // Fabriqué et libéré dans le navigateur : le fichier ne passe par
        // aucun serveur, et l'URL temporaire ne survit pas au clic.
        const url = URL.createObjectURL(
          new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
        );
        const link = document.createElement("a");
        link.href = url;
        link.download = "thecode-compte.json";
        link.click();
        URL.revokeObjectURL(url);
      } catch (e) {
        message.value = (e as Error).message;
      }
    }

    async function removeAccount() {
      const session = loadSession();
      if (!session || !info.value) return;
      if (deleteEmail.value !== info.value.email) {
        message.value = t("acc_fill");
        return;
      }
      try {
        await deleteAccount(session, deletePassword.value, deleteEmail.value);
        // Le carnet local n'est pas touché : les mots de passe se calculent
        // depuis la clef maîtresse, la synchronisation n'était qu'un service.
        clearSession();
        connected.value = false;
        info.value = null;
        devices.value = [];
        deleteEmail.value = "";
        deletePassword.value = "";
        message.value = t("acc_delete_done");
      } catch (e) {
        message.value = (e as Error).message;
      }
    }

    function signOut() {
      clearSession();
      connected.value = false;
      info.value = null;
      devices.value = [];
      message.value = "";
    }

    async function upgrade() {
      const session = loadSession();
      if (!session) return;
      try {
        const url = await startCheckout(session, {
          promoCode: promoCode.value,
          returnPath: returnPath(),
        });
        window.location.href = url;
      } catch (e) {
        message.value = (e as Error).message;
      }
    }

    async function manage() {
      const session = loadSession();
      if (!session) return;
      try {
        window.location.href = await openPortal(session, returnPath());
      } catch (e) {
        message.value = (e as Error).message;
      }
    }

    async function applyCode() {
      const session = loadSession();
      if (!session || !code.value) return;
      try {
        message.value = await redeemCode(session, code.value);
        code.value = "";
        await refresh();
      } catch (e) {
        message.value = (e as Error).message;
      }
    }

    async function resend() {
      const session = loadSession();
      if (!session) return;
      try {
        await resendVerification(session, lang.value);
        message.value = t("acc_verify_sent");
      } catch (e) {
        message.value = (e as Error).message;
      }
    }

    async function disconnect(id: string) {
      const session = loadSession();
      if (!session) return;
      try {
        await revokeDevice(session, id);
        await refresh();
      } catch (e) {
        message.value = (e as Error).message;
      }
    }

    return {
      t,
      localePath,
      connected,
      mode,
      email,
      password,
      passwordConfirm,
      code,
      promoCode,
      chosenPlan,
      message,
      info,
      devices,
      freeSlots,
      currentPassword,
      newPassword,
      newPasswordConfirm,
      newEmail,
      emailPassword,
      deleteEmail,
      deletePassword,
      googleButton,
      googleReady,
      isPro,
      plansOpen,
      billingOpen,
      fromApp,
      planLabel,
      formattedPrice,
      renewal,
      formatDate,
      signIn,
      createAccount,
      forgot,
      submitPassword,
      submitEmail,
      unlink,
      downloadData,
      removeAccount,
      signOut,
      upgrade,
      manage,
      applyCode,
      resend,
      disconnect,
    };
  },
});
</script>

<style scoped>
.page-wrapper {
  display: flex;
  flex-direction: column;
}

.page-hero {
  position: relative;
  background: var(--hero-gradient);
  padding: 70px 24px 90px;
  text-align: center;
  overflow: hidden;
}

.page-hero::after {
  content: "";
  position: absolute;
  inset: auto 0 -1px 0;
  height: 80px;
  background: linear-gradient(to bottom, transparent, var(--c1));
  pointer-events: none;
}

.page-hero-inner {
  position: relative;
  z-index: 1;
  max-width: 720px;
  margin: 0 auto;
}

.page-hero h1 {
  font-size: clamp(2rem, 4vw, 2.8rem);
  margin: 0 0 12px;
  color: #fff;
}

.page-hero-sub {
  margin: 0;
  font-size: clamp(0.95rem, 1.3vw, 1.05rem);
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.78);
}

.content-container {
  max-width: 640px;
  margin: -50px auto 0;
  padding: 0 24px 80px;
  position: relative;
  z-index: 2;
}

.account-card {
  background: var(--surface);
  border: 1px solid var(--border-soft);
  border-radius: 18px;
  padding: 26px 24px;
  box-shadow: var(--shadow-soft);
}

.tabs {
  display: flex;
  gap: 6px;
  margin-bottom: 20px;
  padding: 4px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.05);
}

.tabs button {
  flex: 1;
  padding: 8px 14px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--text-muted);
  font-weight: 600;
  font-size: 0.88rem;
  cursor: pointer;
}

.tabs button.active {
  background: var(--accent-gradient);
  color: var(--text);
}

.choose-plan {
  margin: 4px 0 10px;
  font-size: 0.85rem;
  color: var(--text-muted);
}

.plan-choice {
  display: flex;
  gap: 10px;
  margin-bottom: 18px;
}

.plan-option {
  position: relative;
  flex: 1 1 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 14px 16px;
  border-radius: 14px;
  border: 1px solid var(--border-soft);
  background: rgba(255, 255, 255, 0.04);
  color: var(--text);
  cursor: pointer;
  text-align: left;
}

.plan-option small {
  color: var(--text-muted);
  font-size: 0.8rem;
}

/* L'offre choisie se voit d'un coup d'œil : deux cartes qui se ressemblent
   laisseraient douter de ce qu'on est en train de prendre. */
.plan-option.active {
  border-color: var(--c4);
  background: rgb(var(--accent-rgb) / 0.18);
}

.plan-option--featured {
  padding-top: 26px;
}

.plan-badge {
  position: absolute;
  top: 8px;
  left: 16px;
  padding: 2px 10px;
  border-radius: 999px;
  background: var(--accent-gradient);
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.4px;
  text-transform: uppercase;
}

.account-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.account-email {
  margin: 0 0 8px;
  font-weight: 700;
}

.account-badges {
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.badge {
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 600;
  border: 1px solid var(--border-soft);
}

.badge--ok {
  border-color: rgba(120, 220, 160, 0.4);
  color: #8fe3b4;
}

.badge--warn {
  border-color: rgba(240, 190, 120, 0.4);
  color: #f0be78;
}

.badge--plan {
  background: var(--accent-gradient);
  border: 0;
}

.usage {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
  margin: 18px 0 0;
}

.usage dt {
  font-size: 0.78rem;
  color: var(--text-muted);
}

.usage dd {
  margin: 2px 0 0;
  font-size: 1.05rem;
  font-weight: 700;
}

.device-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 8px;
}

.device-list li {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--border-soft);
}

.device-name {
  font-weight: 600;
  font-size: 0.9rem;
}

.device-date {
  flex: 1;
  font-size: 0.78rem;
  color: var(--text-muted);
}

/* Un lien déguisé en bouton : « mot de passe oublié » est une action, pas une
   navigation, mais il n'a pas le poids d'un bouton. */
.link-btn {
  padding: 0;
  border: 0;
  background: none;
  color: var(--c4);
  font: inherit;
  cursor: pointer;
  text-decoration: underline;
}

.google-zone {
  margin-top: 18px;
}

.separator {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0 0 14px;
  font-size: 0.78rem;
  color: var(--text-muted);
}

.separator::before,
.separator::after {
  content: "";
  flex: 1;
  height: 1px;
  background: var(--border-soft);
}

.google-button {
  display: flex;
  justify-content: center;
}

/* Une action qui ne se rattrape pas : elle ne doit pas ressembler aux autres. */
.ghost-btn.danger {
  border-color: rgba(230, 120, 120, 0.5);
  color: #f0a0a0;
}

.ghost-btn.danger:hover:not(:disabled) {
  background: rgba(230, 120, 120, 0.15);
  border-color: #e67878;
}

.ghost-btn.danger:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Le déliement se range sous les deux pastilles qu'il concerne. */
.unlink-actions {
  margin-top: 12px;
}

.danger-title {
  margin-top: 26px;
}

.account-message {
  margin-top: 18px;
}

@media (max-width: 520px) {
  .plan-choice {
    flex-direction: column;
  }

  .device-list li {
    flex-wrap: wrap;
  }
}
</style>
