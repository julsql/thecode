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
import AccountReset from "./pages/AccountReset.vue";
import Pricing from "./pages/Pricing.vue";
import Legal from "./pages/Legal.vue";
import { identityPublished } from "@/legal/identity";
import Terms from "./pages/Terms.vue";
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
  { path: "/legal", redirect: `/${DEFAULT_LANG}/legal` },
  { path: "/terms", redirect: `/${DEFAULT_LANG}/terms` },
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
      // Le lien de reinitialisation arrive lui aussi par courrier : il tombe
      // sur une page qui ne demande que le nouveau mot de passe.
      { path: "account/reset", component: AccountReset },
      { path: "pricing", component: Pricing },
      // Tant que l'identité de l'éditrice n'est pas renseignée, l'URL directe
      // mène à la politique de confidentialité plutôt qu'à une page à trous.
      // La page et son composant restent : une seule valeur les rallume.
      {
        path: "legal",
        component: Legal,
        beforeEnter: (to) =>
          identityPublished() ? true : { path: `/${to.params.lang || "en"}/privacy` },
      },
      { path: "terms", component: Terms },
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
