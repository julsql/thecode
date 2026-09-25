<template>
  <div class="page-wrapper">
    <header class="page-hero">
      <div class="page-hero-inner">
        <h1>{{ t("vault_title") }}</h1>
        <p class="page-hero-sub">{{ t("vault_page_lead") }}</p>
      </div>
    </header>

    <div class="content-container fadeIn">
      <div class="vault-card" :aria-busy="busy">
        <!-- Deux zones toujours présentes : une région live ajoutée au moment
             du message n'est pas annoncée par tous les lecteurs d'écran. -->
        <p class="hint status" role="status" aria-live="polite">{{ status }}</p>
        <p class="error" role="alert">{{ error }}</p>

        <!-- Première ouverture : création obligatoire du mot de passe. -->
        <form v-if="view === 'setup'" novalidate @submit.prevent="onCreate">
          <h2 ref="heading" tabindex="-1" class="panel-title">{{ t("vault_setup_title") }}</h2>
          <p class="panel-lead">{{ t("vault_setup_lead") }}</p>
          <div class="form-field">
            <label for="vault_new">{{ t("vault_password") }}</label>
            <input
              id="vault_new"
              v-model="password"
              type="password"
              autocomplete="new-password"
              aria-describedby="vault_new_hint"
              :aria-invalid="errorField === 'password'"
            />
            <p id="vault_new_hint" class="hint">{{ t("vault_password_hint") }}</p>
          </div>
          <div class="form-field">
            <label for="vault_new_confirm">{{ t("vault_password_confirm") }}</label>
            <input
              id="vault_new_confirm"
              v-model="passwordConfirm"
              type="password"
              autocomplete="new-password"
              :aria-invalid="errorField === 'confirm'"
            />
          </div>
          <div class="panel-actions">
            <button type="submit" class="ghost-btn primary">{{ t("vault_setup_btn") }}</button>
          </div>
        </form>

        <!-- Verrouillé : le mot de passe, ou l'effacement si on l'a oublié. -->
        <template v-else-if="view === 'locked'">
          <section v-if="confirmingForget" aria-labelledby="vaultForgetTitle" class="confirm-box">
            <h2 id="vaultForgetTitle" ref="heading" tabindex="-1" class="panel-title">
              {{ t("vault_forgot_title") }}
            </h2>
            <p class="panel-lead">{{ t("vault_forgot_lead") }}</p>
            <div class="panel-actions">
              <button type="button" class="ghost-btn danger" @click="onForget">
                {{ t("vault_forgot_confirm") }}
              </button>
              <button type="button" class="ghost-btn" @click="cancelForget">
                {{ t("vault_cancel") }}
              </button>
            </div>
          </section>

          <form v-else novalidate @submit.prevent="onUnlock">
            <h2 ref="heading" tabindex="-1" class="panel-title">{{ t("vault_locked_title") }}</h2>
            <div class="form-field">
              <label for="vault_unlock">{{ t("vault_password") }}</label>
              <input
                id="vault_unlock"
                ref="unlockInput"
                v-model="password"
                type="password"
                autocomplete="current-password"
                :aria-invalid="errorField === 'password'"
              />
            </div>
            <div class="panel-actions">
              <button type="submit" class="ghost-btn primary">{{ t("vault_unlock_btn") }}</button>
              <button type="button" class="link-btn" @click="askForget">
                {{ t("vault_forgot") }}
              </button>
            </div>
          </form>
        </template>

        <!-- Déverrouillé : liste, détail, changement de mot de passe. -->
        <template v-else>
          <div class="toolbar">
            <button type="button" class="ghost-btn small" @click="onLock">
              {{ t("vault_lock_btn") }}
            </button>
          </div>

          <section v-if="!selected" aria-labelledby="vaultListTitle">
            <h2 id="vaultListTitle" ref="heading" tabindex="-1" class="panel-title">
              {{ t("vault_list_title") }}
            </h2>
            <p v-if="!entries.length" class="panel-lead">{{ t("vault_empty") }}</p>
            <ul v-else class="entry-list">
              <li v-for="entry in entries" :key="entry.id">
                <button type="button" class="entry-btn" @click="openEntry(entry.id)">
                  <span class="entry-name">{{ entry.label || entry.siteKey }}</span>
                  <span class="entry-meta">
                    {{ entry.login || t("vault_no_login") }} · {{ entry.domains.join(", ") }}
                  </span>
                </button>
              </li>
            </ul>

            <section class="panel" aria-labelledby="vaultChangeTitle">
              <h3 id="vaultChangeTitle" class="panel-title">{{ t("vault_change_title") }}</h3>
              <form novalidate @submit.prevent="onChange">
                <div class="form-field">
                  <label for="vault_current">{{ t("vault_change_current") }}</label>
                  <input
                    id="vault_current"
                    v-model="current"
                    type="password"
                    autocomplete="current-password"
                  />
                </div>
                <div class="form-field">
                  <label for="vault_next">{{ t("vault_change_new") }}</label>
                  <input
                    id="vault_next"
                    v-model="password"
                    type="password"
                    autocomplete="new-password"
                    aria-describedby="vault_next_hint"
                  />
                  <p id="vault_next_hint" class="hint">{{ t("vault_password_hint") }}</p>
                </div>
                <div class="form-field">
                  <label for="vault_next_confirm">{{ t("vault_change_confirm") }}</label>
                  <input
                    id="vault_next_confirm"
                    v-model="passwordConfirm"
                    type="password"
                    autocomplete="new-password"
                  />
                </div>
                <div class="panel-actions">
                  <button type="submit" class="ghost-btn">{{ t("vault_change_btn") }}</button>
                </div>
              </form>
            </section>
          </section>

          <section v-else aria-labelledby="vaultDetailTitle">
            <button type="button" class="link-btn" @click="closeEntry">
              ← {{ t("vault_detail_back") }}
            </button>
            <h2 id="vaultDetailTitle" ref="heading" tabindex="-1" class="panel-title detail-title">
              {{ selected.label || selected.siteKey }}
            </h2>

            <dl class="detail">
              <dt>{{ t("vault_f_sitekey") }}</dt>
              <dd>{{ selected.siteKey }}</dd>
              <dt>{{ t("vault_f_domains") }}</dt>
              <dd>{{ selected.domains.join(", ") }}</dd>
              <dt>{{ t("vault_f_login") }}</dt>
              <dd>{{ selected.login || t("vault_no_login") }}</dd>
              <dt>{{ t("vault_f_length") }}</dt>
              <dd>{{ selected.length }}</dd>
              <dt>{{ t("vault_f_charset") }}</dt>
              <dd>{{ charsetText(selected) }}</dd>
              <dt>{{ t("vault_f_counter") }}</dt>
              <dd>{{ selected.counter }}</dd>
              <template v-if="selected.createdAt">
                <dt>{{ t("vault_f_created") }}</dt>
                <dd>
                  <time :datetime="selected.createdAt">{{ formatDate(selected.createdAt) }}</time>
                </dd>
              </template>
              <dt>{{ t("vault_f_updated") }}</dt>
              <dd>
                <time :datetime="selected.updatedAt">{{ formatDate(selected.updatedAt) }}</time>
              </dd>
            </dl>

            <!-- Renouveler : la seule action qui change un mot de passe déjà
                 en service. Les deux côte à côte avant d'écrire quoi que ce
                 soit. -->
            <section class="panel" aria-labelledby="vaultRenewTitle">
              <h3 id="vaultRenewTitle" class="panel-title">{{ t("vault_renew_title") }}</h3>
              <p class="panel-lead">{{ t("vault_renew_lead") }}</p>
              <form v-if="!pending" novalidate @submit.prevent="onProposeRenew">
                <div class="form-field">
                  <label for="vault_clef">{{ t("vault_renew_key") }}</label>
                  <input id="vault_clef" v-model="clef" type="password" autocomplete="off" />
                </div>
                <!-- Jamais désactivé : c'est le clic qui dit ce que l'offre
                     complète apporte, et où l'obtenir. -->
                <div class="panel-actions">
                  <button type="submit" class="ghost-btn">{{ t("vault_renew") }}</button>
                </div>
                <p v-if="!renewAllowed" class="hint">
                  {{ t("gen_renew_paid") }}
                  <router-link :to="localePath('pricing')">{{ t("nav_pricing") }}</router-link>
                </p>
              </form>
              <div v-else class="change-box">
                <p class="hint">{{ t("vault_current") }}</p>
                <p>
                  <code>{{ pending.before }}</code>
                </p>
                <p class="hint">{{ t("vault_new") }}</p>
                <p>
                  <code>{{ pending.after }}</code>
                </p>
                <p class="hint">{{ t("vault_change_hint") }}</p>
                <div class="panel-actions">
                  <button
                    ref="renewConfirm"
                    type="button"
                    class="ghost-btn primary"
                    @click="onApplyRenew"
                  >
                    {{ t("vault_confirm") }}
                  </button>
                  <button type="button" class="ghost-btn" @click="pending = null">
                    {{ t("vault_cancel") }}
                  </button>
                </div>
              </div>
            </section>

            <section class="panel" aria-labelledby="vaultDeleteTitle">
              <h3 id="vaultDeleteTitle" class="panel-title">
                {{ confirmingDelete ? t("vault_delete_title") : t("vault_delete") }}
              </h3>
              <template v-if="confirmingDelete">
                <p class="panel-lead">{{ t("vault_delete_lead") }}</p>
                <div class="panel-actions">
                  <button
                    ref="deleteConfirm"
                    type="button"
                    class="ghost-btn danger"
                    @click="onDelete"
                  >
                    {{ t("vault_delete_confirm") }}
                  </button>
                  <button type="button" class="ghost-btn" @click="confirmingDelete = false">
                    {{ t("vault_cancel") }}
                  </button>
                </div>
              </template>
              <div v-else class="panel-actions">
                <button type="button" class="ghost-btn danger" @click="askDelete">
                  {{ t("vault_delete") }}
                </button>
              </div>
            </section>
          </section>
        </template>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, nextTick, onMounted, ref } from "vue";
