<template>
  <div class="page-wrapper">
    <header class="page-hero">
      <div class="page-hero-inner">
        <div class="page-hero-icon">
          <img src="https://img.icons8.com/?size=200&id=12324&format=png&color=ffffff" alt=""/>
        </div>
        <h1>{{ t('privacy_title') }}</h1>
        <p class="page-hero-sub"><i>{{ t('privacy_last_update') }}</i></p>
      </div>
    </header>

    <div class="privacy-container fadeIn">
      <div class="privacy-card">
        <p>{{ t('privacy_thanks_pre') }}<b>TheCode</b>{{ t('privacy_thanks_post') }}</p>

        <p>{{ t('privacy_intro') }}</p>

        <p><b>{{ t('privacy_thats_why') }}</b></p>

        <div class="highlight">
          <p>{{ t('privacy_highlight_1') }}</p>
          <p>{{ t('privacy_highlight_2') }}</p>
          <p>{{ t('privacy_highlight_3') }}</p>
        </div>

        <section>
          <h2>{{ t('privacy_section_data') }}</h2>
          <p>{{ t('privacy_section_data_p') }}</p>
        </section>

        <section>
          <h2>{{ t('privacy_section_share') }}</h2>
          <p>{{ t('privacy_section_share_p') }}</p>
        </section>

        <section>
          <h2>{{ t('privacy_section_cookies') }}</h2>
          <p>{{ t('privacy_section_cookies_p') }}</p>
        </section>

        <section>
          <h2>{{ t('privacy_section_third') }}</h2>
          <p>{{ t('privacy_section_third_p') }}</p>
        </section>

        <section>
          <h2>{{ t('privacy_section_contact') }}</h2>
          <p>{{ t('privacy_section_contact_p') }}</p>
          <a class="contact-link" href="mailto:contact@thecode.julsql.fr">
            📧 contact@thecode.julsql.fr
          </a>
        </section>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {useI18n} from '@/i18n';

export default defineComponent({
  name: 'Privacy',
  setup() {
    const {t} = useI18n();
    return {t};
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
  font-size: 1rem;
  color: rgba(255, 255, 255, 0.78);
}

.privacy-container {
  display: flex;
  justify-content: center;
  padding: 0 24px 80px;
  margin-top: -50px;
  position: relative;
  z-index: 2;
}

.privacy-card {
  width: 100%;
  max-width: 820px;
  padding: 40px;
  border-radius: 22px;
  background: linear-gradient(160deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02));
  border: 1px solid var(--border-soft);
  box-shadow: var(--shadow-strong);
  color: var(--text);
  backdrop-filter: blur(10px);
}

.privacy-card p {
  line-height: 1.7;
  color: var(--text-muted);
  margin: 0 0 14px;
}

.privacy-card b {
  color: var(--text);
}

h2 {
  color: var(--c4);
  font-size: 1.05rem;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  margin: 0 0 12px;
}

.highlight {
  margin: 18px 0 26px;
  padding: 20px 22px;
  background: linear-gradient(135deg, rgba(166, 77, 121, 0.14), rgba(106, 17, 203, 0.10));
  border-left: 3px solid var(--c4);
  border-radius: 14px;
}

.highlight p {
  color: var(--text);
  margin: 0 0 8px;
}

.highlight p:last-child {
  margin: 0;
}

section {
  padding: 22px 0;
  border-top: 1px solid var(--border-soft);
}

.contact-link {
  display: inline-block;
  margin-top: 10px;
  color: var(--text);
  text-decoration: none;
  font-weight: 600;
  padding: 10px 16px;
  border-radius: 999px;
  background: linear-gradient(135deg, rgba(166, 77, 121, 0.25), rgba(106, 30, 85, 0.25));
  border: 1px solid rgba(166, 77, 121, 0.4);
  transition: transform 0.2s ease, background 0.2s ease;
}

.contact-link:hover {
  transform: translateY(-2px);
  background: linear-gradient(135deg, rgba(166, 77, 121, 0.4), rgba(106, 30, 85, 0.4));
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
  .privacy-card {
    padding: 24px 18px;
    border-radius: 18px;
  }

  .page-hero {
    padding: 50px 20px 70px;
  }
}
</style>
