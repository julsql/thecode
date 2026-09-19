<template>
  <div class="page-wrapper">
    <header class="page-hero">
      <div class="page-hero-inner">
        <h1>{{ t("pricing_title") }}</h1>
        <p class="page-hero-sub">{{ t("pricing_lead") }}</p>
      </div>
    </header>

    <div class="content-container fadeIn">
      <!-- Tant que rien n'est vendu, la page ne doit annoncer ni prix ni
           offre : elle dit ce qui est ouvert, et c'est tout. -->
      <section v-if="!plans.plansEnforced" class="plan-card plan-card--featured open-card">
        <h2>{{ t("pricing_open_title") }}</h2>
        <p class="open-lead">{{ t("pricing_open_lead") }}</p>
        <ul class="plan-lines">
          <li>{{ t("pricing_free_generation") }}</li>
          <li>{{ withCount("pricing_pro_entries", plans.proMaxEntries) }}</li>
          <li>{{ withCount("pricing_pro_devices", plans.proMaxDevices) }}</li>
        </ul>
        <router-link class="ghost-btn primary plan-cta" :to="localePath('account')">
          {{ t("pricing_cta_free") }}
        </router-link>
      </section>

      <div v-else class="plan-grid">
        <section class="plan-card">
          <h2>{{ t("pricing_free_name") }}</h2>
          <p class="plan-price">{{ t("pricing_free_price") }}</p>
          <ul class="plan-lines">
            <li>{{ withCount("pricing_free_entries", plans.freeMaxEntries) }}</li>
            <li>{{ withCount("pricing_free_devices", plans.freeMaxDevices) }}</li>
            <li>{{ t("pricing_free_generation") }}</li>
          </ul>
          <router-link class="ghost-btn plan-cta" :to="localePath('account')">
            {{ t("pricing_cta_free") }}
          </router-link>
        </section>

        <!-- L'offre payante est mise en avant : c'est elle qui fait vivre le
             service, et la gratuite reste entiere a cote. -->
        <section class="plan-card plan-card--featured">
          <span class="plan-badge">{{ t("pricing_recommended") }}</span>
          <h2>{{ t("pricing_pro_name") }}</h2>
          <p v-if="plans.billingAvailable" class="plan-price">
            {{ formattedPrice }}<span class="plan-period">{{ t("pricing_per_month") }}</span>
          </p>
          <!-- Pas de prix tant que rien ne se vend : le déblocage se fait par
               code, et annoncer un tarif enverrait vers une impasse. -->
          <p v-else class="plan-by-code">{{ t("pricing_by_code") }}</p>
          <ul class="plan-lines">
            <li>{{ withCount("pricing_pro_entries", plans.proMaxEntries) }}</li>
            <li>{{ withCount("pricing_pro_devices", plans.proMaxDevices) }}</li>
            <li>{{ t("pricing_pro_support") }}</li>
          </ul>
          <router-link class="ghost-btn primary plan-cta" :to="localePath('account')">
            {{ plans.billingAvailable ? t("pricing_cta_pro") : t("pricing_cta_code") }}
          </router-link>
          <p v-if="plans.billingAvailable" class="hint">{{ t("pricing_cancel_note") }}</p>
        </section>
      </div>

      <p class="plan-note">{{ t("pricing_encrypted") }}</p>
      <p v-if="plans.plansEnforced && !plans.billingAvailable" class="plan-note">
        {{ t("pricing_unavailable") }}
      </p>
    </div>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "@/i18n";
import { loadService, service } from "@/service";

export default defineComponent({
  name: "Pricing",
  setup() {
    const { t, lang, localePath } = useI18n();
    const route = useRoute();

    // Le service dit ce qu'il applique ; la page n'a rien à décider.
    loadService();
    // Sauf une chose : arrivée depuis une application, elle n'affiche pas de
    // prix. Les règles des magasins interdisent qu'une app oriente vers un
    // paiement hors de leur système, et un examinateur suit les liens.
    const fromApp = computed(() => route.query.from === "app");
    const plans = computed(() =>
      fromApp.value ? { ...service.plans, billingAvailable: false } : service.plans,
    );

    const formattedPrice = computed(() =>
      new Intl.NumberFormat(lang.value === "fr" ? "fr-FR" : "en-GB", {
        style: "currency",
        currency: plans.value.currency,
        minimumFractionDigits: plans.value.priceMonthlyCents % 100 === 0 ? 0 : 2,
      }).format(plans.value.priceMonthlyCents / 100),
    );

    const withCount = (key: Parameters<typeof t>[0], count: number) =>
      t(key).replace("{n}", String(count));

    return { t, localePath, plans, formattedPrice, withCount };
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
  max-width: 760px;
  margin: 0 auto;
}

.page-hero h1 {
  font-size: clamp(2rem, 4vw, 2.8rem);
  margin: 0 0 12px;
  letter-spacing: -0.5px;
  color: #fff;
}

.page-hero-sub {
  margin: 0;
  font-size: clamp(0.95rem, 1.3vw, 1.1rem);
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.78);
}

.content-container {
  max-width: 900px;
  margin: -50px auto 0;
  padding: 0 24px 80px;
  position: relative;
  z-index: 2;
}

.plan-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 20px;
}

.plan-card {
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border: 1px solid var(--border-soft);
  border-radius: 18px;
  padding: 26px 24px;
  box-shadow: var(--shadow-soft);
}

.plan-card--featured {
  border-color: var(--c4);
  box-shadow: var(--shadow-strong);
}

.plan-badge {
  align-self: flex-start;
  margin-bottom: 10px;
  padding: 4px 12px;
  border-radius: 999px;
  background: var(--accent-gradient);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.4px;
  text-transform: uppercase;
}

.plan-card h2 {
  margin: 0 0 6px;
  font-size: 1.15rem;
}

.plan-by-code {
  margin: 0 0 16px;
  font-size: 1rem;
  font-weight: 600;
  color: var(--c4);
}

.plan-price {
  margin: 0 0 16px;
  font-size: 2rem;
  font-weight: 700;
}

.plan-period {
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--text-muted);
}

.plan-lines {
  margin: 0 0 22px;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 8px;
  font-size: 0.9rem;
  color: var(--text-muted);
}

.plan-lines li::before {
  content: "· ";
  color: var(--c4);
  font-weight: 700;
}

/* Les cartes n'ont pas la même hauteur de liste : l'action se colle en bas
   pour que les deux boutons restent alignés. */
.plan-cta {
  margin-top: auto;
  padding: 12px 18px;
  text-align: center;
  text-decoration: none;
}

/* Une seule carte quand tout est ouvert : elle occupe la largeur sans se
   retrouver étirée sur un écran large. */
.open-card {
  max-width: 460px;
  margin: 0 auto;
}

.open-lead {
  margin: 0 0 18px;
  color: var(--text-muted);
  line-height: 1.6;
}

.plan-note {
  margin: 22px 0 0;
  text-align: center;
  font-size: 0.85rem;
  color: var(--text-muted);
}
</style>
