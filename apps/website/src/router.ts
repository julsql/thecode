import { createRouter, createWebHistory } from "vue-router";
import type { RouteRecordRaw } from "vue-router";
import Home from "./pages/Home.vue";
import Legacy from "@/pages/Legacy.vue";
import Generate from "./pages/Generate.vue";
import Privacy from "./pages/Privacy.vue";
import About from "./pages/About.vue";
import Tutorial from "./pages/Tutorial.vue";
import Contact from "./pages/Contact.vue";
import Account from "./pages/Account.vue";
import AccountVerify from "./pages/AccountVerify.vue";
import Pricing from "./pages/Pricing.vue";
import { DEFAULT_LANG } from "./i18n/translations";

const routes: Array<RouteRecordRaw> = [
  { path: "/", redirect: `/${DEFAULT_LANG}` },
  { path: "/generate", redirect: `/${DEFAULT_LANG}/generate` },
  { path: "/privacy", redirect: `/${DEFAULT_LANG}/privacy` },
  { path: "/about", redirect: `/${DEFAULT_LANG}/about` },
  { path: "/tutorial", redirect: `/${DEFAULT_LANG}/tutorial` },
  { path: "/contact", redirect: `/${DEFAULT_LANG}/contact` },
  { path: "/account", redirect: `/${DEFAULT_LANG}/account` },
  { path: "/pricing", redirect: `/${DEFAULT_LANG}/pricing` },
  // Page de secours pour l'ancien algorithme. Volontairement accessible sans
  // prefixe de langue : elle doit rester atteignable par une URL notee il y a
  // des annees.
  { path: "/legacy", component: Legacy },
  {
    path: "/:lang(en|fr)",
    children: [
      { path: "", component: Home },
      { path: "legacy", component: Legacy },
      { path: "generate", component: Generate },
      { path: "privacy", component: Privacy },
      { path: "about", component: About },
      { path: "tutorial", component: Tutorial },
      { path: "contact", component: Contact },
      { path: "account", component: Account },
      // Le lien de verification arrive par courrier : il doit tomber sur une
      // page qui confirme toute seule, sans demander de se connecter d'abord.
      { path: "account/verify", component: AccountVerify },
      { path: "pricing", component: Pricing },
    ],
  },
  { path: "/:pathMatch(.*)*", redirect: `/${DEFAULT_LANG}` },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 };
  },
});

export default router;
