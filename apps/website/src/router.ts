import { createRouter, createWebHistory } from 'vue-router';
import type { RouteRecordRaw } from 'vue-router';
import Home from './pages/Home.vue';
import Generate from './pages/Generate.vue';
import Privacy from './pages/Privacy.vue';
import About from './pages/About.vue';
import Tutorial from './pages/Tutorial.vue';
import Contact from './pages/Contact.vue';
import { DEFAULT_LANG } from './i18n/translations';

const routes: Array<RouteRecordRaw> = [
  { path: '/', redirect: `/${DEFAULT_LANG}` },
  { path: '/generate', redirect: `/${DEFAULT_LANG}/generate` },
  { path: '/privacy', redirect: `/${DEFAULT_LANG}/privacy` },
  { path: '/about', redirect: `/${DEFAULT_LANG}/about` },
  { path: '/tutorial', redirect: `/${DEFAULT_LANG}/tutorial` },
  { path: '/contact', redirect: `/${DEFAULT_LANG}/contact` },
  {
    path: '/:lang(en|fr)',
    children: [
      { path: '', component: Home },
      { path: 'generate', component: Generate },
      { path: 'privacy', component: Privacy },
      { path: 'about', component: About },
      { path: 'tutorial', component: Tutorial },
      { path: 'contact', component: Contact },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: `/${DEFAULT_LANG}` },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 };
  },
});

export default router;
