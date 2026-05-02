<template>
  <div class="home-container">

    <header class="hero">
      <div class="hero-content">
        <p class="subtitle fadeIn">{{ t('hero_question') }}</p>
        <h1 class="fadeIn delay-1">{{ t('hero_solution') }}</h1>
        <p class="subtitle fadeIn delay-2">{{ t('hero_subtitle') }}</p>

        <div class="install fadeIn delay-3">
          <a class="btn-install" :href="current.url" target="_blank" rel="noopener">
            <span class="btn-install-icon" aria-hidden="true">
              <img :src="current.icon" :alt="''"/>
            </span>
            <span class="btn-install-text">
              <span class="btn-install-label">{{ t('home_install_for') }}</span>
              <span class="btn-install-browser">{{ current.label }}</span>
            </span>
          </a>

          <p class="other-platforms-label">{{ t('home_other_platforms') }}</p>
          <div class="other-platforms">
            <a
                v-for="p in others"
                :key="p.id"
                class="platform-pill"
                :href="p.url"
                target="_blank"
                rel="noopener"
            >
              <img :src="p.icon" alt="" class="platform-icon"/>
              <span>{{ p.label }}</span>
            </a>
          </div>

          <div class="hero-meta">
            <router-link :to="localePath('tutorial')" class="meta-link">
              {{ t('home_tutorial_link') }}
            </router-link>
            <a class="meta-link" href="https://github.com/TheCodeDevLab" target="_blank" rel="noopener">
              <img :src="GithubIcon" alt="" class="meta-icon"/>
              {{ t('home_source_code') }}
            </a>
          </div>
        </div>
      </div>
      <div class="hero-illustration">
        <img :src="Logo" alt="TheCode logo"/>
      </div>
    </header>

    <!-- Features Section -->
    <section class="features">
      <h2>{{ t('features_title') }}</h2>
      <div class="feature-list">
        <div class="feature fadeIn">
          <img src="https://img.icons8.com/?size=500&id=13534&format=png&color=ffffff" alt=""/>
          <h3>{{ t('feature_security_title') }}</h3>
          <p>{{ t('feature_security_p1') }}</p>
          <p>{{ t('feature_security_p2') }}</p>
        </div>
        <div class="feature fadeIn delay-1">
          <img src="https://img.icons8.com/?size=500&id=pcD8bVCCf7dC&format=png&color=ffffff" alt=""/>
          <h3>{{ t('feature_memory_title') }}</h3>
          <p>{{ t('feature_memory_p1') }}</p>
          <p>{{ t('feature_memory_p2') }}</p>
        </div>
        <div class="feature fadeIn delay-2">
          <img src="https://img.icons8.com/?size=500&id=GbRPcEhEje0f&format=png&color=ffffff" alt=""/>
          <h3>{{ t('feature_multi_title') }}</h3>
          <p>{{ t('feature_multi_p1') }}</p>
          <p>{{ t('feature_multi_p2') }}</p>
        </div>
        <div class="feature fadeIn delay-3">
          <img src="https://img.icons8.com/?size=500&id=13814&format=png&color=ffffff" alt=""/>
          <h3>{{ t('feature_offline_title') }}</h3>
          <p>{{ t('feature_offline_p1') }}</p>
        </div>
      </div>
    </section>
  </div>
</template>

<script lang="ts">
import {computed, defineComponent} from 'vue';
import Logo from '@/assets/logo.png';
import ChromeIcon from '@/assets/chrome.png';
import FirefoxIcon from '@/assets/firefox.png';
import AppStoreIcon from '@/assets/app_store.png';
import GooglePlayIcon from '@/assets/google_play.png';
import GithubIcon from '@/assets/github.png';
import {useI18n} from '@/i18n';
import type {TranslationKey} from '@/i18n';

type PlatformId = 'chrome' | 'firefox' | 'safari' | 'edge' | 'opera' | 'ios' | 'android';

interface Platform {
  id: PlatformId;
  labelKey: TranslationKey;
  url: string;
  icon: string;
}

const CHROME_STORE = 'https://chromewebstore.google.com/detail/thecode/jeknefpalcipdlnbeboefonmnlejepen';
const FIREFOX_STORE = 'https://addons.mozilla.org/fr/firefox/addon/thecode/';
const APP_STORE = 'https://apps.apple.com/app/thecode-password-manager/id6753169043';
const PLAY_STORE = 'https://play.google.com/store/apps/details?id=fr.juliette.thecode&hl=fr';

