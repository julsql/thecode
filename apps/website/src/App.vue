<template>
  <div class="app">
    <!-- HEADER -->
    <header class="site-header" :class="{ 'is-open': isOpen }">
      <div class="container header-inner">
        <router-link :to="localePath('')" class="brand" @click="closeMenu">
          <img :src="Logo" alt="TheCode" class="brand-logo" />
          <span class="brand-title">TheCode</span>
        </router-link>

        <!-- Le compte se gere uniquement sur le site : il lui faut une porte
             visible depuis n'importe quelle page, pas un lien enfoui dans le
             generateur. -->
        <router-link
          :to="localePath('account')"
          class="account-link"
          active-class="is-active"
          :title="t('nav_account')"
          :aria-label="t('nav_account')"
          @click="closeMenu"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <circle cx="12" cy="8" r="3.4" />
            <path d="M4.5 19.5c0-3.6 3.4-5.6 7.5-5.6s7.5 2 7.5 5.6" />
          </svg>
        </router-link>

        <nav aria-label="primary" class="primary-nav">
          <router-link
            :to="localePath('')"
            class="nav-link"
            exact-active-class="is-active"
            @click="closeMenu"
          >
            {{ t("nav_home") }}
          </router-link>
          <router-link
            :to="localePath('about')"
            class="nav-link"
            active-class="is-active"
            @click="closeMenu"
          >
            {{ t("nav_about") }}
          </router-link>
          <router-link
            :to="localePath('generate')"
            class="nav-link"
            active-class="is-active"
            @click="closeMenu"
          >
            {{ t("nav_generator") }}
          </router-link>
          <router-link
            :to="localePath('vault')"
            class="nav-link"
            active-class="is-active"
            @click="closeMenu"
          >
            {{ t("nav_vault") }}
          </router-link>
          <router-link
            :to="localePath('tutorial')"
            class="nav-link"
            active-class="is-active"
            @click="closeMenu"
          >
            {{ t("nav_tutorial") }}
          </router-link>
          <router-link
            :to="localePath('pricing')"
            class="nav-link"
            active-class="is-active"
            @click="closeMenu"
          >
            {{ t("nav_pricing") }}
          </router-link>
          <router-link
            :to="localePath('contact')"
            class="nav-link"
            active-class="is-active"
            @click="closeMenu"
          >
            {{ t("nav_contact") }}
          </router-link>
        </nav>

        <div class="header-actions">
          <div class="lang-switch" role="group" :aria-label="t('lang_switch_label')">
            <button
              type="button"
              class="lang-btn"
              :class="{ 'is-active': lang === 'en' }"
              :aria-pressed="lang === 'en'"
              @click="switchLang('en')"
            >
              EN
            </button>
            <button
              type="button"
              class="lang-btn"
              :class="{ 'is-active': lang === 'fr' }"
              :aria-pressed="lang === 'fr'"
              @click="switchLang('fr')"
            >
              FR
            </button>
          </div>

          <button
            type="button"
            class="hamburger"
            :class="{ 'is-active': isOpen }"
            :aria-label="isOpen ? 'Close menu' : 'Open menu'"
            :aria-expanded="isOpen"
            @click="toggleMenu"
          >
            <span></span>
            <span></span>
            <span></span>
          </button>
        </div>
      </div>

      <!-- MOBILE PANEL -->
      <transition name="panel-fade">
        <nav v-if="isOpen" class="mobile-panel" aria-label="mobile">
          <router-link
            :to="localePath('')"
            class="mobile-link"
            exact-active-class="is-active"
            @click="closeMenu"
          >
            {{ t("nav_home") }}
          </router-link>
          <router-link
            :to="localePath('about')"
            class="mobile-link"
            active-class="is-active"
            @click="closeMenu"
          >
            {{ t("nav_about") }}
          </router-link>
          <router-link
            :to="localePath('generate')"
            class="mobile-link"
            active-class="is-active"
            @click="closeMenu"
          >
            {{ t("nav_generator") }}
          </router-link>
          <router-link
            :to="localePath('vault')"
            class="mobile-link"
            active-class="is-active"
            @click="closeMenu"
          >
            {{ t("nav_vault") }}
          </router-link>
          <router-link
            :to="localePath('tutorial')"
            class="mobile-link"
            active-class="is-active"
            @click="closeMenu"
          >
            {{ t("nav_tutorial") }}
          </router-link>
          <router-link
            :to="localePath('pricing')"
            class="mobile-link"
            active-class="is-active"
            @click="closeMenu"
          >
            {{ t("nav_pricing") }}
          </router-link>
          <router-link
            :to="localePath('contact')"
            class="mobile-link"
            active-class="is-active"
            @click="closeMenu"
          >
            {{ t("nav_contact") }}
          </router-link>
          <router-link
            :to="localePath('account')"
            class="mobile-link"
            active-class="is-active"
            @click="closeMenu"
          >
            {{ t("nav_account") }}
          </router-link>
        </nav>
      </transition>
    </header>

    <!-- MAIN CONTENT -->
    <main class="main">
      <router-view />
    </main>

    <!-- FOOTER -->
    <footer class="site-footer">
      <div class="footer-inner container">
        <div class="footer-grid">
          <div class="footer-col footer-brand-col">
            <router-link :to="localePath('')" class="footer-brand">
              <img :src="Logo" alt="TheCode" class="footer-logo" />
              <span>TheCode</span>
            </router-link>
            <p class="footer-tag">{{ t("footer_tagline") }}</p>
          </div>

          <div class="footer-col">
            <h4>{{ t("footer_links_product") }}</h4>
            <router-link :to="localePath('')">{{ t("nav_home") }}</router-link>
            <router-link :to="localePath('about')">{{ t("nav_about") }}</router-link>
            <router-link :to="localePath('generate')">{{ t("nav_generator") }}</router-link>
            <router-link :to="localePath('vault')">{{ t("nav_vault") }}</router-link>
            <router-link :to="localePath('pricing')">{{ t("nav_pricing") }}</router-link>
            <router-link :to="localePath('account')">{{ t("nav_account") }}</router-link>
          </div>

          <div class="footer-col">
            <h4>{{ t("footer_links_resources") }}</h4>
            <router-link :to="localePath('tutorial')">{{ t("nav_tutorial") }}</router-link>
            <router-link :to="localePath('contact')">{{ t("nav_contact") }}</router-link>
            <a href="https://github.com/julsql/thecode" target="_blank" rel="noopener">GitHub</a>
          </div>

          <div class="footer-col">
            <h4>{{ t("footer_links_legal") }}</h4>
            <router-link :to="localePath('privacy')">{{ t("nav_privacy") }}</router-link>
            <!-- Les mentions légales attendent l'identité de l'éditrice : une
                 page pleine de « à compléter » ne renseigne personne. Remplir
                 `src/legal/identity.ts` la remet en ligne, lien compris. -->
            <router-link v-if="legalReady" :to="localePath('legal')">
              {{ t("nav_legal") }}
            </router-link>
            <!-- Pas de conditions de vente affichées tant que rien n'est
                 vendu : elles annonceraient une offre qui n'existe pas. -->
            <router-link v-if="plansOpen" :to="localePath('terms')">
              {{ t("nav_terms") }}
            </router-link>
            <a href="https://github.com/julsql/thecode" target="_blank" rel="noopener">{{
              t("footer_src")
            }}</a>
          </div>
        </div>

        <div class="footer-bottom">
          <p>© {{ year }} TheCode · {{ t("footer_icons") }}</p>
        </div>
      </div>
    </footer>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, ref, watch } from "vue";
