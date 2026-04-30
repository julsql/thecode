<template>
  <div class="page-wrapper">
    <header class="page-hero">
      <div class="page-hero-inner">
        <div class="page-hero-icon">
          <img src="https://img.icons8.com/?size=200&id=scais6KfLeli&format=png&color=ffffff" alt=""/>
        </div>
        <h1>{{ t('gen_title') }}</h1>
        <p class="page-hero-sub">{{ t('gen_subtitle') }}</p>
      </div>
    </header>

    <div class="generator-container fadeIn">
      <div class="generator-card">

        <!-- Données -->
        <fieldset>
          <h2>{{ t('gen_section_data') }}</h2>

          <div class="form-group">
            <label for="id_clef">{{ t('gen_label_key') }}</label>
            <div class="input-with-button">
              <input
                  :type="showPassword ? 'text' : 'password'"
                  v-model="clef"
                  :placeholder="t('gen_placeholder_key')"
                  id="id_clef"
                  required
              />
              <button type="button" class="ghost-btn" @click="togglePassword">
                {{ showPassword ? t('gen_hide') : t('gen_show') }}
              </button>
            </div>
          </div>

          <div class="form-group">
            <label for="id_site">{{ t('gen_label_site') }}</label>
            <input
                type="text"
                v-model="site"
                :placeholder="t('gen_placeholder_site')"
                id="id_site"
                required
            />
          </div>
        </fieldset>

        <!-- Paramètres -->
        <fieldset>
          <h2>{{ t('gen_section_settings') }}</h2>

          <div class="form-group range-group">
            <span>
              <label for="id_longueur" class="no-margin-bottom">{{ t('gen_label_length') }}</label>
              <output>{{ longueur }}</output>
            </span>
            <input
                type="range"
                v-model="longueur"
                min="4"
                max="40"
                step="1"
                id="id_longueur"
            />
          </div>

          <div class="checkbox-group">
            <label class="check-pill">
              <input type="checkbox" v-model="minuscules"/>
              <span>{{ t('gen_lowercase') }}</span>
            </label>
            <label class="check-pill">
              <input type="checkbox" v-model="majuscules"/>
              <span>{{ t('gen_uppercase') }}</span>
            </label>
            <label class="check-pill">
              <input type="checkbox" v-model="symboles"/>
              <span>{{ t('gen_symbols') }}</span>
            </label>
            <label class="check-pill">
              <input type="checkbox" v-model="chiffres"/>
              <span>{{ t('gen_numbers') }}</span>
            </label>
          </div>
        </fieldset>

        <!-- Résultat -->
        <div class="result">
          <h2>{{ t('gen_section_result') }}</h2>
          <input type="text" id="password" v-model="motDePasse" readonly
                 :placeholder="t('gen_placeholder_result')"/>
          <p class="security-line">
            {{ t('gen_security_label') }} :
            <span :style="{ color: couleurSecurite }">{{ niveauSecurite }}</span>
          </p>
          <input type="range" :value="scoreSecurite" min="0" max="252" disabled/>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, ref, watch, computed} from "vue";
import {generatePassword, calculateEntropyBits, getSecurityLevel} from "@/utils";
import {useI18n} from "@/i18n";
import type {TranslationKey} from "@/i18n";