import { useI18n } from "@/i18n";
import type { TranslationKey } from "@/i18n";
import { isPaidPlan, refreshPlan } from "@/account";
import { loadSession } from "@/sync";
import { liveEntries, loadVault, saveVault, tombstoneEntry, type VaultEntry } from "@/vault";
import { changeLock, createLock, forgetLock, hasLock, LockError, verifyLock } from "@/vaultLock";
import { applyRenewal, proposeRenewal, type RenewProposal } from "@/renew";

type View = "setup" | "locked" | "unlocked";

const ERROR_KEYS: Record<string, TranslationKey> = {
  "too-short": "vault_err_too_short",
  mismatch: "vault_err_mismatch",
  "wrong-password": "vault_err_wrong",
  storage: "vault_err_storage",
};

export default defineComponent({
  name: "Vault",
  setup() {
    const { t, lang, localePath } = useI18n();

    /**
     * État du verrou, en mémoire seulement : quitter l'écran ou recharger
     * l'onglet reverrouille. Pas de déverrouillage mémorisé.
     */
    const view = ref<View>(hasLock() ? "locked" : "setup");
    const password = ref("");
    const passwordConfirm = ref("");
    const current = ref("");
    const status = ref("");
    const error = ref("");
    const errorField = ref<"" | "password" | "confirm">("");
    const busy = ref(false);
    const confirmingForget = ref(false);

    const entries = ref<VaultEntry[]>([]);
    const selectedId = ref<string | null>(null);
    const selected = computed(() => entries.value.find((e) => e.id === selectedId.value) ?? null);
    const confirmingDelete = ref(false);

    const clef = ref("");
    const pending = ref<RenewProposal | null>(null);
    const renewAllowed = ref(isPaidPlan(loadSession()?.plan));

    const heading = ref<HTMLElement | null>(null);
    const unlockInput = ref<HTMLInputElement | null>(null);
    const renewConfirm = ref<HTMLButtonElement | null>(null);
    const deleteConfirm = ref<HTMLButtonElement | null>(null);

    onMounted(() => {
      const session = loadSession();
      if (session) refreshPlan(session).then((plan) => (renewAllowed.value = isPaidPlan(plan)));
    });

    /** Chaque changement de vue place le focus sur son titre. */
    async function focusHeading() {
      await nextTick();
      heading.value?.focus();
    }

    function resetFields() {
      password.value = "";
      passwordConfirm.value = "";
      current.value = "";
      errorField.value = "";
    }

    function showError(e: unknown) {
      const code = e instanceof LockError ? e.code : "";
      error.value = t(ERROR_KEYS[code] ?? "vault_err_wrong");
      errorField.value = code === "mismatch" ? "confirm" : "password";
      status.value = "";
    }

    function refreshEntries() {
      entries.value = liveEntries(loadVault());
    }

    function enterUnlocked(message: TranslationKey) {
      resetFields();
      error.value = "";
      status.value = t(message);
      refreshEntries();
      selectedId.value = null;
      view.value = "unlocked";
      focusHeading();
    }

    async function withBusy(task: () => Promise<void>) {
      if (busy.value) return;
      busy.value = true;
      error.value = "";
      status.value = t("vault_checking");
      try {
        await task();
      } catch (e) {
        showError(e);
      } finally {
        busy.value = false;
      }
    }

    const onCreate = () =>
      withBusy(async () => {
        await createLock(password.value, passwordConfirm.value);
        enterUnlocked("vault_unlocked");
      });

    const onUnlock = () =>
      withBusy(async () => {
        if (!(await verifyLock(password.value))) throw new LockError("wrong-password");
        enterUnlocked("vault_unlocked");
      });

    const onChange = () =>
      withBusy(async () => {
        await changeLock(current.value, password.value, passwordConfirm.value);
        resetFields();
        status.value = t("vault_change_done");
      });

    function onLock() {
      resetFields();
      clef.value = "";
      pending.value = null;
      selectedId.value = null;
      entries.value = [];
      error.value = "";
      status.value = t("vault_locked_msg");
      view.value = "locked";
      focusHeading();
    }

    function askForget() {
      confirmingForget.value = true;
      error.value = "";
      focusHeading();
    }

    async function cancelForget() {
      confirmingForget.value = false;
      await nextTick();
      unlockInput.value?.focus();
    }

    function onForget() {
      forgetLock();
      confirmingForget.value = false;
      resetFields();
      status.value = t("vault_forgot_done");
      view.value = "setup";
      focusHeading();
    }

    function openEntry(id: string) {
      selectedId.value = id;
      pending.value = null;
      confirmingDelete.value = false;
      status.value = "";
      focusHeading();
    }

    function closeEntry() {
      selectedId.value = null;
      pending.value = null;
      confirmingDelete.value = false;
      focusHeading();
    }

    async function askDelete() {
      confirmingDelete.value = true;
      await nextTick();
      deleteConfirm.value?.focus();
    }

    function onDelete() {
      const id = selectedId.value;
      if (!id) return;
      const vault = loadVault();
      if (tombstoneEntry(vault, id)) saveVault(vault);
      confirmingDelete.value = false;
      status.value = t("vault_deleted");
      refreshEntries();
      closeEntry();
    }

    async function onProposeRenew() {
      const entry = selected.value;
      if (!entry) return;
      error.value = "";
      if (!clef.value) {
        error.value = t("gen_need_key");
        return;
      }
      if (!renewAllowed.value) {
        error.value = t("gen_renew_paid");
        return;
      }
      status.value = t("gen_computing");
      pending.value = await proposeRenewal(entry, clef.value);
      status.value = "";
      await nextTick();
      renewConfirm.value?.focus();
    }

    function onApplyRenew() {
      const change = pending.value;
      if (!change) return;
      const entry = applyRenewal(change.entryId);
      pending.value = null;
      refreshEntries();
      if (entry) {
        status.value = t("vault_renewed").replace("{n}", String(entry.counter));
      }
    }

    function charsetText(entry: VaultEntry): string {
      const parts: TranslationKey[] = [];
      if (entry.charset.lower) parts.push("gen_lowercase");
      if (entry.charset.upper) parts.push("gen_uppercase");
      if (entry.charset.symbols) parts.push("gen_symbols");
      if (entry.charset.numbers) parts.push("gen_numbers");
      return parts.map(t).join(", ");
    }

    function formatDate(iso: string): string {
      const date = new Date(iso);
      return Number.isNaN(date.getTime())
        ? iso
        : date.toLocaleString(lang.value, { dateStyle: "medium", timeStyle: "short" });
    }

    return {
      t,
      localePath,
      view,
      password,
      passwordConfirm,
      current,
      status,
      error,
      errorField,
      busy,
      confirmingForget,
      entries,
      selected,
      confirmingDelete,
      clef,
      pending,
      renewAllowed,
      heading,
      unlockInput,
      renewConfirm,
      deleteConfirm,
      onCreate,
      onUnlock,
      onChange,
      onLock,
      askForget,
      cancelForget,
      onForget,
      openEntry,
      closeEntry,
      askDelete,
      onDelete,
      onProposeRenew,
      onApplyRenew,
      charsetText,
      formatDate,
    };
  },
});
</script>