const PLATFORMS: Record<PlatformId, Platform> = {
  chrome: {
    id: 'chrome',
    labelKey: 'browser_chrome',
    url: CHROME_STORE,
    icon: ChromeIcon,
  },
  firefox: {
    id: 'firefox',
    labelKey: 'browser_firefox',
    url: FIREFOX_STORE,
    icon: FirefoxIcon,
  },
  safari: {
    id: 'safari',
    labelKey: 'browser_safari',
    url: APP_STORE,
    icon: AppStoreIcon,
  },
  edge: {
    id: 'edge',
    labelKey: 'browser_edge',
    url: CHROME_STORE,
    icon: 'https://img.icons8.com/?size=200&id=KS4dCmukKW8c&format=png',
  },
  opera: {
    id: 'opera',
    labelKey: 'browser_opera',
    url: CHROME_STORE,
    icon: 'https://img.icons8.com/?size=200&id=22994&format=png',
  },
  ios: {
    id: 'ios',
    labelKey: 'browser_ios',
    url: APP_STORE,
    icon: AppStoreIcon,
  },
  android: {
    id: 'android',
    labelKey: 'browser_android',
    url: PLAY_STORE,
    icon: GooglePlayIcon,
  },
};

function detectPlatform(): PlatformId {
  if (typeof navigator === 'undefined') return 'chrome';
  const ua = navigator.userAgent || '';
  if (/iPad|iPhone|iPod/.test(ua)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  if (/Edg\//.test(ua)) return 'edge';
  if (/OPR\/|Opera/.test(ua)) return 'opera';
  if (/Firefox\//.test(ua)) return 'firefox';
  if (/Safari/.test(ua) && !/Chrome|Chromium/.test(ua)) return 'safari';
  if (/Chrome\/|Chromium/.test(ua)) return 'chrome';
  return 'chrome';
}

export default defineComponent({
  name: 'Home',
  setup() {
    const {t, localePath} = useI18n();
    const detected = detectPlatform();

    const current = computed(() => {
      const p = PLATFORMS[detected];
      return {url: p.url, icon: p.icon, label: t(p.labelKey)};
    });

    const others = computed(() => {
      const order: PlatformId[] = ['chrome', 'firefox', 'safari', 'edge', 'opera', 'ios', 'android'];
      const seenUrls = new Set<string>([PLATFORMS[detected].url]);
      return order
          .filter((id) => id !== detected)
          .filter((id) => {
            const url = PLATFORMS[id].url;
            if (seenUrls.has(url)) return false;
            seenUrls.add(url);
            return true;
          })
          .map((id) => ({
            id,
            url: PLATFORMS[id].url,
            icon: PLATFORMS[id].icon,
            label: t(PLATFORMS[id].labelKey),
          }));
    });

    return {Logo, GithubIcon, t, localePath, current, others};
  },
});
</script>

<style scoped>
.home-container {
  color: var(--text);
}

.hero {
  position: relative;
  display: flex;
  flex-wrap: wrap-reverse;
  align-items: center;
  justify-content: center;
  background: var(--hero-gradient);
  color: #fff;
  padding: 90px 80px 110px;
  gap: 60px;
  overflow: hidden;
}

.hero::after {
  content: "";
  position: absolute;
  inset: auto 0 -1px 0;
  height: 80px;
  background: linear-gradient(to bottom, transparent, var(--c1));
  pointer-events: none;
}

.hero-content {
  flex: 1;
  min-width: 260px;
  max-width: 640px;
  text-align: center;
  position: relative;
  z-index: 1;
}

.hero h1 {
  font-size: clamp(2.2rem, 4vw, 3.2rem);
  margin: 14px 0 20px;
  letter-spacing: -0.5px;
  line-height: 1.15;
  color: #fff;
  text-shadow: 0 2px 12px rgba(0, 0, 0, 0.25);
}

.subtitle {
  font-size: clamp(1rem, 1.4vw, 1.25rem);
  color: rgba(255, 255, 255, 0.85);
  margin: 0 0 18px;
}

.hero-illustration {
  position: relative;
  z-index: 1;
}

.hero-illustration img {
  width: 80vw;
  max-width: 280px;
  animation: float 3s ease-in-out infinite;
  transition: transform 0.2s, filter 0.2s;
  filter: drop-shadow(0 10px 30px rgba(0, 0, 0, 0.45));
}

.hero-illustration img:hover {
  transform: translateY(-5px);
  filter: drop-shadow(0 18px 40px rgba(166, 77, 121, 0.4));
}

.install {
  margin-top: 30px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
}

.btn-install {
  display: inline-flex;
  align-items: center;
  gap: 14px;
  padding: 18px 32px;
  border-radius: 999px;
  text-decoration: none;
  color: #fff;
  background: linear-gradient(135deg, var(--c4), var(--c3));
  border: 1px solid rgba(255, 255, 255, 0.18);
  box-shadow: 0 14px 40px rgba(166, 77, 121, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.18);
  font-weight: 700;
  transition: transform 0.2s ease, box-shadow 0.2s ease, filter 0.2s ease;
}

.btn-install:hover {
  transform: translateY(-3px);
  box-shadow: 0 22px 55px rgba(166, 77, 121, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.2);
  filter: brightness(1.05);
}

.btn-install-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.25);
}

.btn-install-icon img {
  width: 28px;
  height: 28px;
  object-fit: contain;
}

.btn-install-text {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  line-height: 1.1;
  text-align: left;
}

.btn-install-label {
  font-size: 0.72rem;
  letter-spacing: 0.6px;
  text-transform: uppercase;
  opacity: 0.85;
}

.btn-install-browser {
  font-size: 1.35rem;
  font-weight: 800;
  letter-spacing: -0.2px;
}

.other-platforms-label {
  margin: 4px 0 0;
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.7);
  letter-spacing: 0.3px;
}

