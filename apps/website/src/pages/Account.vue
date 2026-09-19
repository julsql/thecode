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

            <p class="choose-plan">{{ t("acc_choose_plan") }}</p>
            <div class="plan-choice">
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
            <router-link class="ghost-btn" :to="localePath('pricing')">
              {{ t("nav_pricing") }}
            </router-link>
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
              <dd>{{ info?.entryCount }} / {{ info?.maxEntries }}</dd>
            </div>
            <div>
              <dt>{{ t("acc_usage_devices") }}</dt>
              <dd>{{ info?.deviceCount }} / {{ info?.maxDevices }}</dd>
            </div>
            <div v-if="renewal">
              <dt>{{ t("acc_renews") }}</dt>
              <dd>{{ renewal }}</dd>
            </div>
          </dl>

          <section class="panel">
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
                <router-link class="ghost-btn" :to="localePath('pricing')">
                  {{ t("nav_pricing") }}
                </router-link>
              </div>
            </template>
            <p v-if="info && !info.billingAvailable" class="hint">
              {{ t("acc_billing_unavailable") }}
            </p>
          </section>

          <section class="panel">
            <h3 class="panel-title">{{ t("acc_code_title") }}</h3>
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
  fetchAccount,
  fetchDevices,
  fetchPlans,
  openPortal,
  redeemCode,
  resendVerification,
  revokeDevice,
  startCheckout,
  type AccountInfo,
  type Device,
} from "@/account";
import {
  clearSession,
  DEFAULT_ENDPOINT,
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
    const priceCents = ref(200);
    const currency = ref("EUR");

    const isPro = computed(() => info.value?.plan === "pro");

    const planLabel = computed(() => {
      if (info.value?.planSource === "lifetime") return t("acc_plan_lifetime");
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

    async function signIn() {
      if (!checkCredentials(false)) return;
      message.value = t("acc_connecting");
      try {
        saveSession(await login(DEFAULT_ENDPOINT, email.value, password.value));
        password.value = "";
        message.value = t("acc_connected");
        await refresh();
      } catch (e) {
        message.value = (e as Error).message;
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
        if (chosenPlan.value === "pro" && info.value?.plan !== "pro") await upgrade();
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
      isPro,
      planLabel,
      formattedPrice,
      renewal,
      formatDate,
      signIn,
      createAccount,
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
  background: rgba(166, 77, 121, 0.18);
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
