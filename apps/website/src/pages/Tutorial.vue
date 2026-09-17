<template>
  <div class="page-wrapper">
    <header class="page-hero">
      <div class="page-hero-inner">
        <div class="page-hero-icon">
          <img src="https://img.icons8.com/?size=100&id=SRHPFGVQjytQ&format=png&color=000000" alt=""/>
        </div>
        <h1>{{ t('tutorial_title') }}</h1>
        <p class="page-hero-sub">{{ t('tutorial_subtitle') }}</p>
      </div>
    </header>

    <div class="content-container fadeIn">
      <div class="content-card">

        <p class="intro">{{ t('tutorial_intro') }}</p>

        <div class="tabs" role="tablist">
          <button
              v-for="p in platforms"
              :key="p.id"
              type="button"
              class="tab"
              :class="{ 'is-active': active === p.id }"
              :aria-selected="active === p.id"
              @click="active = p.id"
          >
            <img :src="p.icon" alt="" class="tab-icon"/>
            <span>{{ t(p.titleKey) }}</span>
          </button>
        </div>

        <article v-for="p in platforms" v-show="active === p.id" :key="p.id" class="guide">
          <h2>{{ t(p.titleKey) }}</h2>
          <p v-if="p.introKey" class="guide-intro">{{ t(p.introKey) }}</p>
          <ol class="steps">
            <li v-for="(stepKey, idx) in p.steps" :key="stepKey">
              <span class="step-num">{{ idx + 1 }}</span>
              <span class="step-text">{{ t(stepKey) }}</span>
            </li>
          </ol>
          <a class="cta-link" :href="p.url" target="_blank" rel="noopener">
            {{ t(p.ctaKey) }}
          </a>
        </article>

        <section class="help">
          <h2>{{ t('tutorial_help_h') }}</h2>
          <p>{{ t('tutorial_help_p') }}</p>
          <router-link :to="localePath('contact')" class="cta-link cta-link--alt">
            {{ t('tutorial_help_cta') }}
          </router-link>
        </section>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, ref} from 'vue';
import {useI18n} from '@/i18n';
import type {TranslationKey} from '@/i18n';
import ChromeIcon from '@/assets/chrome.png';
import FirefoxIcon from '@/assets/firefox.png';
import SafariIcon from '@/assets/safari.png';
import AppleIcon from '@/assets/apple.png';
import AndroidIcon from '@/assets/android.png';

type PlatformId = 'ios' | 'android' | 'chrome' | 'firefox' | 'safari';

interface PlatformGuide {
  id: PlatformId;
  titleKey: TranslationKey;
  introKey?: TranslationKey;
  steps: TranslationKey[];
  ctaKey: TranslationKey;
  icon: string;
  url: string;
}

const platforms: PlatformGuide[] = [
  {
    id: 'ios',
    titleKey: 'tutorial_ios_h',
    introKey: 'tutorial_ios_intro',
    steps: [
      'tutorial_ios_s1',
      'tutorial_ios_s2',
      'tutorial_ios_s3',
      'tutorial_ios_s4',
      'tutorial_ios_s5',
      'tutorial_ios_s6',
    ],
    ctaKey: 'tutorial_ios_cta',
    icon: AppleIcon,
    url: 'https://apps.apple.com/app/thecode-password-manager/id6753169043',
  },
  {
    id: 'android',
    titleKey: 'tutorial_android_h',
    steps: ['tutorial_android_s1', 'tutorial_android_s2', 'tutorial_android_s3'],
    ctaKey: 'tutorial_android_cta',
    icon: AndroidIcon,
    url: 'https://play.google.com/store/apps/details?id=fr.juliette.thecode&hl=fr',
  },
  {
    id: 'chrome',
    titleKey: 'tutorial_chrome_h',
    steps: ['tutorial_chrome_s1', 'tutorial_chrome_s2', 'tutorial_chrome_s3', 'tutorial_chrome_s4'],
    ctaKey: 'tutorial_chrome_cta',
    icon: ChromeIcon,
    url: 'https://chromewebstore.google.com/detail/thecode/jeknefpalcipdlnbeboefonmnlejepen',
  },
  {
    id: 'firefox',
    titleKey: 'tutorial_firefox_h',
    steps: ['tutorial_firefox_s1', 'tutorial_firefox_s2', 'tutorial_firefox_s3'],
    ctaKey: 'tutorial_firefox_cta',
    icon: FirefoxIcon,
    url: 'https://addons.mozilla.org/fr/firefox/addon/thecode/',
  },
  {
    id: 'safari',
    titleKey: 'tutorial_safari_h',
    steps: ['tutorial_safari_s1', 'tutorial_safari_s2', 'tutorial_safari_s3', 'tutorial_safari_s4'],
    ctaKey: 'tutorial_safari_cta',
    icon: SafariIcon,
    url: 'https://apps.apple.com/app/thecode-password-manager/id6753169043',
  },
];

