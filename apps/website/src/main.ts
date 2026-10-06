import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import { installKeyKeeper } from "./masterKey";
import { removeLegacyVaultLock } from "./vaultSession";

removeLegacyVaultLock();
installKeyKeeper();

createApp(App).use(router).mount("#app");
