<template>
  <!-- Annonce du passage à la v2, à l'ouverture. Fermer la fait revenir la
       prochaine fois ; seule la case à cocher la retire pour de bon. -->
  <div v-if="showV2Notice" class="modal-backdrop" @click.self="closeV2Notice">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="v2NoticeTitle">
      <h3 id="v2NoticeTitle">{{ t("v2_notice_title") }}</h3>
      <p>{{ t("v2_notice_intro") }}</p>
      <p>{{ t("v2_notice_detail") }}</p>
      <label class="modal-check">
        <input v-model="v2NoticeNeverAgain" type="checkbox" />
        {{ t("v2_notice_never_again") }}
      </label>
      <div class="modal-actions">
        <button type="button" class="ghost-btn primary" @click="closeV2Notice">
          {{ t("v2_notice_close") }}
        </button>
      </div>
    </div>
  </div>

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
        <!-- Le mode de génération, en haut : c'est lui qui décide quel mot de
             passe sort, il doit se lire sans chercher. -->
        <div class="mode-bar">
          <span class="mode-label">Algorithme</span>
          <div class="mode-switch" role="group">
            <button type="button" :class="{ active: !enV1 }" @click="enV1 = false">v2</button>
            <button type="button" :class="{ active: enV1 }" @click="enV1 = true">v1</button>
          </div>
        </div>
        <p v-if="enV1" class="hint mode-note">
          Ancien algorithme, pour un site dont le mot de passe n'a pas encore été changé.
        </p>

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

          <!-- L'identifiant entre dans la derivation v2 : deux comptes sur un
               meme site ont chacun leur mot de passe. Vide = comportement
               d'avant. -->
          <div class="form-group">
            <label for="id_login">{{ t("gen_label_login") }}</label>
            <input
              type="text"
              v-model="login"
              :placeholder="t('gen_placeholder_login')"
              id="id_login"
              autocomplete="off"
              :aria-describedby="enV1 ? 'id_login_hint' : undefined"
              @input="loginPrefilled = false"
            />
            <p v-if="enV1" id="id_login_hint" class="hint login-hint">
              {{ t("gen_login_v1_ignored") }}
            </p>
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
            <!-- La version en cours doit se lire sans chercher : c'est elle
                 qui décide quel mot de passe sort. -->
            <span class="algo-badge">{{ enV1 ? "v1" : "v2" }}</span>
          </p>

          <!-- Barre de force du mot de passe. Elle etait posee tout en bas de
               la carte, apres la synchronisation : on la prenait pour un
               reglage de celle-ci. -->
          <input
            class="strength-bar"
            type="range"
            :value="scoreSecurite"
            min="0"
            max="252"
            disabled
            :aria-label="t('gen_security_label')"
          />

          <!-- Le carnet retient les reglages par site : plus besoin de se souvenir
               qu'un compte avait ete cree sans symboles. -->
          <section class="panel">
            <h3 class="panel-title">{{ t("vault_title") }}</h3>
            <p class="panel-lead">{{ t("vault_lead") }}</p>

            <div class="panel-actions centered">
              <button type="button" class="ghost-btn" @click="saveEntry">
                {{ matchedEntry ? t("vault_update") : t("vault_save") }}
              </button>
            </div>

            <p v-if="vaultMessage" class="hint">{{ vaultMessage }}</p>
            <p v-else-if="vaultEntries.length" class="hint">
              {{ tf("vault_known", { n: vaultEntries.length }) }}
            </p>

            <!-- La gestion (liste, détail, suppression, renouvellement) vit
                 derrière le verrou de l'écran carnet : le générateur ne fait
                 qu'enregistrer. Voir shared/spec/vault-lock.md. -->
            <p class="hint">
              <router-link :to="localePath('vault')">{{ t("gen_vault_manage") }}</router-link>
            </p>
          </section>

          <!-- Transfert hors serveur : le QR pour envoyer vers un téléphone,
               le fichier pour aller vers un autre navigateur. Le contenu est
               chiffré avec une clef dérivée de la clef maîtresse, donc une
               photo de l'écran ne révèle rien. -->
          <section class="panel">
            <h3 class="panel-title">{{ t("transfer_title") }}</h3>
            <p class="panel-lead">{{ t("transfer_lead") }}</p>

            <div class="panel-actions fill">
              <button type="button" class="ghost-btn" @click="showTransfer">
                {{ t("transfer_qr") }}
                <small>{{ t("transfer_qr_hint") }}</small>
              </button>
              <button type="button" class="ghost-btn" @click="downloadVault">
                {{ t("transfer_download") }}
                <small>{{ t("transfer_download_hint") }}</small>
              </button>
              <!-- Le champ natif est masqué : « Choose File » n'est ni
                   traduisible ni stylable, et ne dit pas ce qu'on attend. -->
              <label class="ghost-btn as-label">
                {{ t("transfer_import") }}
                <small>{{ t("transfer_import_hint") }}</small>
                <input type="file" accept=".txt,.thecode,text/plain" @change="importFile" />
              </label>
            </div>

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
              <p class="hint">{{ t("transfer_scan") }}</p>
            </div>
          </section>

          <!-- Le carnet est chiffré avant de quitter le navigateur : le serveur
               ne reçoit que des blocs opaques. -->
          <section class="panel">
            <h3 class="panel-title">{{ t("sync_title") }}</h3>
            <p class="panel-lead">{{ t("sync_lead") }}</p>

            <!-- Le compte se cree et se gere sur sa propre page : le
                 formulaire vivait ici, au milieu du generateur, ou personne
                 n'allait le chercher — et il n'y a pas sa place, l'abonnement
                 et les appareils ne sont pas des affaires de generation. -->
            <template v-if="!syncConnected">
              <div class="panel-actions">
                <router-link class="ghost-btn primary" :to="localePath('account')">
                  {{ t("gen_account_link") }}
                </router-link>
              </div>
            </template>

            <template v-else>
              <div class="panel-actions">
                <button type="button" class="ghost-btn primary" @click="runSync">
                  {{ t("sync_now") }}
                </button>
                <button type="button" class="ghost-btn" @click="disconnectSync">
                  {{ t("sync_disconnect") }}
                </button>
              </div>
            </template>

            <p v-if="syncMessage" class="hint">{{ syncMessage }}</p>
          </section>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, watch, computed, onMounted, onUnmounted } from "vue";