export default defineComponent({
  name: "Generator",
  setup() {
    const {t} = useI18n();

    const clef = ref("");
    const site = ref("");
    const longueur = ref(20);
    const minuscules = ref(true);
    const majuscules = ref(true);
    const symboles = ref(true);
    const chiffres = ref(true);
    const showPassword = ref(false);
    const motDePasse = ref("");

    const scoreSecurite = ref(0);
    const couleurSecurite = ref("");
    const securityKey = ref<TranslationKey>("sec_none");
    const niveauSecurite = computed(() => t(securityKey.value));

    const togglePassword = () => {
      showPassword.value = !showPassword.value;
    };

    const securityKeyFromBits = (bits: number): TranslationKey => {
      if (bits === 0) return "sec_none";
      if (bits < 64) return "sec_veryweak";
      if (bits < 80) return "sec_weak";
      if (bits < 100) return "sec_medium";
      if (bits < 126) return "sec_strong";
      return "sec_verystrong";
    };

    const genererMotDePasse = async () => {
      const bits = calculateEntropyBits(longueur.value, minuscules.value, majuscules.value, symboles.value, chiffres.value);
      const {color} = getSecurityLevel(bits);
      couleurSecurite.value = color;
      scoreSecurite.value = bits;
      securityKey.value = securityKeyFromBits(bits);

      const mdp = await generatePassword(site.value, clef.value, longueur.value, minuscules.value, majuscules.value, symboles.value, chiffres.value);
      motDePasse.value = mdp ?? "";
    };

    watch(
        [clef, site, longueur, minuscules, majuscules, symboles, chiffres],
        genererMotDePasse,
        {immediate: true}
    );

    return {
      t,
      clef,
      site,
      longueur,
      minuscules,
      majuscules,
      symboles,
      chiffres,
      showPassword,
      motDePasse,
      togglePassword,
      scoreSecurite,
      couleurSecurite,
      niveauSecurite,
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

.generator-container {
  display: flex;
  justify-content: center;
  padding: 0 24px 80px;
  margin-top: -50px;
  position: relative;
  z-index: 2;
}

.generator-card {
  width: 100%;
  max-width: 760px;
  padding: 36px;
  border-radius: 22px;
  background: linear-gradient(160deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02));
  border: 1px solid var(--border-soft);
  box-shadow: var(--shadow-strong);
  color: var(--text);
  backdrop-filter: blur(10px);
}

h2 {
  color: var(--c4);
  font-size: 1.05rem;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  margin: 0 0 14px;
}

fieldset {
  border: none;
  margin: 0 0 28px;
  padding: 0;
}

.form-group {
  display: flex;
  flex-direction: column;
  margin-bottom: 16px;
}

label {
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--text-muted);
  margin-bottom: 8px;
}

input[type="text"],
input[type="password"] {
  width: 100%;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid var(--border-soft);
  background: rgba(0, 0, 0, 0.25);
  color: var(--text);
  font-size: 1rem;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
}

input[type="text"]::placeholder,
input[type="password"]::placeholder {
  color: rgba(255, 255, 255, 0.35);
}

input[type="text"]:focus,
input[type="password"]:focus {
  outline: none;
  border-color: var(--c4);
  box-shadow: 0 0 0 4px rgba(166, 77, 121, 0.18);
  background: rgba(0, 0, 0, 0.35);
}

input[type="text"]:read-only {
  background: rgba(0, 0, 0, 0.35);
  font-family: 'JetBrains Mono', 'Menlo', 'Consolas', monospace;
  letter-spacing: 0.5px;
}

.input-with-button {
  display: flex;
  gap: 10px;
}

.input-with-button input {
  flex: 1;
}

.ghost-btn {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--border-soft);
  color: var(--text);
  padding: 0 18px;
  border-radius: 12px;
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease;
}

.ghost-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: var(--c4);
}

.range-group {
  display: block;
}

.range-group span {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.range-group output {
  font-family: 'JetBrains Mono', 'Menlo', 'Consolas', monospace;
  font-weight: 700;
  color: var(--c4);
  font-size: 1.1rem;
}

input[type="range"] {
  width: 100%;
  height: 6px;
  -webkit-appearance: none;
  appearance: none;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 999px;
  outline: none;
  cursor: pointer;
}

input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--c4), var(--c3));
  border: 2px solid #fff;
  box-shadow: 0 4px 10px rgba(166, 77, 121, 0.4);
  cursor: pointer;
}

input[type="range"]::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--c4), var(--c3));
  border: 2px solid #fff;
  cursor: pointer;
}

input[type="range"]:disabled {
  cursor: default;
}

.no-margin-bottom {
  margin-bottom: 0;
}

.checkbox-group {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.check-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 999px;
  border: 1px solid var(--border-soft);
  background: rgba(255, 255, 255, 0.04);
  cursor: pointer;
  font-size: 0.9rem;
  color: var(--text-muted);
  font-weight: 500;
  transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease;
  margin: 0;
}

.check-pill:hover {
  border-color: rgba(166, 77, 121, 0.45);
  color: var(--text);
}

.check-pill input[type="checkbox"] {
  appearance: none;
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 4px;
  border: 1.5px solid var(--border-strong);
  background: transparent;
  cursor: pointer;
  position: relative;
  transition: background 0.2s ease, border-color 0.2s ease;
}

.check-pill input[type="checkbox"]:checked {
  background: linear-gradient(135deg, var(--c4), var(--c3));
  border-color: transparent;
}

.check-pill input[type="checkbox"]:checked::after {
  content: "";
  position: absolute;
  left: 4px;
  top: 0;
  width: 4px;
  height: 9px;
  border: solid #fff;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

.check-pill:has(input:checked) {
  background: rgba(166, 77, 121, 0.15);
  border-color: rgba(166, 77, 121, 0.5);
  color: var(--text);
}

.result {
  margin-top: 8px;
  text-align: center;
}

.result h2 {
  text-align: left;
}

#password {
  text-align: center;
  font-size: 1.05rem;
}

.security-line {
  margin: 16px 0 8px;
  font-size: 0.95rem;
  color: var(--text-muted);
}

.security-line span {
  font-weight: 700;
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
  .generator-card {
    padding: 24px 18px;
    border-radius: 18px;
  }

  .input-with-button {
    flex-direction: column;
  }

  .ghost-btn {
    padding: 10px;
  }

  .page-hero {
    padding: 50px 20px 70px;
  }
}
</style>
