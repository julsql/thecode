<template>
  <div class="page-wrapper">
    <header class="page-hero">
      <div class="page-hero-inner">
        <div class="page-hero-icon">
          <img
            src="https://img.icons8.com/?size=200&id=scais6KfLeli&format=png&color=ffffff"
            alt=""
          />
        </div>
        <h1>{{ t("gen_title") }}</h1>
        <p class="page-hero-sub">{{ t("gen_subtitle") }}</p>
      </div>
    </header>

    <div class="generator-container fadeIn">
      <div class="generator-card">
        <!-- Données -->
        <fieldset>
          <h2>{{ t("gen_section_data") }}</h2>

          <div class="form-group">
            <label for="id_clef">{{ t("gen_label_key") }}</label>
            <div class="input-with-button">
              <input
                :type="showPassword ? 'text' : 'password'"
                v-model="clef"
                :placeholder="t('gen_placeholder_key')"
                id="id_clef"
                required
              />
              <button type="button" class="ghost-btn" @click="togglePassword">
                {{ showPassword ? t("gen_hide") : t("gen_show") }}
              </button>
            </div>
          </div>

          <div class="form-group">
            <!-- L'empreinte se memorise a force d'etre vue : une valeur differente
                 signale une faute de frappe avant qu'elle ne coute un acces. -->
            <p v-if="fingerprint.text" class="fingerprint">
              Empreinte
              <span class="chip" :style="{ backgroundColor: fingerprint.color }">
                {{ fingerprint.text }}
              </span>
            </p>

            <label for="id_site">{{ t("gen_label_site") }}</label>
            <input
              type="text"
              v-model="site"
              :placeholder="t('gen_placeholder_site')"
              id="id_site"
              required
            />
          </div>
        </fieldset>

        <!-- Paramètres -->
        <fieldset>
          <h2>{{ t("gen_section_settings") }}</h2>

          <div class="form-group range-group">
            <span>
              <label for="id_longueur" class="no-margin-bottom">{{ t("gen_label_length") }}</label>
              <output>{{ longueur }}</output>
            </span>
            <input
              type="range"
              v-model.number="longueur"
              min="4"
              max="40"
              step="1"
              id="id_longueur"
            />
          </div>

          <div class="checkbox-group">
            <label class="check-pill">
              <input type="checkbox" v-model="minuscules" />
              <span>{{ t("gen_lowercase") }}</span>
            </label>
            <label class="check-pill">
              <input type="checkbox" v-model="majuscules" />
              <span>{{ t("gen_uppercase") }}</span>
            </label>
            <label class="check-pill">
              <input type="checkbox" v-model="symboles" />
              <span>{{ t("gen_symbols") }}</span>
            </label>
            <label class="check-pill">
              <input type="checkbox" v-model="chiffres" />
              <span>{{ t("gen_numbers") }}</span>
            </label>
          </div>
        </fieldset>

        <!-- Résultat -->
        <div class="result">
          <h2>{{ t("gen_section_result") }}</h2>
          <input
            type="text"
            id="password"
            v-model="motDePasse"
            readonly
            :placeholder="t('gen_placeholder_result')"
          />
          <p class="security-line">
            {{ t("gen_security_label") }} :
            <span :style="{ color: couleurSecurite }">{{ niveauSecurite }}</span>
          </p>

          <!-- Le carnet retient les reglages par site : plus besoin de se souvenir
               qu'un compte avait ete cree sans symboles. -->
          <div class="vault">
            <button type="button" @click="saveEntry">
              {{ vaultEntries.length ? "Mettre à jour l'entrée" : "Enregistrer ce site" }}
            </button>
            <p v-if="vaultMessage" class="hint">{{ vaultMessage }}</p>
            <p v-else-if="vaultEntries.length" class="hint">
              {{ vaultEntries.length }} entrée(s) connue(s) pour ce site.
            </p>

            <!-- Renouveler et migrer : les deux actions qui changent un mot de
                 passe deja en service. Jamais les deux a la fois — le compteur
                 n'entre pas dans la derivation v1, et une entree v2 n'a plus
                 rien a migrer. -->
            <ul v-if="vaultEntries.length && !pending" class="vault-entries">
              <li v-for="entry in vaultEntries" :key="entry.id">
                <span>{{ entry.label || entry.siteKey }}</span>
                <button type="button" @click="proposeChange(entry, entry.v >= 2)">
                  {{ entry.v >= 2 ? "Renouveler" : "Passer en v2" }}
                </button>
              </li>
            </ul>

            <!-- Les deux cote a cote : le nouveau ne sert a rien tant qu'il n'a
                 pas ete pose sur le site, et l'ancien reste celui qui connecte. -->
            <div v-if="pending" class="vault-change">
              <p class="hint">Actuel</p>
              <p>
                <code>{{ pending.before }}</code>
              </p>
              <p class="hint">Nouveau</p>
              <p>
                <code>{{ pending.after }}</code>
              </p>
              <p class="hint">
                Changez-le sur le site, puis confirmez. Le nouveau ne sert à rien tant que ce n'est
                pas fait.
              </p>
              <button type="button" @click="applyChange">Confirmer</button>
              <button type="button" @click="pending = null">Annuler</button>
            </div>
          </div>

          <!-- Transfert hors serveur : le QR pour envoyer vers un téléphone,
               le fichier pour aller vers un autre navigateur. Le contenu est
               chiffré avec une clef dérivée de la clef maîtresse, donc une
               photo de l'écran ne révèle rien. -->
          <div class="vault">
            <h3>Transférer le carnet</h3>
            <button type="button" @click="showTransfer">Afficher le QR code</button>
            <button type="button" @click="downloadVault">Enregistrer un fichier</button>
            <label class="import-file">
              Importer un fichier
              <input type="file" accept=".txt,.thecode,text/plain" @change="importFile" />
            </label>
            <p v-if="transferMessage" class="hint">{{ transferMessage }}</p>

            <div v-if="qrRows.length" class="qr">
              <!-- Un module = une case. Le rendu passe par des div plutôt que
                   par une image : pas de canvas à sérialiser, et le code reste
                   net à n'importe quel zoom. -->
              <div v-for="(row, r) in qrRows" :key="r" class="qr-row">
                <span
                  v-for="(module, c) in row"
                  :key="c"
                  :class="module ? 'qr-dark' : 'qr-light'"
                />
              </div>
              <p class="hint">Scannez-le depuis l'application sur votre téléphone.</p>
            </div>
          </div>

          <!-- Le carnet est chiffré avant de quitter le navigateur : le serveur
               ne reçoit que des blocs opaques. -->
          <div class="sync">
            <h3>Synchronisation</h3>

            <template v-if="!syncConnected">
              <input
                v-model="syncEmail"
                type="email"
                placeholder="Adresse e-mail"
                autocomplete="off"
              />
              <input
                v-model="syncPassword"
                type="password"
                placeholder="Mot de passe du compte"
                autocomplete="off"
              />
              <button type="button" @click="connectSync">Connecter</button>
            </template>

            <template v-else>
              <button type="button" @click="runSync">Synchroniser</button>
              <button type="button" @click="disconnectSync">Déconnecter</button>
            </template>

            <p v-if="syncMessage" class="hint">{{ syncMessage }}</p>
          </div>
          <input type="range" :value="scoreSecurite" min="0" max="252" disabled />
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, watch, computed, onMounted } from "vue";
import { generatePassword, calculateEntropyBits, getSecurityLevel } from "@/utils";
import { canonicalSite, loadPublicSuffixList } from "@/canonicalSite";
import { keyFingerprint, type Fingerprint } from "@/fingerprint";
import {
  clearSession,
  loadSession,
  login as syncLogin,
  saveSession,
  syncVault,
  SyncError,
  DEFAULT_ENDPOINT,
} from "@/sync";
import {
  emptyVault,
  findAllByDomain,
  loadVault,
  mergeVaults,
  newEntry,
  saveVault,
  type Vault,
  type VaultEntry,
} from "@/vault";
import { generatePasswordV2 } from "@/coreV2";
import { exportVault, importVault } from "@/transfer";
import { encodeQr } from "@/qr.js";
import { useI18n } from "@/i18n";
import type { TranslationKey } from "@/i18n";