import { generatePassword, calculateEntropyBits, getSecurityLevel } from "@/utils";
import { canonicalSite, loadPublicSuffixList } from "@/canonicalSite";
import { keyFingerprint, type Fingerprint } from "@/fingerprint";
import { clearSession, loadSession, saveSession, syncSettings, syncVault } from "@/sync";
import { loadSettings, rememberSettings, saveSettings, type DefaultSettings } from "@/settings";
import { refreshPlan } from "@/account";
import {
  emptyVault,
  findAllByDomain,
  findByLogin,
  loadVault,
  loginToPrefill,
  mergeVaults,
  newEntry,
  saveVault,
  type Vault,
  type VaultEntry,
} from "@/vault";
import { generatePasswordV2 } from "@/coreV2";
import { passwordForEntry } from "@/renew";
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

    const { t, localePath } = useI18n();
    /** Traduction avec valeurs : `{n}` et consorts remplacés tels quels. */
    const tf = (key: TranslationKey, values: Record<string, string | number>) =>
      Object.entries(values).reduce((text, [k, v]) => text.split(`{${k}}`).join(String(v)), t(key));

    const clef = ref("");
    const site = ref("");
    /**
     * Identifiant du compte sur le site. Entre dans la derivation v2 tel que
     * saisi, sans normalisation : les autres clients font de meme.
     */
    const login = ref("");
    /** Vrai tant que l'identifiant vient du carnet et non de l'utilisateur. */
    const loginPrefilled = ref(false);
    // Réglages par défaut retenus d'une visite à l'autre (et partagés avec le
    // compte à la synchronisation) : shared/spec/default-settings.md.
    const initial = loadSettings();
    const longueur = ref(initial.length);
    const minuscules = ref(initial.charset.lower);
    const majuscules = ref(initial.charset.upper);
    const symboles = ref(initial.charset.symbols);
    const chiffres = ref(initial.charset.numbers);

    function showSettings(settings: DefaultSettings) {
      longueur.value = settings.length;
      minuscules.value = settings.charset.lower;
      majuscules.value = settings.charset.upper;
      symboles.value = settings.charset.symbols;
      chiffres.value = settings.charset.numbers;
    }

    watch([longueur, minuscules, majuscules, symboles, chiffres], () => {
      rememberSettings({
        length: Number(longueur.value),
        charset: {
          lower: minuscules.value,
          upper: majuscules.value,
          symbols: symboles.value,
          numbers: chiffres.value,
        },
      });
    });
    const showPassword = ref(false);
    const motDePasse = ref("");
    const fingerprint = ref<Fingerprint>({ text: "", color: "", colorName: "" });
    const vaultEntries = ref<VaultEntry[]>([]);
    /** Entree du carnet pour ce site et cet identifiant, s'il y en a une. */
    // Les espaces autour de l'identifiant ne comptent pas : sans cela, un espace
    // colle en trop donnerait un autre mot de passe, comme sur les apps.
    const cleanLogin = computed(() => login.value.trim());
    const matchedEntry = computed(() => findByLogin(vaultEntries.value, cleanLogin.value));
    const vaultMessage = ref("");
    const transferMessage = ref("");
    /**
     * Mode de generation, remis a v2 a chaque ouverture.
     *
     * Volontairement non persiste : la v1 est une exception, et une exception
     * qui survit au rechargement se ferait oublier — on genererait en v1 sans
     * s'en souvenir.
     */
    const enV1 = ref(false);

    /**
     * Annonce du passage a la v2, en fenetre modale a l'ouverture.
     *
     * Fermer la fait revenir la prochaine fois : seule la case a cocher la
     * retire pour de bon. Une annonce qu'on n'a pas eu le temps de lire ne
     * doit pas disparaitre pour toujours.
     *
     * localStorage peut lever en navigation privee, d'ou le try/catch — la
     * page doit s'afficher meme sans stockage.
     */
    const V2_NOTICE_KEY = "thecode.v2NoticeSeen";
    const showV2Notice = ref(false);
    const v2NoticeNeverAgain = ref(false);

    try {
      showV2Notice.value = localStorage.getItem(V2_NOTICE_KEY) !== "1";
    } catch {
      showV2Notice.value = true;
    }

    function closeV2Notice() {
      showV2Notice.value = false;
      if (!v2NoticeNeverAgain.value) return;
      try {
        localStorage.setItem(V2_NOTICE_KEY, "1");
      } catch {
        // Stockage indisponible : l'annonce reviendra, c'est preferable a une
        // page qui casse.
      }
    }
    /** Modules du QR affiché, vide tant qu'on n'en demande pas. */
    const qrRows = ref<number[][]>([]);
    const syncConnected = ref(Boolean(loadSession()));
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

    // Une generation v2 met plusieurs centaines de millisecondes (PBKDF2, 600
    // 000 iterations) : si l'utilisateur bascule en v1 pendant ce temps, le
    // resultat v1 sort en premier et la v2, en retard, l'ecraserait. Chaque
    // generation prend un numero et n'ecrit que si elle est toujours la
    // derniere demandee.
    let generationCourante = 0;

    const genererMotDePasse = async () => {
      const generation = ++generationCourante;
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
      if (generation !== generationCourante) return;

      // Canonicalise la saisie pour qu'un meme compte donne le meme mot de
      // passe que dans l'extension ou les apps : https://www.google.com/login
      // et google.com doivent converger.
      const domain = canonicalSite(site.value);

      // v2 par defaut, partout. La v1 ne sort que sur demande explicite, pour
      // un site dont le mot de passe n'a pas encore ete change.
      const version = enV1.value ? 1 : 2;
      const entry = matchedEntry.value;
      const mdp = entry
        ? await passwordForEntry(entry, clef.value, entry.counter, version)
        : version === 1
          ? await generatePassword(
              domain,
              clef.value,
              longueur.value,
              minuscules.value,
              majuscules.value,
              symboles.value,
              chiffres.value,
            )
          : await generatePasswordV2(domain, clef.value, longueur.value, {
              useLower: minuscules.value,
              useUpper: majuscules.value,
              useSymbols: symboles.value,
              useNumbers: chiffres.value,
              // La v1 ignore l'identifiant ; la v2 le fait entrer dans la graine.
              login: cleanLogin.value,
            });
      if (generation !== generationCourante) return;
      motDePasse.value = mdp ?? "";
    };

    watch(clef, async (value) => {
      fingerprint.value = await keyFingerprint(value);
    });

    /**
     * Affiche le carnet chiffré en QR code.
     *
     * Rien n'est envoyé nulle part : le QR se lit d'un écran à l'autre, et son
     * contenu est chiffré avec une clef dérivée de la clef maîtresse.
     */
    async function showTransfer() {
      if (!clef.value) {
        transferMessage.value = t("gen_need_key");
        return;
      }
      const vault = loadVault();
      if (!vault || !vault.entries.length) {
        transferMessage.value = t("transfer_empty");
        return;
      }

      transferMessage.value = t("gen_computing");
      try {
        const payload = await exportVault(vault, clef.value);
        qrRows.value = encodeQr(payload).modules;
        transferMessage.value = "";
      } catch (e) {
        // Un carnet trop gros ne tient pas dans un QR : le dire plutôt que
        // d'afficher un code tronqué que rien ne saura lire.
        qrRows.value = [];
        transferMessage.value = tf("transfer_failed", { error: (e as Error).message });
      }
    }

    /** Enregistre le carnet chiffré dans un fichier. */
    async function downloadVault() {
      if (!clef.value) {
        transferMessage.value = t("gen_need_key");
        return;
      }
      const vault = loadVault();
      if (!vault || !vault.entries.length) {
        transferMessage.value = t("transfer_empty");
        return;
      }

      const payload = await exportVault(vault, clef.value);
      const url = URL.createObjectURL(new Blob([payload], { type: "text/plain" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = "thecode-carnet.txt";
      link.click();
      URL.revokeObjectURL(url);

      transferMessage.value = t("transfer_saved");
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
        transferMessage.value = t("gen_need_key");
        return;
      }

      transferMessage.value = t("transfer_reading");
      try {
        const incoming = (await importVault((await file.text()).trim(), clef.value)) as Vault;
        const { vault: merged, conflicts } = mergeVaults(loadVault() ?? emptyVault(), incoming);
        saveVault(merged);
        refreshVault();

        const kept = merged.entries.filter((e) => !e.deleted).length;
        transferMessage.value = conflicts.length
          ? tf("transfer_merged_conflicts", { n: kept, c: conflicts.length })
          : tf("transfer_merged", { n: kept });
      } catch (e) {
        transferMessage.value = tf("transfer_failed", { error: (e as Error).message });
      }
    }

    /** Entrees du carnet couvrant le site saisi. */
    function refreshVault() {
      const domain = canonicalSite(site.value);
      vaultEntries.value = domain ? findAllByDomain(loadVault(), domain) : [];
    }

    /**
     * Au changement de site, reprend l'identifiant connu du carnet.
     *
     * Seulement si l'utilisateur n'en a pas saisi un lui-meme, et si aucune
     * entree sans identifiant ne correspond deja : celle-la l'emporte, c'est
     * le comportement d'avant l'identifiant.
     */
    function onSiteChange() {
      refreshVault();
      if (loginPrefilled.value) {
        login.value = "";
        loginPrefilled.value = false;
      }
      const prefill = loginToPrefill(vaultEntries.value, login.value);
      if (prefill !== null) {
        login.value = prefill;
        loginPrefilled.value = true;
      }
    }

    watch(site, onSiteChange, { immediate: true });
    watch(enV1, () => genererMotDePasse());

    // Le thème suit l'algorithme : rose en v1, bleu en v2. Posé sur <html>
    // pour que l'en-tête change aussi, retiré en quittant la page — la v1 ne
    // doit pas teinter le reste du site.
    watch(
      enV1,
      (v1) => {
        document.documentElement.dataset.algo = v1 ? "v1" : "v2";
      },
      { immediate: true },
    );
    onUnmounted(() => {
      delete document.documentElement.dataset.algo;
    });

    /**
     * Enregistre le site et ses reglages.
     *
     * siteKey n'est jamais reecrit : il produit le mot de passe, le modifier
     * en changerait un deja en service.
     */
    function saveEntry() {
      const domain = canonicalSite(site.value);
      if (!domain) {
        vaultMessage.value = t("vault_need_site");
        return;
      }

      const vault = loadVault() ?? emptyVault();
      const charset = {
        lower: minuscules.value,
        upper: majuscules.value,
        symbols: symboles.value,
        numbers: chiffres.value,
      };
      // Appariement sur le site et l'identifiant : un autre identifiant est
      // un autre compte, donc une autre entree.
      const existing = findByLogin(findAllByDomain(vault, domain), cleanLogin.value);

      if (existing) {
        existing.length = Number(longueur.value);
        existing.charset = charset;
        existing.updatedAt = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
        vaultMessage.value = t("vault_updated");
      } else {
        // Toujours v2, meme depuis l'ecran regle en v1 : le carnet n'accepte
        // que la v2, la v1 ne vit qu'en generation ponctuelle.
        vault.entries.push(
          newEntry(domain, { length: Number(longueur.value), charset, login: cleanLogin.value }),
        );
        vaultMessage.value = t("vault_saved");
      }

      saveVault(vault);
      refreshVault();
    }

    async function runSync() {
      const session = loadSession();
      if (!session) {
        syncMessage.value = t("sync_need_login");
        return;
      }
      if (!clef.value) {
        // Le carnet est chiffré avec une clef dérivée de la clef maîtresse :
        // sans elle, il n'y a rien à chiffrer ni à relire.
        syncMessage.value = t("sync_need_key");
        return;
      }

      syncMessage.value = t("sync_running");
      try {
        const result = await syncVault(loadVault(), clef.value, session);
        saveVault(result.vault);
        saveSession(result.session);
        // Les réglages suivent le carnet. Un échec ici n'annule pas la
        // synchronisation du carnet, déjà faite.
        let current = result.session;
        try {
          const synced = await syncSettings(loadSettings(), clef.value, current);
          current = synced.session;
          saveSession(current);
          if (synced.applied) {
            // Enregistrés avant l'affichage : l'écran les retrouve inchangés
            // et ne les redate pas.
            saveSettings(synced.settings);
            showSettings(synced.settings);
          }
        } catch {
          // Service sans réglages, ou coupure : le carnet est à jour.
        }
        // Un abonnement pris entre-temps doit se voir sans recharger la page.
        void refreshPlan(current);
        refreshVault();
        const conflicts = result.conflicts.length
          ? tf("sync_conflicts", { n: result.conflicts.length })
          : "";
        const kept = result.vault.entries.filter((e) => !e.deleted).length - result.localOnly;
        // Au-delà du plafond, le reste ne part pas : le dire, sinon on croit
        // retrouver sur l'autre appareil ce qui n'y est jamais allé.
        const local = result.localOnly ? tf("sync_local_only", { n: result.localOnly }) : "";
        syncMessage.value = `${tf("sync_done", { n: kept })}${local}${conflicts}`;
      } catch (e) {
        syncMessage.value = tf("sync_failed", { error: (e as Error).message });
      }
    }

    function disconnectSync() {
      clearSession();
      syncConnected.value = false;
      syncMessage.value = t("sync_forgotten");
    }

    watch(
      [clef, site, login, longueur, minuscules, majuscules, symboles, chiffres],
      genererMotDePasse,
      {
        immediate: true,
      },
    );

    return {
      t,
      tf,
      localePath,
      fingerprint,
      vaultEntries,
      vaultMessage,
      saveEntry,
      enV1,
      showV2Notice,
      v2NoticeNeverAgain,
      closeV2Notice,
      transferMessage,
      qrRows,
      showTransfer,
      downloadVault,
      importFile,
      syncConnected,
      syncMessage,
      runSync,
      disconnectSync,
      clef,
      site,
      login,
      loginPrefilled,
      matchedEntry,
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
  background: linear-gradient(135deg, rgb(var(--accent-rgb) / 0.35), rgb(var(--glow-rgb) / 0.35));
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
  box-shadow: 0 0 0 4px rgb(var(--accent-rgb) / 0.18);
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

/* Annonce du passage a la v2, en fenetre modale a l'ouverture. */
.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(0, 0, 0, 0.6);
}

.modal {
  max-width: 460px;
  width: 100%;
  padding: 22px;
  border-radius: 18px;
  border: 1px solid var(--border-strong);
  background: var(--surface);
  box-shadow: var(--shadow-strong);
}

.modal h3 {
  margin: 0 0 12px;
  font-size: 1.05rem;
}

.modal p {
  margin: 0 0 12px;
  font-size: 0.88rem;
  line-height: 1.55;
  color: var(--text-muted);
}

.modal-check {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.85rem;
  color: var(--text-muted);
  cursor: pointer;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

/* La version en cours, a cote du niveau de securite. */
.algo-badge {
  margin-left: 8px;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid var(--border-strong);
  font-size: 0.75rem;
  font-weight: 600;
}

/* Le mode de generation, en haut de la carte : lisible d'un coup d'oeil. */
.mode-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 18px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--border-soft);
}

.mode-label {
  font-size: 0.8rem;
  color: var(--text-muted);
}

.mode-switch {
  display: inline-flex;
  border-radius: 999px;
  border: 1px solid var(--border-soft);
  overflow: hidden;
}

.mode-switch button {
  border: 0;
  background: transparent;
  color: var(--text-muted);
  padding: 5px 16px;
  font-size: 0.82rem;
  font-weight: 700;
  cursor: pointer;
}

.mode-switch button.active {
  background: var(--accent-gradient);
  color: var(--text);
}

.mode-note {
  margin-top: -8px;
  margin-bottom: 16px;
}

.login-hint {
  margin: 6px 0 0;
  font-size: 0.8rem;
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
  background: var(--fill-gradient);
  border: 2px solid #fff;
  box-shadow: 0 4px 10px rgb(var(--accent-rgb) / 0.4);
  cursor: pointer;
}

input[type="range"]::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--fill-gradient);
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
  border-color: rgb(var(--accent-rgb) / 0.45);
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
  background: var(--fill-gradient);
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
  background: rgb(var(--accent-rgb) / 0.15);
  border-color: rgb(var(--accent-rgb) / 0.5);
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

/* Barre de force : lecture seule, elle illustre la ligne au-dessus. */
.strength-bar {
  width: 100%;
  margin: 0 0 8px;
  accent-color: var(--c4);
  /* Rien a regler : le curseur laisserait croire le contraire. */
  pointer-events: none;
}

.strength-bar::-webkit-slider-thumb {
  opacity: 0;
}

.strength-bar::-moz-range-thumb {
  opacity: 0;
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

  /* Sur un ecran etroit, des boutons cote a cote deviennent illisibles. */
  .panel-actions {
    flex-direction: column;
  }

  .panel-actions .ghost-btn {
    width: 100%;
  }

  .page-hero {
    padding: 50px 20px 70px;
  }
}
</style>
