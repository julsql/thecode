import { createRouter, createWebHistory } from 'vue-router';
import type { RouteRecordRaw } from 'vue-router';
import Home from './pages/Home.vue';
import Generate from './pages/Generate.vue';
import Privacy from './pages/Privacy.vue';

const routes: Array<RouteRecordRaw> = [
  { path: '/', component: Home },
  { path: '/generate', component: Generate },
  { path: '/privacy', component: Privacy },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