export default defineComponent({
  name: "Generator",
  setup() {
    // La PSL est servie depuis public/ : on la charge une fois au montage, puis
    // on regenere, car la canonicalisation change le resultat.
    onMounted(async () => {
      try {
        const res = await fetch("/public_suffix_list.dat");
        if (res.ok) {
          loadPublicSuffixList(await res.text());
          await genererMotDePasse();
        }
      } catch {
        // Hors ligne ou ressource absente : canonicalSite rendra l'hote tel
        // quel, ce qui reste coherent avec ce que l'utilisateur a saisi.
      }
    });

    const { t } = useI18n();

    const clef = ref("");
    const site = ref("");
    const longueur = ref(20);
    const minuscules = ref(true);
    const majuscules = ref(true);
    const symboles = ref(true);
    const chiffres = ref(true);
    const showPassword = ref(false);
    const motDePasse = ref("");
    const fingerprint = ref<Fingerprint>({ text: "", color: "", colorName: "" });
    const vaultEntries = ref<VaultEntry[]>([]);
    const vaultMessage = ref("");
    const transferMessage = ref("");
    /** Modules du QR affiché, vide tant qu'on n'en demande pas. */
    const qrRows = ref<number[][]>([]);
    /** Changement propose, en attente de confirmation. */
    const pending = ref<{
      entryId: string;
      renew: boolean;
      before: string;
      after: string;
    } | null>(null);
    const syncConnected = ref(Boolean(loadSession()));
    const syncEmail = ref("");
    const syncPassword = ref("");
    const syncMessage = ref("");

    const scoreSecurite = ref(0);
    const couleurSecurite = ref("");
    const securityKey = ref<TranslationKey>("sec_none");
    const niveauSecurite = computed(() => t(securityKey.value));

    const togglePassword = () => {
      showPassword.value = !showPassword.value;
    };

    const securityKeyFromBits = (bits: number): TranslationKey => {
      if (bits === 0) return "sec_none";
      if (bits < 64) return "sec_veryweak";
      if (bits < 80) return "sec_weak";
      if (bits < 100) return "sec_medium";
      if (bits < 126) return "sec_strong";
      return "sec_verystrong";
    };

    const genererMotDePasse = async () => {
      const bits = calculateEntropyBits(
        longueur.value,
        minuscules.value,
        majuscules.value,
        symboles.value,
        chiffres.value,
      );
      const { color } = getSecurityLevel(bits);
      couleurSecurite.value = color;
      scoreSecurite.value = bits;
      securityKey.value = securityKeyFromBits(bits);

      // Sans clef, le mot de passe ne dependrait que du site : il serait donc
      // identique pour tout le monde et calculable par n'importe qui. Le
      // service worker de l'extension refuse deja ce cas ; on s'aligne.
      if (!clef.value) {
        motDePasse.value = "";
        return;
      }

      // Canonicalise la saisie pour qu'un meme compte donne le meme mot de
      // passe que dans l'extension ou les apps : https://www.google.com/login
      // et google.com doivent converger.
      const domain = canonicalSite(site.value);

      // Une entree du carnet dit sous quelle clef derivee et en quelle version.
      // L'ignorer rendrait un mot de passe v1 pour une entree v2 : faux, sans
      // que rien ne le signale.
      const entry = vaultEntries.value[0];
      const mdp = entry
        ? await passwordForEntry(entry)
        : await generatePassword(
            domain,
            clef.value,
            longueur.value,
            minuscules.value,
            majuscules.value,
            symboles.value,
            chiffres.value,
          );
      motDePasse.value = mdp ?? "";
    };

    watch(clef, async (value) => {
      fingerprint.value = await keyFingerprint(value);
    });

    /**
     * Derive le mot de passe d'une entree, dans sa version a elle.
     *
     * Les deux versions coexistent entree par entree : une entree existante
     * reste en v1 et son mot de passe ne doit pas changer.
     */
    async function passwordForEntry(entry: VaultEntry, counter?: number, version?: number) {
      const v = version ?? entry.v;
      if (v >= 2) {
        return generatePasswordV2(entry.siteKey, clef.value, entry.length, {
          useLower: entry.charset.lower,
          useUpper: entry.charset.upper,
          useSymbols: entry.charset.symbols,
          useNumbers: entry.charset.numbers,
          login: entry.login ?? "",
          counter: counter ?? entry.counter,
        });
      }
      // v1 : ni login ni compteur n'entrent dans la derivation.
      return generatePassword(
        entry.siteKey,
        clef.value,
        entry.length,
        entry.charset.lower,
        entry.charset.upper,
        entry.charset.symbols,
        entry.charset.numbers,
      );
    }

    /**
     * Prepare un renouvellement ou une migration, sans rien ecrire.
     *
     * Les deux mots de passe s'affichent cote a cote : le nouveau ne sert a
     * rien tant qu'il n'a pas ete pose sur le site, et l'ancien reste celui qui
     * connecte. Ecrire d'abord rendrait le compte inaccessible.
     */
    async function proposeChange(entry: VaultEntry, renew: boolean) {
      if (!clef.value) {
        vaultMessage.value = "Renseignez d'abord votre clef.";
        return;
      }
      vaultMessage.value = "Calcul en cours…";

      pending.value = {
        entryId: entry.id,
        renew,
        before: (await passwordForEntry(entry)) ?? "",
        after:
          (await passwordForEntry(
            entry,
            renew ? entry.counter + 1 : entry.counter,
            renew ? entry.v : 2,
          )) ?? "",
      };
      vaultMessage.value = "";
    }

    function applyChange() {
      const change = pending.value;
      if (!change) return;

      const vault = loadVault() ?? emptyVault();
      const entry = vault.entries.find((e) => e.id === change.entryId);
      if (!entry) {
        pending.value = null;
        return;
      }

      if (change.renew) entry.counter += 1;
      else entry.v = 2;
      // Sans rehorodatage, la fusion ferait gagner l'autre appareil et le
      // changement serait perdu a la synchronisation suivante.
      entry.updatedAt = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

      saveVault(vault);
      pending.value = null;
      vaultMessage.value = change.renew
        ? `Entrée renouvelée, compteur ${entry.counter}.`
        : "Entrée passée en v2.";
      refreshVault();
      genererMotDePasse();
    }

    /**
     * Affiche le carnet chiffré en QR code.
     *
     * Rien n'est envoyé nulle part : le QR se lit d'un écran à l'autre, et son
     * contenu est chiffré avec une clef dérivée de la clef maîtresse.
     */
    async function showTransfer() {
      if (!clef.value) {
        transferMessage.value = "Renseignez d'abord votre clef.";
        return;
      }
      const vault = loadVault();
      if (!vault || !vault.entries.length) {
        transferMessage.value = "Le carnet est vide, il n'y a rien à transférer.";
        return;
      }

      transferMessage.value = "Calcul en cours…";
      try {
        const payload = await exportVault(vault, clef.value);
        qrRows.value = encodeQr(payload).modules;
        transferMessage.value = "";
      } catch (e) {
        // Un carnet trop gros ne tient pas dans un QR : le dire plutôt que
        // d'afficher un code tronqué que rien ne saura lire.
        qrRows.value = [];
        transferMessage.value = `Impossible : ${(e as Error).message}`;
      }
    }

    /** Enregistre le carnet chiffré dans un fichier. */
    async function downloadVault() {
      if (!clef.value) {
        transferMessage.value = "Renseignez d'abord votre clef.";
        return;
      }
      const vault = loadVault();
      if (!vault || !vault.entries.length) {
        transferMessage.value = "Le carnet est vide, il n'y a rien à transférer.";
        return;
      }

      const payload = await exportVault(vault, clef.value);
      const url = URL.createObjectURL(new Blob([payload], { type: "text/plain" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = "thecode-carnet.txt";
      link.click();
      URL.revokeObjectURL(url);

      transferMessage.value = "Fichier enregistré.";
    }

    /**
     * Importe un fichier et le fusionne avec le carnet local.
     *
     * Fusion et jamais substitution : un import qui écraserait effacerait les
     * entrées créées ici.
     */
    async function importFile(event: Event) {
      const input = event.target as HTMLInputElement;
      const file = input.files?.[0];
      if (!file) return;
      input.value = "";

      if (!clef.value) {
        transferMessage.value = "Renseignez d'abord votre clef.";
        return;
      }

      transferMessage.value = "Lecture en cours…";
      try {
        const incoming = (await importVault((await file.text()).trim(), clef.value)) as Vault;
        const { vault: merged, conflicts } = mergeVaults(loadVault() ?? emptyVault(), incoming);
        saveVault(merged);
        refreshVault();

        const kept = merged.entries.filter((e) => !e.deleted).length;
        transferMessage.value = conflicts.length
          ? `Carnet fusionné : ${kept} entrées, ${conflicts.length} à vérifier.`
          : `Carnet fusionné : ${kept} entrées.`;
      } catch (e) {
        transferMessage.value = `Impossible : ${(e as Error).message}`;
      }
    }

    /** Entrees du carnet couvrant le site saisi. */
    function refreshVault() {
      const domain = canonicalSite(site.value);
      vaultEntries.value = domain ? findAllByDomain(loadVault(), domain) : [];
    }

    watch(site, refreshVault, { immediate: true });

    /**
     * Enregistre le site et ses reglages.
     *
     * siteKey n'est jamais reecrit : il produit le mot de passe, le modifier
     * en changerait un deja en service.
     */
    function saveEntry() {
      const domain = canonicalSite(site.value);
      if (!domain) {
        vaultMessage.value = "Renseignez un site.";
        return;
      }

      const vault = loadVault() ?? emptyVault();
      const charset = {
        lower: minuscules.value,
        upper: majuscules.value,
        symbols: symboles.value,
        numbers: chiffres.value,
      };
      const existing = findAllByDomain(vault, domain)[0];

      if (existing) {
        existing.length = Number(longueur.value);
        existing.charset = charset;
        existing.updatedAt = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
        vaultMessage.value = "Entrée mise à jour.";
      } else {
        vault.entries.push(newEntry(domain, { length: Number(longueur.value), charset }));
        vaultMessage.value = "Site enregistré.";
      }

      saveVault(vault);
      refreshVault();
    }

    async function connectSync() {
      if (!syncEmail.value || !syncPassword.value) {
        syncMessage.value = "Renseignez l'adresse et le mot de passe.";
        return;
      }
      syncMessage.value = "Connexion…";
      try {
        saveSession(await syncLogin(DEFAULT_ENDPOINT, syncEmail.value, syncPassword.value));
        // Le mot de passe du compte ne reste pas en mémoire une fois utilisé.
        syncPassword.value = "";
        syncConnected.value = true;
        syncMessage.value = "Connecté.";
      } catch (e) {
        syncMessage.value = `Échec : ${(e as Error).message}`;
      }
    }

    async function runSync() {
      const session = loadSession();
      if (!session) {
        syncMessage.value = "Connectez-vous d'abord.";
        return;
      }
      if (!clef.value) {
        // Le carnet est chiffré avec une clef dérivée de la clef maîtresse :
        // sans elle, il n'y a rien à chiffrer ni à relire.
        syncMessage.value = "Saisissez votre clef maîtresse.";
        return;
      }

      syncMessage.value = "Synchronisation…";
      try {
        const result = await syncVault(loadVault(), clef.value, session);
        saveVault(result.vault);
        saveSession(result.session);
        refreshVault();
        const conflicts = result.conflicts.length
          ? ` (${result.conflicts.length} conflit(s) signalé(s))`
          : "";
        const kept = result.vault.entries.filter((e) => !e.deleted).length;
        syncMessage.value = `${kept} entrée(s) synchronisée(s)${conflicts}`;
      } catch (e) {
        syncMessage.value =
          e instanceof SyncError ? `Échec : ${e.message}` : `Échec : ${(e as Error).message}`;
      }
    }

    function disconnectSync() {
      clearSession();
      syncConnected.value = false;
      syncMessage.value = "Session oubliée sur cet appareil.";
    }

    watch([clef, site, longueur, minuscules, majuscules, symboles, chiffres], genererMotDePasse, {
      immediate: true,
    });

    return {
      t,
      fingerprint,
      vaultEntries,
      vaultMessage,
      saveEntry,
      pending,
      proposeChange,
      applyChange,
      transferMessage,
      qrRows,
      showTransfer,
      downloadVault,
      importFile,
      syncConnected,
      syncEmail,
      syncPassword,
      syncMessage,
      connectSync,
      runSync,
      disconnectSync,
      clef,
      site,
      longueur,
      minuscules,
      majuscules,
      symboles,
      chiffres,
      showPassword,
      motDePasse,
      togglePassword,
      scoreSecurite,
      couleurSecurite,
      niveauSecurite,
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
  max-width: 800px;
  margin: 0 auto;
}

.page-hero-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 72px;
  height: 72px;
  border-radius: 20px;
  background: linear-gradient(135deg, rgba(166, 77, 121, 0.35), rgba(106, 17, 203, 0.35));
  border: 1px solid rgba(255, 255, 255, 0.15);
  margin-bottom: 18px;
}

.page-hero-icon img {
  width: 40px;
  height: 40px;
}

.page-hero h1 {
  font-size: clamp(2rem, 4vw, 2.8rem);
  margin: 0 0 12px;
  letter-spacing: -0.5px;
  color: #fff;
  text-shadow: 0 2px 12px rgba(0, 0, 0, 0.25);
}

.page-hero-sub {
  margin: 0;
  font-size: clamp(1rem, 1.3vw, 1.15rem);
  color: rgba(255, 255, 255, 0.78);
}

.generator-container {
  display: flex;
  justify-content: center;
  padding: 0 24px 80px;
  margin-top: -50px;
  position: relative;
  z-index: 2;
}

.generator-card {
  width: 100%;
  max-width: 760px;
  padding: 36px;
  border-radius: 22px;
  background: linear-gradient(160deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02));
  border: 1px solid var(--border-soft);
  box-shadow: var(--shadow-strong);
  color: var(--text);
  backdrop-filter: blur(10px);
}

h2 {
  color: var(--c4);
  font-size: 1.05rem;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  margin: 0 0 14px;
}

fieldset {
  border: none;
  margin: 0 0 28px;
  padding: 0;
}

.form-group {
  display: flex;
  flex-direction: column;
  margin-bottom: 16px;
}

label {
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--text-muted);
  margin-bottom: 8px;
}

input[type="text"],
input[type="password"] {
  width: 100%;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid var(--border-soft);
  background: rgba(0, 0, 0, 0.25);
  color: var(--text);
  font-size: 1rem;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    background 0.2s ease;
}

input[type="text"]::placeholder,
input[type="password"]::placeholder {
  color: rgba(255, 255, 255, 0.35);
}

input[type="text"]:focus,
input[type="password"]:focus {
  outline: none;
  border-color: var(--c4);
  box-shadow: 0 0 0 4px rgba(166, 77, 121, 0.18);
  background: rgba(0, 0, 0, 0.35);
}

input[type="text"]:read-only {
  background: rgba(0, 0, 0, 0.35);
  font-family: "JetBrains Mono", "Menlo", "Consolas", monospace;
  letter-spacing: 0.5px;
}

.input-with-button {
  display: flex;
  gap: 10px;
}

.input-with-button input {
  flex: 1;
}

.ghost-btn {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--border-soft);
  color: var(--text);
  padding: 0 18px;
  border-radius: 12px;
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  transition:
    background 0.2s ease,
    border-color 0.2s ease;
}

.ghost-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: var(--c4);
}

.range-group {
  display: block;
}

.range-group span {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.range-group output {
  font-family: "JetBrains Mono", "Menlo", "Consolas", monospace;
  font-weight: 700;
  color: var(--c4);
  font-size: 1.1rem;
}

input[type="range"] {
  width: 100%;
  height: 6px;
  -webkit-appearance: none;
  appearance: none;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 999px;
  outline: none;
  cursor: pointer;
}

input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--c4), var(--c3));
  border: 2px solid #fff;
  box-shadow: 0 4px 10px rgba(166, 77, 121, 0.4);
  cursor: pointer;
}

