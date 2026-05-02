<template>
  <div class="page-wrapper">
    <header class="page-hero">
      <div class="page-hero-inner">
        <div class="page-hero-icon">
          <img src="https://img.icons8.com/?size=100&id=11808&format=png&color=000000" alt=""/>
        </div>
        <h1>{{ t('about_title') }}</h1>
        <p class="page-hero-sub">{{ t('about_subtitle') }}</p>
      </div>
    </header>

    <div class="content-container fadeIn">
      <div class="content-card">

        <section>
          <h2>{{ t('about_intro_h') }}</h2>
          <p>{{ t('about_intro_p1') }}</p>
          <p>{{ t('about_intro_p2') }}</p>
        </section>

        <section>
          <h2>{{ t('about_how_h') }}</h2>
          <p>{{ t('about_how_p1') }}</p>
          <div class="formula">
            <span class="formula-part">{{ t('gen_label_key') }}</span>
            <span class="formula-op">+</span>
            <span class="formula-part">{{ t('gen_label_site') }}</span>
            <span class="formula-op">→</span>
            <span class="formula-part formula-out">SHA-256</span>
            <span class="formula-op">→</span>
            <span class="formula-part formula-result">{{ t('gen_section_result') }}</span>
          </div>
          <p>{{ t('about_how_p2') }}</p>
        </section>

        <section>
          <h2>{{ t('about_why_h') }}</h2>
          <div class="benefits">
            <div class="benefit">
              <h3>{{ t('about_why_b1_t') }}</h3>
              <p>{{ t('about_why_b1_p') }}</p>
            </div>
            <div class="benefit">
              <h3>{{ t('about_why_b2_t') }}</h3>
              <p>{{ t('about_why_b2_p') }}</p>
            </div>
            <div class="benefit">
              <h3>{{ t('about_why_b3_t') }}</h3>
              <p>{{ t('about_why_b3_p') }}</p>
            </div>
            <div class="benefit">
              <h3>{{ t('about_why_b4_t') }}</h3>
              <p>{{ t('about_why_b4_p') }}</p>
            </div>
          </div>
        </section>

        <section>
          <h2>{{ t('about_oss_h') }}</h2>
          <p>{{ t('about_oss_p') }}</p>
          <a class="cta-link" href="https://github.com/TheCodeDevLab" target="_blank" rel="noopener">
            <img :src="GithubIcon" alt="" class="cta-icon"/>
            {{ t('about_oss_cta') }}
          </a>
        </section>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {useI18n} from '@/i18n';
import GithubIcon from '@/assets/github.png';

export default defineComponent({
  name: 'About',
  setup() {
    const {t} = useI18n();
    return {t, GithubIcon};
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
  max-width: 820px;
  padding: 40px;
  border-radius: 22px;
  background: linear-gradient(160deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02));
  border: 1px solid var(--border-soft);
  box-shadow: var(--shadow-strong);
  color: var(--text);
  backdrop-filter: blur(10px);
}

.content-card p {
  line-height: 1.7;
  color: var(--text-muted);
  margin: 0 0 14px;
}

h2 {
  color: var(--c4);
  font-size: 1.05rem;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  margin: 0 0 14px;
}

section {
  padding: 22px 0;
  border-top: 1px solid var(--border-soft);
}

section:first-child {
  border-top: none;
  padding-top: 0;
}

.formula {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  justify-content: center;
  margin: 18px 0 22px;
  padding: 18px;
  border-radius: 14px;
  background: linear-gradient(135deg, rgba(166, 77, 121, 0.14), rgba(106, 17, 203, 0.10));
  border: 1px solid rgba(166, 77, 121, 0.3);
}

.formula-part {
  padding: 8px 14px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid var(--border-soft);
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--text);
}

.formula-out {
  font-family: 'JetBrains Mono', 'Menlo', 'Consolas', monospace;
  letter-spacing: 0.3px;
}

.formula-result {
  background: linear-gradient(135deg, var(--c4), var(--c3));
  border-color: transparent;
  color: #fff;
  box-shadow: 0 4px 12px rgba(166, 77, 121, 0.4);
}

.formula-op {
  color: var(--c4);
  font-weight: 700;
  font-size: 1.1rem;
}

.benefits {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 14px;
  margin-top: 4px;
}

.benefit {
  padding: 18px;
  border-radius: 14px;
  border: 1px solid var(--border-soft);
  background: rgba(255, 255, 255, 0.03);
  transition: border-color 0.2s ease, background 0.2s ease, transform 0.2s ease;
}

.benefit:hover {
  border-color: rgba(166, 77, 121, 0.45);
  background: rgba(166, 77, 121, 0.07);
  transform: translateY(-2px);
}

.benefit h3 {
  margin: 0 0 6px;
  color: var(--text);
  font-size: 1rem;
  letter-spacing: 0.2px;
}

.benefit p {
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.55;
}

.cta-link {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
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

.cta-icon {
  width: 18px;
  height: 18px;
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
  .content-card {
    padding: 24px 18px;
    border-radius: 18px;
  }

  .page-hero {
    padding: 50px 20px 70px;
  }
}
</style>
