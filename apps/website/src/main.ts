import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import { removeLegacyVaultLock } from "./vaultSession";

removeLegacyVaultLock();

createApp(App).use(router).mount("#app");