input[type="range"]::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--c4), var(--c3));
  border: 2px solid #fff;
  cursor: pointer;
}

input[type="range"]:disabled {
  cursor: default;
}

.no-margin-bottom {
  margin-bottom: 0;
}

.checkbox-group {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.check-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 999px;
  border: 1px solid var(--border-soft);
  background: rgba(255, 255, 255, 0.04);
  cursor: pointer;
  font-size: 0.9rem;
  color: var(--text-muted);
  font-weight: 500;
  transition:
    background 0.2s ease,
    border-color 0.2s ease,
    color 0.2s ease;
  margin: 0;
}

.check-pill:hover {
  border-color: rgba(166, 77, 121, 0.45);
  color: var(--text);
}

.check-pill input[type="checkbox"] {
  appearance: none;
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 4px;
  border: 1.5px solid var(--border-strong);
  background: transparent;
  cursor: pointer;
  position: relative;
  transition:
    background 0.2s ease,
    border-color 0.2s ease;
}

.check-pill input[type="checkbox"]:checked {
  background: linear-gradient(135deg, var(--c4), var(--c3));
  border-color: transparent;
}

.check-pill input[type="checkbox"]:checked::after {
  content: "";
  position: absolute;
  left: 4px;
  top: 0;
  width: 4px;
  height: 9px;
  border: solid #fff;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

.check-pill:has(input:checked) {
  background: rgba(166, 77, 121, 0.15);
  border-color: rgba(166, 77, 121, 0.5);
  color: var(--text);
}

.result {
  margin-top: 8px;
  text-align: center;
}

.result h2 {
  text-align: left;
}

#password {
  text-align: center;
  font-size: 1.05rem;
}

.security-line {
  margin: 16px 0 8px;
  font-size: 0.95rem;
  color: var(--text-muted);
}

.security-line span {
  font-weight: 700;
}

.fadeIn {
  opacity: 0;
  animation: fadeIn 0.6s ease-out forwards;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@media (max-width: 600px) {
  .generator-card {
    padding: 24px 18px;
    border-radius: 18px;
  }

  .input-with-button {
    flex-direction: column;
  }

  .ghost-btn {
    padding: 10px;
  }

  .page-hero {
    padding: 50px 20px 70px;
  }
}
</style>
