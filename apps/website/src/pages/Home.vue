<template>
  <div class="home-container">

    <header class="hero">
      <div class="hero-content">
        <p class="subtitle fadeIn">{{ t('hero_question') }}</p>
        <h1 class="fadeIn delay-1">{{ t('hero_solution') }}</h1>
        <p class="subtitle fadeIn delay-2">{{ t('hero_subtitle') }}</p>
        <div class="buttons fadeIn delay-3">
          <a class="btn"
             href="https://chromewebstore.google.com/detail/thecode/jeknefpalcipdlnbeboefonmnlejepen"
             target="_blank" rel="noopener">{{ t('btn_chrome') }}</a>
          <a class="btn" href="https://addons.mozilla.org/fr/firefox/addon/thecode/" target="_blank" rel="noopener">{{
              t('btn_firefox')
            }}</a>
          <a class="btn" href="https://apps.apple.com/app/thecode-password-manager/id6753169043" target="_blank"
             rel="noopener">{{ t('btn_safari') }}</a>
          <a class="btn" href="https://apps.apple.com/app/thecode-password-manager/id6753169043" target="_blank"
             rel="noopener">{{ t('btn_iphone') }}</a>
          <a class="btn"
             href="https://play.google.com/store/apps/details?id=fr.juliette.thecode&hl=fr"
             target="_blank" rel="noopener">{{ t('btn_android') }}</a>
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
import {defineComponent} from 'vue';
import Logo from '@/assets/logo.png';
import {useI18n} from '@/i18n';

export default defineComponent({
  name: 'Home',
  setup() {
    const {t} = useI18n();
    return {Logo, t};
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

.buttons {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 12px;
  margin-top: 26px;
}

.btn {
  padding: 12px 22px;
  border-radius: 999px;
  font-weight: 600;
  font-size: 0.95rem;
  color: #fff;
  text-decoration: none;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(10px);
  transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease, border-color 0.2s ease;
}

.btn:hover {
  transform: translateY(-3px);
  background: rgba(255, 255, 255, 0.14);
  border-color: rgba(255, 255, 255, 0.3);
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
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
