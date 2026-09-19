<template>
  <div class="page-wrapper">
    <div class="reset-card fadeIn">
      <h1>{{ t("acc_reset_title") }}</h1>
      <p class="reset-lead">{{ t("acc_reset_lead") }}</p>

      <template v-if="!done">
        <div class="field-row">
          <input
            id="reset_password"
            v-model="password"
            type="password"
            :placeholder="t('acc_password_new')"
            autocomplete="new-password"
          />
        </div>
        <div class="field-row">
          <input
            id="reset_password_confirm"
            v-model="passwordConfirm"
            type="password"
            :placeholder="t('acc_password_confirm')"
            autocomplete="new-password"
          />
        </div>
        <div class="panel-actions">
          <button type="button" class="ghost-btn primary" @click="apply">
            {{ t("acc_reset_apply") }}
          </button>
        </div>
      </template>

      <router-link v-else class="ghost-btn primary reset-cta" :to="localePath('account')">
        {{ t("acc_title") }}
      </router-link>

      <p v-if="message" class="hint">{{ message }}</p>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "@/i18n";
import { resetPassword } from "@/account";
import { DEFAULT_ENDPOINT, saveSession } from "@/sync";

export default defineComponent({
  name: "AccountReset",
  setup() {
    const { t, localePath } = useI18n();
    const route = useRoute();

    const password = ref("");
    const passwordConfirm = ref("");
    const message = ref("");
    const done = ref(false);

    async function apply() {
      const token = String(route.query.token ?? "");
      if (!token) {
        message.value = t("acc_reset_failed");
        return;
      }
      if (password.value.length < 12) {
        message.value = t("acc_password_short");
        return;
      }
      if (password.value !== passwordConfirm.value) {
        message.value = t("acc_password_mismatch");
        return;
      }

      try {
        // La réinitialisation ouvre une session sur cet appareil : sans elle,
        // on repartirait vers le formulaire de connexion juste après avoir
        // prouvé son identité.
        saveSession(await resetPassword(DEFAULT_ENDPOINT, token, password.value));
        password.value = "";
        passwordConfirm.value = "";
        done.value = true;
        message.value = t("acc_reset_done");
      } catch {
        // Le détail n'apprendrait rien d'utile : un lien mort est un lien
        // mort, et la suite est la même dans tous les cas.
        message.value = t("acc_reset_failed");
      }
    }

    return { t, localePath, password, passwordConfirm, message, done, apply };
  },
});
</script>

<style scoped>
.page-wrapper {
  display: flex;
  justify-content: center;
  padding: 80px 24px;
}

.reset-card {
  width: min(520px, 100%);
  background: var(--surface);
  border: 1px solid var(--border-soft);
  border-radius: 18px;
  padding: 32px 28px;
  box-shadow: var(--shadow-soft);
}

.reset-card h1 {
  margin: 0 0 12px;
  font-size: 1.4rem;
}

.reset-lead {
  margin: 0 0 22px;
  color: var(--text-muted);
  line-height: 1.6;
}

.reset-cta {
  display: inline-block;
  padding: 12px 20px;
  text-decoration: none;
}
</style>
