import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import { removeLegacyVaultLock } from "./vaultSession";
import { installAnalytics } from "./analytics";

removeLegacyVaultLock();
if (import.meta.env.PROD) installAnalytics(router);

createApp(App).use(router).mount("#app");
