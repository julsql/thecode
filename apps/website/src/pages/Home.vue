<template>
  <div class="home-container">

    <header class="hero">
      <div class="hero-content">
        <p class="subtitle fadeIn">Vous oubliez régulièrement vos mots de passe ou vous avez toujours le même&nbsp?</p>
        <h1 class="fadeIn delay-1">Une solution&nbsp: TheCode.</h1>
        <p class="subtitle fadeIn delay-2">Parce que la sécurité informatique est la plus importante.</p>
        <div class="buttons fadeIn delay-3">
          <a class="btn chrome"
             href="https://chromewebstore.google.com/detail/thecode/jeknefpalcipdlnbeboefonmnlejepen" target="_blank">Chrome</a>
          <a class="btn firefox" href="https://addons.mozilla.org/fr/firefox/addon/thecode/" target="_blank">Firefox</a>
          <a class="btn safari" href="https://apps.apple.com/app/thecode-password-manager/id6753169043" target="_blank">Safari</a>
          <a class="btn iphone" href="https://apps.apple.com/app/thecode-password-manager/id6753169043" target="_blank">iPhone</a>
          <a class="btn android" href="https://play.google.com/store/apps/details?id=fr.juliette.thecode&hl=fr"
             target="_blank">Android</a>
        </div>
      </div>
      <div class="hero-illustration">
        <img :src="Logo" alt="Browser Illustration"/>
      </div>
    </header>

    <!-- Features Section -->
    <section class="features">
      <h2>Pourquoi choisir notre extension&nbsp?</h2>
      <div class="feature-list">
        <div class="feature fadeIn">
          <img src="https://img.icons8.com/?size=500&id=13534&format=png&color=000000" alt="Sécurisé"/>
          <h3>Sécurité</h3>
          <p>Des mots de passe uniques, propres à chaque site web et sans stockage.</p>
          <p>Nous respectons bien sûr votre vie privée et ne collectons aucune donnée personnelle.</p>
        </div>
        <div class="feature fadeIn delay-1">
          <img src="https://img.icons8.com/?size=500&id=pcD8bVCCf7dC&format=png&color=000000" alt="Synchronisation"/>
          <h3>Mémorisation</h3>
          <p>Plus besoin de mémoriser tous vos mots de passe ou de les stocker.</p>
          <p>Avec une seule clef, TheCode génèrera le même mot de passe pour chaque site web.</p>
        </div>
        <div class="feature fadeIn delay-2">
          <img src="https://img.icons8.com/?size=500&id=GbRPcEhEje0f&format=png&color=000000" alt="Personnalisable"/>
          <h3>Multi plateforme</h3>
          <p>Profitez d'une expérience complète avec une extension qui vous suit partout.</p>
          <p>De votre smartphone à votre ordinateur, TheCode est disponible.</p>
        </div>
        <div class="feature fadeIn delay-3">
          <img src="https://img.icons8.com/?size=500&id=13814&format=png&color=000000" alt="Rapide"/>
          <h3>Hors Ligne</h3>
          <p>Même sans connexion internet, les applications mobiles sont disponibles h24.</p>
        </div>
      </div>
    </section>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import Logo from '@/assets/logo.png';

export default defineComponent({
  name: 'App',
  setup() {
    const year = new Date().getFullYear();
    return {Logo, year};
  },
});
</script>

<style scoped>
.home-container {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  color: #1A1D1C;
  padding: 0;
  margin: 0;
}

.hero {
  display: flex;
  flex-wrap: wrap-reverse;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #6a11cb, #3B1C32);
  color: #fff;
  padding: 80px 80px;
  grid-column-gap: 80px;
}

.hero-content {
  flex: 1;
  text-align: center;
}

.hero h1 {
  font-size: 3rem;
  margin-bottom: 20px;
}

.subtitle {
  font-size: 1.5rem;
  margin-bottom: 40px;
}

.hero-illustration img {
  width: 80vw;
  max-width: 300px;
  animation: float 3s ease-in-out infinite;
  transition: transform 0.2s, filter 0.2s;
}

.hero-illustration img:hover {
  transform: translateY(-5px);
  filter: drop-shadow(0 0 50px rgba(0, 0, 0, 0.3));
}

.buttons {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 15px;
}

.btn {
  padding: 15px 30px;
  border-radius: 30px;
  font-weight: bold;
  color: #fff;
  text-decoration: none;
  transition: transform 0.2s, box-shadow 0.2s;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
  background-color: #1A1D1C;
}

.btn:hover {
  transform: translateY(-5px);
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
}

.features {
  text-align: center;
  padding: 60px 20px;
}

.features h2 {
  font-size: 2.5rem;
  margin-bottom: 40px;
  color: #1A1D1C;
}

.feature-list {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 40px;
}

.feature {
  background: #f0f4ff;
  padding: 30px;
  border-radius: 20px;
  max-width: 250px;
  transition: transform 0.3s, box-shadow 0.3s;
}

.feature:hover {
  transform: translateY(-10px);
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.15);
}

.feature h3 {
  font-size: 1.5rem;
  margin-bottom: 10px;
}

.feature p {
  font-size: 1rem;
  color: #1A1D1C;
}

.feature img {
  width: 96px;
}

@keyframes float {
  0%, 100% {
    transform: translateY(0px);
  }
  50% {
    transform: translateY(-15px);
  }
}

.fadeIn {
  opacity: 0;
  transform: translateY(20px);
  animation: fadeInAnim 1s forwards;
}

.fadeIn.delay-1 {
  animation-delay: 0.5s;
}

.fadeIn.delay-2 {
  animation-delay: 1s;
}

.fadeIn.delay-3 {
  animation-delay: 1.5s;
}

@keyframes fadeInAnim {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 900px) {
  .hero {
    flex-direction: column-reverse;
    padding: 60px 20px;
  }

  .feature-list {
    flex-direction: column;
    align-items: center;
  }
}
</style>