<style scoped>
.page-wrapper {
  display: flex;
  flex-direction: column;
}

.page-hero {
  position: relative;
  background: var(--hero-gradient);
  padding: 70px 24px 90px;
  text-align: center;
  overflow: hidden;
}

.page-hero::after {
  content: "";
  position: absolute;
  inset: auto 0 -1px 0;
  height: 80px;
  background: linear-gradient(to bottom, transparent, var(--c1));
  pointer-events: none;
}

.page-hero-inner {
  position: relative;
  z-index: 1;
  max-width: 720px;
  margin: 0 auto;
}

.page-hero h1 {
  font-size: clamp(2rem, 4vw, 2.8rem);
  margin: 0 0 12px;
  color: #fff;
}

.page-hero-sub {
  margin: 0;
  font-size: clamp(0.95rem, 1.3vw, 1.05rem);
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.78);
}

.content-container {
  max-width: 640px;
  margin: -50px auto 0;
  padding: 0 24px 80px;
  position: relative;
  z-index: 2;
}

.vault-card {
  background: var(--surface);
  border: 1px solid var(--border-soft);
  border-radius: 18px;
  padding: 26px 24px;
  box-shadow: var(--shadow-soft);
}

.status:empty,
.error:empty {
  display: none;
}

.status {
  margin: 0 0 12px;
}

