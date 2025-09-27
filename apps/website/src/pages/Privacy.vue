<template>
  <div class="privacy-container fadeIn">
    <h1>
      <img class="icon" src="https://img.icons8.com/?size=100&id=12324&format=png&color=000000" alt="Sécurisé"/>
      Politique de confidentialité</h1>
    <h2><i>Dernière mise à jour : 28/09/2025</i></h2>

    <p>Merci d’utiliser <b>TheCode</b>.</p>

    <p>
      Nous accordons une grande importance à la confidentialité de nos utilisateurs.
      Cette application est conçue pour respecter votre vie privée.
    </p>

    <p><b>C’est pourquoi :</b></p>

    <p class="highlight">
      Nous ne collectons, ne stockons, ni ne partageons aucune donnée personnelle.<br/>
      L'application ne demande aucun accès à vos contacts, caméra, microphone, position ou fichiers.<br/>
      Aucun identifiant personnel ou comportement d'utilisation n’est enregistré ou analysé.
    </p>

    <section>
      <h2>Données collectées</h2>
      <p>Aucune. L’application ne collecte aucune information personnelle identifiable, ni aucune donnée
        technique.</p>
    </section>

    <section>
      <h2>Partage d'informations</h2>
      <p>Puisque nous ne collectons aucune donnée, nous ne partageons aucune donnée avec des tiers.</p>
    </section>

    <section>
      <h2>Cookies et technologies similaires</h2>
      <p>L’application ne contient pas de cookies ou technologies similaires.</p>
    </section>

    <section>
      <h2>Services tiers</h2>
      <p>L’application n’utilise aucun service tiers susceptible de collecter des données
        (par exemple : Google Analytics, Firebase, etc.).</p>
    </section>

    <section>
      <h2>Contact</h2>
      <p>
        Si vous avez des questions concernant cette politique de confidentialité, vous pouvez nous contacter à :
        <br/>
        <a class="contact-link" href="mailto:thecodedebonofactory@gmail.com">
          📧 thecodedebonofactory@gmail.com
        </a>
      </p>
    </section>
  </div>
</template>

<script lang="ts">
export default {};
</script>

<style scoped>
.privacy-container {
  max-width: 800px;
  margin: 40px auto;
  padding: 40px;
  color: #1A1D1C;
  border-radius: 16px;
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
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

.highlight {
  background: rgba(166, 77, 121, 0.1);
  padding: 15px;
  border-left: 4px solid #A64D79;
  border-radius: 8px;
}

section {
  padding: 15px 0;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.contact-link {
  color: #3B1C32;
  text-decoration: none;
  font-weight: bold;
}

.contact-link:hover {
  text-decoration: underline;
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
  .privacy-container {
    box-shadow: none;
    margin: auto;
    padding: 10px;
  }
}
</style>
