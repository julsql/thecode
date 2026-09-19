<template>
  <div class="page-wrapper">
    <div class="verify-card fadeIn">
      <h1>{{ t("acc_verify_title") }}</h1>
      <p class="verify-state">{{ stateMessage }}</p>
      <router-link class="ghost-btn primary verify-cta" :to="localePath('account')">
        {{ t("acc_title") }}
      </router-link>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "@/i18n";
import { verifyEmail } from "@/account";
import { DEFAULT_ENDPOINT } from "@/sync";

export default defineComponent({
  name: "AccountVerify",
  setup() {
    const { t, localePath } = useI18n();
    const route = useRoute();
    const stateMessage = ref("");

    onMounted(async () => {
      const token = String(route.query.token ?? "");
      if (!token) {
        stateMessage.value = t("acc_verify_failed");
        return;
      }

      stateMessage.value = t("acc_verify_working");
      try {
        await verifyEmail(DEFAULT_ENDPOINT, token);
        stateMessage.value = t("acc_verify_ok");
      } catch {
        // Le détail n'apprendrait rien d'utile : un lien mort est un lien
        // mort, et la suite est la même dans tous les cas.
        stateMessage.value = t("acc_verify_failed");
      }
    });

    return { t, localePath, stateMessage };
  },
});
</script>

<style scoped>
.page-wrapper {
  display: flex;
  justify-content: center;
  padding: 80px 24px;
}

.verify-card {
  width: min(520px, 100%);
  background: var(--surface);
  border: 1px solid var(--border-soft);
  border-radius: 18px;
  padding: 32px 28px;
  text-align: center;
  box-shadow: var(--shadow-soft);
}

.verify-card h1 {
  margin: 0 0 14px;
  font-size: 1.4rem;
}

.verify-state {
  margin: 0 0 22px;
  color: var(--text-muted);
  line-height: 1.6;
}

.verify-cta {
  display: inline-block;
  padding: 12px 20px;
  text-decoration: none;
}
</style>