.other-platforms {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
}

.platform-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 9px 16px;
  border-radius: 999px;
  font-size: 0.9rem;
  font-weight: 600;
  color: #fff;
  text-decoration: none;
  background: rgba(255, 255, 255, 0.07);
  border: 1px solid rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(10px);
  transition: transform 0.2s ease, background 0.2s ease, border-color 0.2s ease;
}

.platform-pill:hover {
  transform: translateY(-2px);
  background: rgba(255, 255, 255, 0.13);
  border-color: rgba(255, 255, 255, 0.3);
}

.platform-icon {
  width: 18px;
  height: 18px;
  object-fit: contain;
}

.hero-meta {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 18px;
  margin-top: 6px;
}

.meta-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: rgba(255, 255, 255, 0.85);
  text-decoration: none;
  font-size: 0.92rem;
  font-weight: 500;
  border-bottom: 1px dashed rgba(255, 255, 255, 0.25);
  padding-bottom: 2px;
  transition: color 0.2s ease, border-color 0.2s ease;
}

.meta-link:hover {
  color: #fff;
  border-color: rgba(255, 255, 255, 0.7);
}

.meta-icon {
  width: 16px;
  height: 16px;
}

.features {
  text-align: center;
  padding: 80px 24px 100px;
  background: var(--c1);
}

.features h2 {
  font-size: clamp(1.8rem, 3vw, 2.4rem);
  margin: 0 0 50px;
  color: var(--text);
  letter-spacing: -0.3px;
}

.feature-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 24px;
  max-width: 1100px;
  margin: 0 auto;
}

.feature {
  position: relative;
  background: linear-gradient(160deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02));
  padding: 32px 24px;
  border-radius: 20px;
  border: 1px solid var(--border-soft);
  text-align: left;
  transition: transform 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease, background 0.3s ease;
  overflow: hidden;
}

.feature::before {
  content: "";
  position: absolute;
  inset: 0;
  background: radial-gradient(400px 200px at 0% 0%, rgba(166, 77, 121, 0.18), transparent 60%);
  opacity: 0;
  transition: opacity 0.3s ease;
  pointer-events: none;
}

.feature:hover {
  transform: translateY(-6px);
  border-color: rgba(166, 77, 121, 0.45);
  box-shadow: var(--shadow-soft);
}

.feature:hover::before {
  opacity: 1;
}

.feature h3 {
  font-size: 1.25rem;
  margin: 12px 0 10px;
  color: var(--text);
}

.feature p {
  font-size: 0.95rem;
  color: var(--text-muted);
  line-height: 1.55;
  margin: 0 0 8px;
}

.feature img {
  width: 56px;
  height: 56px;
  padding: 12px;
  border-radius: 14px;
  background: linear-gradient(135deg, rgba(106, 17, 203, 0.25), rgba(166, 77, 121, 0.25));
  border: 1px solid var(--border-soft);
}

@keyframes float {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-12px);
  }
}

.fadeIn {
  opacity: 0;
  animation: fadeInAnim 1s forwards;
}

.fadeIn.delay-1 {
  animation-delay: 0.4s;
}

.fadeIn.delay-2 {
  animation-delay: 0.7s;
}

.fadeIn.delay-3 {
  animation-delay: 1s;
}

@keyframes fadeInAnim {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@media (max-width: 900px) {
  .hero {
    flex-direction: column-reverse;
    padding: 60px 24px 80px;
    gap: 32px;
  }
}
</style>