function detectPlatform(): PlatformId {
  if (typeof navigator === 'undefined') return 'chrome';
  const ua = navigator.userAgent || '';
  if (/iPad|iPhone|iPod/.test(ua)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  if (/Firefox\//.test(ua)) return 'firefox';
  if (/Safari/.test(ua) && !/Chrome|Chromium/.test(ua)) return 'safari';
  return 'chrome';
}

export default defineComponent({
  name: 'Tutorial',
  setup() {
    const {t, localePath} = useI18n();
    const active = ref<PlatformId>(detectPlatform());
    return {t, localePath, platforms, active};
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
  max-width: 800px;
  margin: 0 auto;
}

.page-hero-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 72px;
  height: 72px;
  border-radius: 20px;
  background: linear-gradient(135deg, rgba(166, 77, 121, 0.35), rgba(106, 17, 203, 0.35));
  border: 1px solid rgba(255, 255, 255, 0.15);
  margin-bottom: 18px;
}

.page-hero-icon img {
  width: 40px;
  height: 40px;
}

.page-hero h1 {
  font-size: clamp(2rem, 4vw, 2.8rem);
  margin: 0 0 12px;
  letter-spacing: -0.5px;
  color: #fff;
  text-shadow: 0 2px 12px rgba(0, 0, 0, 0.25);
}

.page-hero-sub {
  margin: 0;
  font-size: clamp(1rem, 1.3vw, 1.15rem);
  color: rgba(255, 255, 255, 0.78);
}

.content-container {
  display: flex;
  justify-content: center;
  padding: 0 24px 80px;
  margin-top: -50px;
  position: relative;
  z-index: 2;
}

.content-card {
  width: 100%;
  max-width: 860px;
  padding: 40px;
  border-radius: 22px;
  background: linear-gradient(160deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02));
  border: 1px solid var(--border-soft);
  box-shadow: var(--shadow-strong);
  color: var(--text);
  backdrop-filter: blur(10px);
}

.intro {
  margin: 0 0 24px;
  color: var(--text-muted);
  line-height: 1.6;
}

.tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 26px;
  padding-bottom: 18px;
  border-bottom: 1px solid var(--border-soft);
}

.tab {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 9px 16px;
  border-radius: 999px;
  border: 1px solid var(--border-soft);
  background: rgba(255, 255, 255, 0.04);
  color: var(--text-muted);
  font-weight: 600;
  font-size: 0.92rem;
  cursor: pointer;
  transition: color 0.2s ease, background 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
}

.tab:hover {
  color: var(--text);
  border-color: rgba(166, 77, 121, 0.45);
  transform: translateY(-1px);
}

.tab.is-active {
  color: #fff;
  background: linear-gradient(135deg, var(--c4), var(--c3));
  border-color: transparent;
  box-shadow: 0 6px 18px rgba(166, 77, 121, 0.35);
}

.tab-icon {
  width: 18px;
  height: 18px;
  object-fit: contain;
}

.guide {
  animation: fadeIn 0.3s ease-out;
}

h2 {
  color: var(--c4);
  font-size: 1.05rem;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  margin: 0 0 14px;
}

.guide-intro {
  margin: 0 0 18px;
  color: var(--text-muted);
  line-height: 1.6;
  padding: 14px 16px;
  border-left: 3px solid var(--c4);
  border-radius: 10px;
  background: linear-gradient(135deg, rgba(166, 77, 121, 0.12), rgba(106, 17, 203, 0.08));
}

.steps {
  list-style: none;
  margin: 0 0 22px;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.steps li {
  display: flex;
  gap: 14px;
  align-items: flex-start;
  padding: 14px 16px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--border-soft);
  line-height: 1.55;
  color: var(--text);
}

.step-num {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  font-weight: 700;
  font-size: 0.9rem;
  color: #fff;
  background: linear-gradient(135deg, var(--c4), var(--c3));
  box-shadow: 0 4px 10px rgba(166, 77, 121, 0.35);
}

.step-text {
  color: var(--text-muted);
  font-size: 0.95rem;
}

.cta-link {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--text);
  text-decoration: none;
  font-weight: 600;
  padding: 10px 18px;
  border-radius: 999px;
  background: linear-gradient(135deg, rgba(166, 77, 121, 0.25), rgba(106, 30, 85, 0.25));
  border: 1px solid rgba(166, 77, 121, 0.4);
  transition: transform 0.2s ease, background 0.2s ease;
}

.cta-link:hover {
  transform: translateY(-2px);
  background: linear-gradient(135deg, rgba(166, 77, 121, 0.4), rgba(106, 30, 85, 0.4));
}

.cta-link--alt {
  background: rgba(255, 255, 255, 0.05);
  border-color: var(--border-soft);
}

.cta-link--alt:hover {
  background: rgba(255, 255, 255, 0.1);
}

.help {
  margin-top: 30px;
  padding: 22px 0 0;
  border-top: 1px solid var(--border-soft);
}

.help p {
  color: var(--text-muted);
  margin: 0 0 14px;
  line-height: 1.6;
}

.fadeIn {
  opacity: 0;
  animation: fadeIn 0.6s ease-out forwards;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 600px) {
  .content-card {
    padding: 24px 18px;
    border-radius: 18px;
  }

  .page-hero {
    padding: 50px 20px 70px;
  }

  .tab {
    flex: 1 1 calc(50% - 4px);
    justify-content: center;
  }
}
</style>
