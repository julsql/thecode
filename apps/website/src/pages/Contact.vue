<template>
  <div class="page-wrapper">
    <header class="page-hero">
      <div class="page-hero-inner">
        <div class="page-hero-icon">
          <img src="https://img.icons8.com/?size=100&id=69NT4MMdIuAw&format=png&color=000000" alt=""/>
        </div>
        <h1>{{ t('contact_title') }}</h1>
        <p class="page-hero-sub">{{ t('contact_subtitle') }}</p>
      </div>
    </header>

    <div class="content-container fadeIn">
      <div class="cards">

        <a class="contact-card" href="mailto:contact@thecode.julsql.fr">
          <div class="contact-card-icon">
            <img src="https://img.icons8.com/?size=100&id=LPcVDft9Isqt&format=png&color=000000" alt=""/>
          </div>
          <h2>{{ t('contact_email_h') }}</h2>
          <p>{{ t('contact_email_p') }}</p>
          <span class="contact-card-link">contact@thecode.julsql.fr</span>
        </a>

        <a class="contact-card" href="https://github.com/TheCodeDevLab" target="_blank" rel="noopener">
          <div class="contact-card-icon">
            <img :src="GithubIcon" alt=""/>
          </div>
          <h2>{{ t('contact_github_h') }}</h2>
          <p>{{ t('contact_github_p') }}</p>
          <span class="contact-card-link">{{ t('contact_github_cta') }} →</span>
        </a>

        <router-link class="contact-card contact-card--soft" :to="localePath('privacy')">
          <div class="contact-card-icon">
            <img src="https://img.icons8.com/?size=200&id=12324&format=png&color=ffffff" alt=""/>
          </div>
          <h2>{{ t('contact_privacy_h') }}</h2>
          <p>{{ t('contact_privacy_p') }}</p>
          <span class="contact-card-link">{{ t('contact_privacy_cta') }} →</span>
        </router-link>

      </div>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {useI18n} from '@/i18n';
import GithubIcon from '@/assets/github.png';

export default defineComponent({
  name: 'Contact',
  setup() {
    const {t, localePath} = useI18n();
    return {t, localePath, GithubIcon};
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

.cards {
  width: 100%;
  max-width: 980px;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 18px;
}

.contact-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 28px;
  border-radius: 22px;
  background: linear-gradient(160deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02));
  border: 1px solid var(--border-soft);
  box-shadow: var(--shadow-strong);
  color: var(--text);
  text-decoration: none;
  backdrop-filter: blur(10px);
  transition: transform 0.25s ease, border-color 0.25s ease, background 0.25s ease;
}

.contact-card:hover {
  transform: translateY(-4px);
  border-color: rgba(166, 77, 121, 0.5);
  background: linear-gradient(160deg, rgba(166, 77, 121, 0.12), rgba(255, 255, 255, 0.03));
}

.contact-card-icon {
  width: 52px;
  height: 52px;
  border-radius: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(166, 77, 121, 0.28), rgba(106, 17, 203, 0.22));
  border: 1px solid var(--border-soft);
  margin-bottom: 4px;
}

.contact-card-icon img {
  width: 26px;
  height: 26px;
}

h2 {
  color: var(--c4);
  font-size: 1.05rem;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  margin: 0;
}

.contact-card p {
  margin: 0;
  color: var(--text-muted);
  line-height: 1.6;
  font-size: 0.95rem;
}

.contact-card-link {
  margin-top: auto;
  padding-top: 8px;
  font-weight: 600;
  color: var(--text);
  font-size: 0.95rem;
  word-break: break-word;
}

.contact-card--soft .contact-card-icon {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.02));
}

.fadeIn {
  opacity: 0;
  animation: fadeIn 0.6s ease-out forwards;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@media (max-width: 600px) {
  .page-hero {
    padding: 50px 20px 70px;
  }

  .contact-card {
    padding: 22px;
  }
}
</style>
