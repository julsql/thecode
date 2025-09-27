<template>
  <div class="generator-container fadeIn">
    <div class="generator-card">
      <h1>
        <img class="icon" src="https://img.icons8.com/?size=100&id=scais6KfLeli&format=png&color=000000"
             alt="Sécurisé"/>
        Générateur de mot de passe</h1>

      <!-- Clé + Site -->
      <fieldset>
        <h2>Données</h2>

        <div class="form-group">
          <label for="id_clef">Clef :</label>
          <div class="input-with-button">
            <input
                :type="showPassword ? 'text' : 'password'"
                v-model="clef"
                placeholder="Entrez votre clef"
                id="id_clef"
                required
            />
            <button type="button" @click="togglePassword">
              {{ showPassword ? "Masquer" : "Afficher" }}
            </button>
          </div>
        </div>

        <div class="form-group">
          <label for="id_site">Site :</label>
          <input
              type="text"
              v-model="site"
              placeholder="nom du site"
              id="id_site"
              required
          />
        </div>
      </fieldset>

      <!-- Paramètres -->
      <fieldset>
        <h2>Paramètres du mot de passe</h2>

        <div class="form-group range-group">
                    <span>
                    <label for="id_longueur" class="no-margin-bottom">Longueur :</label>
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
          <input type="checkbox" id="id_minuscules" v-model="minuscules"/>
          <label for="id_minuscules"><span>Minuscules</span></label>
          <input type="checkbox" id="id_majuscules" v-model="majuscules"/>
          <label for="id_majuscules"><span>Majuscules</span></label>
          <input type="checkbox" id="id_symboles" v-model="symboles"/>
          <label for="id_symboles"><span>Symboles</span></label>
          <input type="checkbox" id="id_chiffres" v-model="chiffres"/>
          <label for="id_chiffres"><span>Chiffres</span></label>
        </div>
      </fieldset>

      <!-- Résultat -->
      <div class="result">
        <h2>Mot de passe généré</h2>
        <input type="text" id="password" v-model="motDePasse" readonly
               placeholder="Remplissez les champs pour générer un mot de passe"/>
        <p>Sécurité : <span :style="{ color: couleurSecurite }">{{ niveauSecurite }}</span></p>
        <input type="range" :value="scoreSecurite" min="0" max="252" disabled/>

      </div>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, ref, watch} from "vue";
import {generatePassword, calculateEntropyBits, getSecurityLevel} from "@/utils";

export default defineComponent({
  name: "Generator",
  setup() {
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
    const niveauSecurite = ref("");

    const togglePassword = () => {
      showPassword.value = !showPassword.value;
    };

    const genererMotDePasse = async () => {
      const bits = calculateEntropyBits(longueur.value, minuscules.value, majuscules.value, symboles.value, chiffres.value);
      const {security, color} = getSecurityLevel(bits);
      niveauSecurite.value = security;
      couleurSecurite.value = color;
      scoreSecurite.value = bits;

      const mdp = await generatePassword(site.value, clef.value, longueur.value, minuscules.value, majuscules.value, symboles.value, chiffres.value);
      if (mdp) {
        motDePasse.value = mdp;
      }
    };
    watch(
        [clef, site, longueur, minuscules, majuscules, symboles, chiffres],
        genererMotDePasse,
        {immediate: true} // génère dès l'initialisation
    );

    return {
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
      genererMotDePasse,
      scoreSecurite,
      couleurSecurite,
      niveauSecurite,
    };
  },
});
</script>

<style scoped>
.generator-container {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 40px;
}

.generator-card {
  color: #1a1d1c;
  padding: 30px;
  border-radius: 16px;
  max-width: 800px;
  width: 100%;
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.4);
}

.icon {
  width: 42px;
  height: 42px;
  margin: auto 0;
}

h1 {
  font-size: 2.2rem;
  color: #1A1D1C;
  text-align: center;
  margin-bottom: 50px;
  display: flex;
  gap: 20px;
  justify-content: center;
}

h2 {
  color: #6A1E55;
  margin-bottom: 10px;
}

fieldset {
  border: none;
  margin-bottom: 20px;
}

.form-group {
  display: flex;
  flex-direction: column;
  margin-bottom: 15px;
}

label {
  font-weight: bold;
  margin-bottom: 5px;
}

input[type="text"], input[type="password"] {
  padding: 10px;
  border-radius: 8px;
  border: none;
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.15);
  outline: none;
  background: white;
  color: #2c2f2e;
}

#id_clef {
  width: 100%;
}

.input-with-button {
  display: flex;
  gap: 10px;
}

.range-group {
  display: block;
  align-items: center;
  gap: 10px;
  width: 100%;
}

.range-group span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  white-space: nowrap;
  width: 120px;
}

input[type="range"] {
  flex: 1;
  accent-color: #a64d79;
  cursor: pointer;
}

.range-group input[type="range"] {
  width: calc(100% - 124px);
  height: 9px;
}

.no-margin-bottom {
  margin-bottom: unset;
}

.checkbox-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.checkbox-group input[type="checkbox"] {
  -moz-appearance: none;
  -webkit-appearance: none;
  -ms-appearance: none;
  appearance: none;
  display: block;
  float: left;
  margin-right: -2em;
  opacity: 0;
  width: 1em;
  z-index: -1;
}

input[type="checkbox"] + label {
  text-decoration: none;
  cursor: pointer;
  display: inline-block;
  font-size: 1em;
  font-weight: 300;
  padding-left: 2.4em;
  padding-right: 0.75em;
  position: relative;
  color: #636363;
}

input[type="checkbox"] + label:before {
  content: '';
  display: inline-block;
  font-size: 0.8em;
  height: 2.0625em;
  left: 0;
  line-height: 2em;
  position: absolute;
  text-align: center;
  top: 0;
  width: 2.0625em;
  color: #ffffff;
  font-family: 'Font Awesome 5 Free', sans-serif;
  border-radius: 8px;
  border: solid 1px;
  background: rgba(222, 222, 222, 0.25);
  border-color: #dddddd;
}

input[type="checkbox"]:checked + label:before {
  content: '\f00c';
  border-color: #6a1e55;
  background-color: #6a1e55;
}

label span {
  display: flex;
  margin-top: 4px;
}

.result {
  text-align: center;
  margin-top: 20px;
}

#password {
  width: 300px;
}

button {
  background: #6a1e55;
  border: none;
  cursor: pointer;
  padding: 15px 30px;
  border-radius: 30px;
  font-weight: bold;
  color: #fff;
  text-decoration: none;
  transition: transform 0.2s, box-shadow 0.2s, transform 0.2s, color 0.2s;
}

button:hover {
  background: #3B1C32;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
}

.fadeIn {
  opacity: 0;
  transform: translateY(15px);
  animation: fadeIn 0.6s ease-out forwards;
}

@keyframes fadeIn {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 550px) {
  .generator-card {
    box-shadow: none;
  }

  .generator-container {
    padding: 0;
  }
}
</style>