import { useRoute } from "vue-router";
import Logo from "@/assets/logo.svg";
import { useI18n } from "@/i18n";
import { loadService, service } from "@/service";
import { identityPublished } from "@/legal/identity";

export default defineComponent({
  name: "App",
  setup() {
    const year = new Date().getFullYear();
    const isOpen = ref(false);
    const route = useRoute();
    const { t, lang, switchLang, localePath } = useI18n();

    const toggleMenu = () => {
      isOpen.value = !isOpen.value;
    };
    const closeMenu = () => {
      isOpen.value = false;
    };

    watch(() => route.fullPath, closeMenu);

    // Une seule interrogation par chargement de page : le pied de page en a
    // besoin, les pages qui suivent la réutiliseront.
    loadService();
    const plansOpen = computed(() => service.plans.billingAvailable);
    const legalReady = identityPublished();

    return {
      Logo,
      year,
      isOpen,
      plansOpen,
      legalReady,
      toggleMenu,
      closeMenu,
      t,
      lang,
      switchLang,
      localePath,
    };
  },
});
</script>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: var(--c1);
  color: var(--text);
}

.site-header {
  position: sticky;
  top: 0;
  z-index: 100;
  background: rgba(20, 24, 29, 0.72);
  backdrop-filter: saturate(180%) blur(20px);
  -webkit-backdrop-filter: saturate(180%) blur(20px);
  border-bottom: 1px solid var(--border-soft);
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 24px;
}

.header-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  height: 64px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  color: var(--text);
  transition: transform 0.2s ease;
}

.brand:hover {
  transform: scale(1.03);
}

.brand-logo {
  height: 28px;
  width: 28px;
}

.brand-title {
  font-weight: 700;
  font-size: 1.15rem;
  letter-spacing: 0.2px;
}

/* Icone de compte : une pastille sobre a cote de la marque. Assez discrete
   pour ne pas concurrencer la navigation, assez presente pour qu'on la
   trouve sans la chercher. */
.account-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  margin-left: 14px;
  border-radius: 999px;
  border: 1px solid var(--border-soft);
  background: rgba(255, 255, 255, 0.05);
  color: var(--text);
  flex: none;
  transition:
    background 0.2s ease,
    border-color 0.2s ease;
}

.account-link:hover,
.account-link.is-active {
  background: rgba(255, 255, 255, 0.12);
  border-color: var(--c4);
}

.account-link svg {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.7;
  stroke-linecap: round;
}

.primary-nav {
  display: flex;
  gap: 6px;
  align-items: center;
}