.error {
  margin: 0 0 12px;
  font-size: 0.85rem;
  color: #ff8a8a;
}

.panel-title:focus {
  outline: none;
}

.panel-title:focus-visible {
  outline: 2px solid var(--c4);
  outline-offset: 4px;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 14px;
}

.form-field label {
  font-size: 0.85rem;
  font-weight: 600;
}

.form-field input {
  padding: 10px 14px;
  border-radius: 12px;
  border: 1px solid var(--border-soft);
  background: var(--surface-elevated);
  color: var(--text);
  font-size: 0.9rem;
}

.form-field input[aria-invalid="true"] {
  border-color: #ff8a8a;
}

.form-field .hint {
  margin: 0;
}

.panel-actions .ghost-btn {
  padding: 10px 16px;
}

.ghost-btn.danger {
  border-color: rgba(255, 138, 138, 0.6);
}

.ghost-btn.danger:hover {
  background: rgba(255, 138, 138, 0.15);
}

.link-btn {
  background: none;
  border: 0;
  padding: 6px 0;
  color: var(--text-muted);
  font-size: 0.85rem;
  text-decoration: underline;
  cursor: pointer;
}

.link-btn:hover {
  color: var(--text);
}

.toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 8px;
}

.entry-list {
  list-style: none;
  margin: 12px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.entry-btn {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  width: 100%;
  padding: 10px 14px;
  border-radius: 12px;
  background: var(--surface-elevated);
  border: 1px solid var(--border-soft);
  color: var(--text);
  text-align: left;
  cursor: pointer;
}

.entry-btn:hover {
  border-color: var(--c4);
}

.entry-name {
  font-size: 0.95rem;
  font-weight: 600;
  word-break: break-all;
}

.entry-meta {
  font-size: 0.8rem;
  color: var(--text-muted);
  word-break: break-all;
}

.detail-title {
  margin-top: 8px;
}

.detail {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 8px 16px;
  margin: 14px 0 0;
  font-size: 0.9rem;
}

.detail dt {
  color: var(--text-muted);
}

.detail dd {
  margin: 0;
  word-break: break-all;
}

.confirm-box,
.change-box {
  padding: 14px;
  border-radius: 14px;
  background: var(--surface-elevated);
  border: 1px solid var(--border-strong);
}

.change-box code {
  display: inline-block;
  padding: 6px 10px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.35);
  font-size: 0.95rem;
  word-break: break-all;
}
</style>
