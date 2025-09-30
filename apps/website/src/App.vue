<template>
  <div class="app">
    <!-- HEADER -->
    <header class="site-header">
      <div class="container header-inner">
        <div class="brand">
          <a href="/">
            <img :src="Logo" alt="Logo" class="brand-logo"/>
            <span class="brand-title">TheCode</span>
          </a>
        </div>

        <div class="hamburger-menu">
          <button class="hamburger" @click="toggleMenu">&#9776;</button>
          <transition name="menu-fade">
            <div v-if="isOpen" class="mobile-nav">
              <button class="hamburger close-btn" @click="closeMenu">✕</button>
              <nav aria-label="Phone Navigation">
                <router-link to="/" exact @click="closeMenu">Accueil</router-link>
                <router-link to="/generate" @click="closeMenu">Générateur</router-link>
                <router-link to="/privacy" @click="closeMenu">Confidentialité</router-link>
              </nav>
            </div>
          </transition>
          <div class="nav">
            <nav aria-label="Big Navigation">
              <router-link to="/" exact @click="closeMenu">Accueil</router-link>
              <router-link to="/generate" @click="closeMenu">Générateur</router-link>
              <router-link to="/privacy" @click="closeMenu">Confidentialité</router-link>
            </nav>
          </div>
        </div>
      </div>
    </header>

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

.nav a {
  margin-left: 25px;
  text-decoration: none;
  font-weight: 500;
  padding-bottom: 4px;
  color: black;
}

.nav a:hover {
  color: #6A1E55;
}

.nav .router-link-exact-active {
  font-weight: bold;
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

.hamburger {
  display: none;
}

.mobile-nav {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(245, 245, 247, 1);
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 30px;
  z-index: 2000;
  transform: translateY(0);
}

.mobile-nav nav {
  display: flex;
  flex-direction: column;
  gap: 20px;
  width: 100%;
  padding: 20px;
}

.mobile-nav a {
  color: var(--text);
  font-size: 1.5rem;
  text-decoration: none;
  margin: 20px;
  font-weight: 400;
  transition: color 0.2s, font-weight 0.4s;
}

.mobile-nav a:hover {
  color: #6A1E55;
  font-weight: 700;
}

.close-btn {
  position: absolute;
  top: 20px;
  right: 25px;
  background: none;
  border: none;
  font-size: 2rem;
  color: var(--text);
  cursor: pointer;
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
  .hamburger-menu {
    position: relative;
    display: inline-block;
  }

  .hamburger {
    font-size: 2rem;
    background: none;
    border: none;
    color: var(--c3);
    cursor: pointer;
    display: block;
  }

  .nav {
    display: none;
  }

  .mobile-nav {
    display: flex;
  }
}
</style>