.nav-link {
  position: relative;
  padding: 8px 14px;
  border-radius: 999px;
  text-decoration: none;
  color: var(--text-muted);
  font-weight: 500;
  font-size: 0.95rem;
  transition:
    color 0.2s ease,
    background 0.2s ease;
}

.nav-link:hover {
  color: var(--text);
  background: rgba(255, 255, 255, 0.06);
}

.nav-link.is-active {
  color: var(--text);
  background: linear-gradient(135deg, rgb(var(--accent-rgb) / 0.35), rgb(var(--deep-rgb) / 0.35));
  box-shadow: inset 0 0 0 1px rgb(var(--accent-rgb) / 0.45);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.lang-switch {
  display: inline-flex;
  padding: 3px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--border-soft);
}

.lang-btn {
  appearance: none;
  border: none;
  background: transparent;
  color: var(--text-muted);
  font-weight: 600;
  font-size: 0.8rem;
  padding: 6px 12px;
  border-radius: 999px;
  cursor: pointer;
  letter-spacing: 0.5px;
  transition:
    color 0.2s ease,
    background 0.2s ease;
}

.lang-btn:hover {
  color: var(--text);
}

.lang-btn.is-active {
  color: #fff;
  background: var(--fill-gradient);
  box-shadow: 0 4px 14px rgb(var(--accent-rgb) / 0.4);
}

.hamburger {
  display: none;
  flex-direction: column;
  justify-content: center;
  gap: 5px;
  width: 40px;
  height: 40px;
  padding: 0;
  border-radius: 10px;
  border: 1px solid var(--border-soft);
  background: rgba(255, 255, 255, 0.04);
  cursor: pointer;
}

.hamburger span {
  display: block;
  width: 18px;
  height: 2px;
  margin: 0 auto;
  background: var(--text);
  border-radius: 2px;
  transition:
    transform 0.3s ease,
    opacity 0.2s ease;
}

.hamburger.is-active span:nth-child(1) {
  transform: translateY(7px) rotate(45deg);
}

.hamburger.is-active span:nth-child(2) {
  opacity: 0;
}

.hamburger.is-active span:nth-child(3) {
  transform: translateY(-7px) rotate(-45deg);
}

.mobile-panel {
  display: none;
  flex-direction: column;
  gap: 4px;
  padding: 12px 24px 20px;
  border-top: 1px solid var(--border-soft);
  background: rgba(20, 24, 29, 0.92);
}

.mobile-link {
  padding: 14px 16px;
  border-radius: 12px;
  text-decoration: none;
  color: var(--text);
  font-weight: 500;
  font-size: 1.05rem;
  transition: background 0.2s ease;
}

.mobile-link:hover {
  background: rgba(255, 255, 255, 0.05);
}

.mobile-link.is-active {
  background: linear-gradient(135deg, rgb(var(--accent-rgb) / 0.3), rgb(var(--deep-rgb) / 0.3));
}

.panel-fade-enter-active,
.panel-fade-leave-active {
  transition:
    opacity 0.25s ease,
    transform 0.25s ease;
}

.panel-fade-enter-from,
.panel-fade-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

.main {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.site-footer {
  background: var(--c2);
  padding: 48px 0 22px;
  font-size: 0.9rem;
  color: var(--text-muted);
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.footer-inner {
  display: flex;
  flex-direction: column;
  gap: 28px;
}

.footer-grid {
  display: grid;
  grid-template-columns: 1.4fr 1fr 1fr 1fr;
  gap: 32px;
  align-items: start;
}

.footer-col {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.footer-brand-col {
  gap: 12px;
}

.footer-brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  color: var(--text);
  font-weight: 700;
  font-size: 1.05rem;
}

.footer-logo {
  width: 26px;
  height: 26px;
}

.footer-tag {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.9rem;
  max-width: 260px;
}

.footer-col h4 {
  margin: 0 0 4px;
  font-size: 0.8rem;
  letter-spacing: 0.6px;
  text-transform: uppercase;
  color: var(--c4);
  font-weight: 700;
}

.footer-col a {
  color: var(--text-muted);
  text-decoration: none;
  font-size: 0.92rem;
  transition: color 0.2s ease;
}

.footer-col a:hover {
  color: var(--text);
}

.footer-bottom {
  display: flex;
  justify-content: center;
  text-align: center;
  border-top: 1px solid var(--border-soft);
  padding-top: 18px;
  font-size: 0.82rem;
  color: rgba(255, 255, 255, 0.55);
}

.footer-bottom p {
  margin: 0;
}

@media (max-width: 900px) {
  .footer-grid {
    grid-template-columns: 1fr 1fr;
    gap: 24px;
  }
}

@media (max-width: 760px) {
  .primary-nav {
    display: none;
  }

  .hamburger {
    display: inline-flex;
  }

  .mobile-panel {
    display: flex;
  }

  .brand-title {
    font-size: 1rem;
  }
}

@media (max-width: 520px) {
  .footer-grid {
    grid-template-columns: 1fr;
  }
}
</style>
