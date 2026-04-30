<template>
  <div class="app">
    <!-- HEADER -->
    <header class="site-header" :class="{ 'is-open': isOpen }">
      <div class="container header-inner">
        <router-link :to="localePath('')" class="brand" @click="closeMenu">
          <img :src="Logo" alt="TheCode" class="brand-logo"/>
          <span class="brand-title">TheCode</span>
        </router-link>

        <nav aria-label="primary" class="primary-nav">
          <router-link :to="localePath('')" class="nav-link" exact-active-class="is-active" @click="closeMenu">
            {{ t('nav_home') }}
          </router-link>
          <router-link :to="localePath('generate')" class="nav-link" active-class="is-active" @click="closeMenu">
            {{ t('nav_generator') }}
          </router-link>
          <router-link :to="localePath('privacy')" class="nav-link" active-class="is-active" @click="closeMenu">
            {{ t('nav_privacy') }}
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
            >EN
            </button>
            <button
                type="button"
                class="lang-btn"
                :class="{ 'is-active': lang === 'fr' }"
                :aria-pressed="lang === 'fr'"
                @click="switchLang('fr')"
            >FR
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
          <router-link :to="localePath('')" class="mobile-link" exact-active-class="is-active" @click="closeMenu">
            {{ t('nav_home') }}
          </router-link>
          <router-link :to="localePath('generate')" class="mobile-link" active-class="is-active" @click="closeMenu">
            {{ t('nav_generator') }}
          </router-link>
          <router-link :to="localePath('privacy')" class="mobile-link" active-class="is-active" @click="closeMenu">
            {{ t('nav_privacy') }}
          </router-link>
        </nav>
      </transition>
    </header>

    <!-- MAIN CONTENT -->
    <main class="main">
      <router-view/>
    </main>

    <!-- FOOTER -->
    <footer class="site-footer">
      <div class="footer-inner container">
        <p>© {{ year }} TheCode — {{ t('footer_tagline') }} · {{ t('footer_icons') }}</p>
        <p>
          {{ t('footer_org') }}
          <a href="https://github.com/TheCodeDevLab" target="_blank" rel="noopener">TheCodeDevLab</a>
          · {{ t('footer_src') }}
          <a href="https://github.com/TheCodeDevLab/thecode-website" target="_blank" rel="noopener">thecode-website</a>
        </p>
      </div>
    </footer>
  </div>
</template>

<script lang="ts">
import {defineComponent, ref, watch} from 'vue';
import {useRoute} from 'vue-router';
import Logo from '@/assets/logo.svg';
import {useI18n} from '@/i18n';

export default defineComponent({
  name: 'App',
  setup() {
    const year = new Date().getFullYear();
    const isOpen = ref(false);
    const route = useRoute();
    const {t, lang, switchLang, localePath} = useI18n();

    const toggleMenu = () => {
      isOpen.value = !isOpen.value;
    };
    const closeMenu = () => {
      isOpen.value = false;
    };

    watch(() => route.fullPath, closeMenu);

    return {Logo, year, isOpen, toggleMenu, closeMenu, t, lang, switchLang, localePath};
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
  transition: color 0.2s ease, background 0.2s ease;
}

.nav-link:hover {
  color: var(--text);
  background: rgba(255, 255, 255, 0.06);
}

.nav-link.is-active {
  color: var(--text);
  background: linear-gradient(135deg, rgba(166, 77, 121, 0.35), rgba(106, 30, 85, 0.35));
  box-shadow: inset 0 0 0 1px rgba(166, 77, 121, 0.45);
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
  transition: color 0.2s ease, background 0.2s ease;
}

.lang-btn:hover {
  color: var(--text);
}

.lang-btn.is-active {
  color: #fff;
  background: linear-gradient(135deg, var(--c4), var(--c3));
  box-shadow: 0 4px 14px rgba(166, 77, 121, 0.4);
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
  transition: transform 0.3s ease, opacity 0.2s ease;
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
  background: linear-gradient(135deg, rgba(166, 77, 121, 0.3), rgba(106, 30, 85, 0.3));
}

.panel-fade-enter-active,
.panel-fade-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
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
  padding: 22px 0;
  font-size: 0.85rem;
  color: #ddd;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.footer-inner {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: center;
  text-align: center;
}

.site-footer a {
  color: var(--c4);
  text-decoration: none;
}

.site-footer a:hover {
  text-decoration: underline;
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
</style>
