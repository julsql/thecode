<template>
  <div class="app">
    <!-- HEADER -->
    <transition name="menu-fade">
    <header class="site-header" :class="{ 'is-open': isOpen }">
      <div class="container header-inner">
        <div class="brand" :class="{ 'is-open': isOpen }">
          <a href="/">
            <img :src="Logo" alt="Logo" class="brand-logo"/>
            <span class="brand-title">TheCode</span>
          </a>
        </div>

        <nav aria-label="large nav" class="large_nav">
          <router-link to="/" exact @click="closeMenu">Accueil</router-link>
          <router-link to="/generate" @click="closeMenu">Générateur</router-link>
          <router-link to="/privacy" @click="closeMenu">Confidentialité</router-link>
        </nav>


          <div class="hamburger-menu">
            <div v-if="isOpen">
              <nav aria-label="small nav" class="small_nav">
                <router-link to="/" exact @click="closeMenu">Accueil</router-link>
                <router-link to="/generate" @click="closeMenu">Générateur</router-link>
                <router-link to="/privacy" @click="closeMenu">Confidentialité</router-link>
              </nav>
            </div>
            <button v-if="!isOpen" id="open-btn" @click="toggleMenu">&#9776;</button>
            <button v-if="isOpen" id="close-btn" @click="closeMenu">✕</button>
          </div>
      </div>
    </header>
    </transition>

    <!-- MAIN CONTENT -->
    <main class="main">
      <router-view/>
    </main>

    <!-- FOOTER -->
    <footer class="site-footer">
      <p>© {{ year }} TheCode — Sécurité et fiabilité - Icons by Icons8</p>
    </footer>
  </div>
</template>

<script lang="ts">
import {defineComponent, ref} from 'vue';
import Logo from '@/assets/logo.svg';

export default defineComponent({
  name: 'App',
  setup() {
    const year = new Date().getFullYear();
    const isOpen = ref(false);

    const toggleMenu = () => {
      console.log("toggle");
      isOpen.value = !isOpen.value;
    };

    const closeMenu = () => {
      isOpen.value = false;
    };

    return {Logo, year, isOpen, toggleMenu, closeMenu};
  },
});
</script>

<style scoped>
:root {
  --c1: #1A1D1C;
  --c2: #3B1C32;
  --c3: #6A1E55;
  --c4: #A64D79;
  --text: #f8f8f8;
}

.app {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: var(--c1);
  color: var(--text);
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

.site-header {
  background: rgba(245, 245, 247, .8);
  padding: 20px 0;
  position: sticky;
  top: 0;
  z-index: 100;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.4);
  backdrop-filter: saturate(180%) blur(20px);
  -webkit-backdrop-filter: saturate(180%) blur(20px);
  transition: max-height 0.4s ease, opacity 0.4s ease;
  max-height: 25px;
  height: 100vh;
  overflow: hidden;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
}

.header-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  transition: transform 0.2s ease;
}

.brand:hover {
  transform: scale(1.05);
}

.brand a {
  display: flex;
  color: black;
  text-decoration: none;
}

.brand-logo {
  height: 25px;
  width: 25px;
}

.brand-title {
  font-weight: bold;
  font-size: 1.3rem;
  margin: auto auto auto 20px;
}

.large_nav a {
  margin-left: 25px;
  text-decoration: none;
  font-weight: 500;
  padding-bottom: 4px;
  color: black;
}

.large_nav a:hover, .small_nav a:hover {
  color: #6A1E55;
}

.large_nav .router-link-exact-active, .small_nav .router-link-exact-active {
  font-weight: bold;
}

.small_nav {
  position: absolute;
  display: grid;
  left: 0;
  top: 50px;
  width: 100vw;
}

.small_nav nav {
  display: flex;
  flex-direction: column;
  gap: 20px;
  width: 100%;
  padding: 20px;
}

.small_nav a {
  margin: 20px;
  padding: 10px 0;
  color: var(--text);
  font-size: 1.5rem;
  text-decoration: none;
  font-weight: 400;
  transition: color 0.4s;
}

.main {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.site-footer {
  background: var(--c2);
  text-align: center;
  padding: 15px 0;
  font-size: 0.85rem;
  color: #ddd;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

button {
  position: absolute;
  top: 10px;
  right: 25px;
  background: none;
  border: none;
  font-size: 2rem;
  color: var(--text);
  cursor: pointer;
  display: none;
}

.hamburger-menu {
  display: none;
}

/* TRANSITION ANIMATION */
.menu-fade-enter-active,
.menu-fade-leave-active {
  transition: opacity 0.4s ease;
}

.menu-fade-enter-from,
.menu-fade-leave-to {
  opacity: 0;
}

@media (max-width: 550px) {
  .site-header.is-open {
    position: fixed;
    max-height: 100vh;
    width: 100vw;
  }

  .large_nav {
    display: none;
  }

  .hamburger-menu {
    display: flex;
  }

  button {
    display: block;
  }

  .brand:is(.is-open) {
    display: none;
  }
}
</style>
