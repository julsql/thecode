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
          <button class="hamburger">&#9776;</button>
          <nav class="nav">
            <router-link to="/" exact>Accueil</router-link>
            <router-link to="/generate">Générateur</router-link>
            <router-link to="/privacy">Confidentialité</router-link>
          </nav>
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
  transition: color 0.2s, border-bottom 0.2s;
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
    position: absolute;
    top: 100%;
    right: 0;
    flex-direction: column;
    background: white;
    padding: 10px;
    border-radius: 8px;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
    z-index: 999;
    width: 130px;
  }

  .hamburger-menu .nav {
    display: none;
  }

  .hamburger-menu:hover .nav {
    display: flex;
  }

  .nav a {
    margin: 5px 0;
    text-align: end;
  }
}
</style>
