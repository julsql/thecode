<template>
  <!-- Annonce du passage à la v2, à l'ouverture. Fermer la fait revenir la
       prochaine fois ; seule la case à cocher la retire pour de bon. -->
  <div v-if="showV2Notice" class="modal-backdrop" @click.self="closeV2Notice">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="v2NoticeTitle">
      <h3 id="v2NoticeTitle">Nouvel algorithme</h3>
      <p>
        Les mots de passe se calculent désormais avec un nouvel algorithme (v2). Ceux déjà posés sur
        vos sites viennent de l'ancien et n'ont pas changé.
      </p>
      <p>
        Le remplissage automatique utilise le nouveau : pour un site que vous n'avez pas encore mis
        à jour, utilisez « Générer en v1 (ancien) », ou passez l'entrée en v2 depuis le carnet après
        avoir changé le mot de passe sur le site.
      </p>
      <label class="modal-check">
        <input v-model="v2NoticeNeverAgain" type="checkbox" />
        Ne plus afficher
      </label>
      <div class="modal-actions">
        <button type="button" class="ghost-btn primary" @click="closeV2Notice">Fermer</button>
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
            <h3 class="panel-title">Carnet</h3>
            <p class="panel-lead">
              Retient les réglages de chaque site, pour ne plus avoir à se souvenir qu'un compte a
              été créé sans symboles, ni sous quel identifiant.
            </p>

            <div class="panel-actions centered">
              <button type="button" class="ghost-btn" @click="saveEntry">
                {{ vaultEntries.length ? "Mettre à jour l'entrée" : "Enregistrer ce site" }}
              </button>
            </div>

            <p v-if="vaultMessage" class="hint">{{ vaultMessage }}</p>
            <p v-else-if="vaultEntries.length" class="hint">
              {{ vaultEntries.length }} entrée(s) connue(s) pour ce site.
            </p>

            <!-- Renouveler et migrer : les deux actions qui changent un mot de
                 passe deja en service. Jamais les deux a la fois — le compteur
                 n'entre pas dans la derivation v1, et une entree v2 n'a plus
                 rien a migrer. -->
            <ul v-if="vaultEntries.length && !pending" class="entry-list">
              <li v-for="entry in vaultEntries" :key="entry.id">
                <span class="entry-name">{{ entry.label || entry.siteKey }}</span>
                <!-- Jamais désactivé : un bouton éteint n'explique rien et ne
                     propose rien. C'est le clic qui dit ce que l'offre
                     complète apporte, et où l'obtenir. -->
                <button
                  type="button"
                  class="ghost-btn small"
                  @click="proposeChange(entry, entry.v >= 2)"
                >
                  {{ entry.v >= 2 ? "Renouveler" : "Passer en v2" }}
                </button>
              </li>
            </ul>

            <!-- Le compteur est ce qui permet de changer un mot de passe sans
                 changer sa clef maitresse : il fait partie de l'offre
                 complete. La migration v1 vers v2, elle, reste ouverte a
                 tous — c'est une mise a niveau, pas un service. -->
            <p v-if="!renewAllowed && vaultEntries.some((e) => e.v >= 2)" class="hint">
              {{ t("gen_renew_paid") }}
              <router-link :to="localePath('pricing')">{{ t("nav_pricing") }}</router-link>
            </p>

            <!-- Les deux cote a cote : le nouveau ne sert a rien tant qu'il n'a
                 pas ete pose sur le site, et l'ancien reste celui qui connecte. -->
            <div v-if="pending" class="change-box">
              <p class="hint">Mot de passe actuel</p>
              <p>
                <code>{{ pending.before }}</code>
              </p>
              <p class="hint">Nouveau mot de passe</p>
              <p>
                <code>{{ pending.after }}</code>
              </p>
              <p class="hint">
                Changez-le sur le site, puis confirmez. Le nouveau ne sert à rien tant que ce n'est
                pas fait, et l'ancien reste celui qui vous connecte.
              </p>
              <div class="panel-actions">
                <button type="button" class="ghost-btn primary" @click="applyChange">
                  Confirmer
                </button>
                <button type="button" class="ghost-btn" @click="pending = null">Annuler</button>
              </div>
            </div>
          </section>

          <!-- Transfert hors serveur : le QR pour envoyer vers un téléphone,
               le fichier pour aller vers un autre navigateur. Le contenu est
               chiffré avec une clef dérivée de la clef maîtresse, donc une
               photo de l'écran ne révèle rien. -->
          <section class="panel">
            <h3 class="panel-title">Transférer le carnet</h3>
            <p class="panel-lead">
              Pour emporter le carnet sur un autre appareil, sans serveur ni compte. Le contenu est
              chiffré : une photo de l'écran, ou le fichier seul, ne révèlent rien.
            </p>

            <div class="panel-actions fill">
              <button type="button" class="ghost-btn" @click="showTransfer">
                Afficher un QR code
                <small>à scanner depuis le téléphone</small>
              </button>
              <button type="button" class="ghost-btn" @click="downloadVault">
                Télécharger un fichier
                <small>pour un autre navigateur</small>
              </button>
              <!-- Le champ natif est masqué : « Choose File » n'est ni
                   traduisible ni stylable, et ne dit pas ce qu'on attend. -->
              <label class="ghost-btn as-label">
                Importer un fichier
                <small>reçu d'un autre appareil</small>
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
              <p class="hint">Scannez-le depuis l'application sur votre téléphone.</p>
            </div>
          </section>

          <!-- Le carnet est chiffré avant de quitter le navigateur : le serveur
               ne reçoit que des blocs opaques. -->
          <section class="panel">
            <h3 class="panel-title">Synchronisation</h3>
            <p class="panel-lead">
              Garde le carnet à jour entre vos appareils, par le serveur. Il est chiffré avant de
              partir : le service ne voit ni vos sites, ni vos identifiants. Le mot de passe du
              compte n'est pas votre clef.
            </p>

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
                  Synchroniser maintenant
                </button>
                <button type="button" class="ghost-btn" @click="disconnectSync">
                  Se déconnecter
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
import { defineComponent, ref, watch, computed, onMounted } from "vue";
import { generatePassword, calculateEntropyBits, getSecurityLevel } from "@/utils";
import { canonicalSite, loadPublicSuffixList } from "@/canonicalSite";
import { keyFingerprint, type Fingerprint } from "@/fingerprint";
import { clearSession, loadSession, saveSession, syncVault, SyncError } from "@/sync";
import { isPaidPlan, refreshPlan } from "@/account";
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
      const session = loadSession();
      if (session) refreshPlan(session).then((plan) => (renewAllowed.value = isPaidPlan(plan)));

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
    /** Changement propose, en attente de confirmation. */
    const pending = ref<{
      entryId: string;
      renew: boolean;
      before: string;
      after: string;
    } | null>(null);
    const syncConnected = ref(Boolean(loadSession()));
    const syncMessage = ref("");
    /**
     * Le renouvellement demande l'offre complète.
     *
     * Décidé sur l'appareil, forcément : le compteur voyage à l'intérieur du
     * bloc chiffré, le serveur ne le voit pas et ne peut donc rien en dire.
     */
    const renewAllowed = ref(isPaidPlan(loadSession()?.plan));

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
      const entry = vaultEntries.value[0];
      const mdp = entry
        ? await passwordForEntry(entry, entry.counter, version)
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
            });
      if (generation !== generationCourante) return;
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
      if (renew && !renewAllowed.value) {
        vaultMessage.value = t("gen_renew_paid");
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
    watch(enV1, () => genererMotDePasse());

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
        // Enregistrer un mot de passe genere en v1 sous une entree v2 donnerait
        // un autre mot de passe a la relecture.
        vault.entries.push(
          newEntry(domain, { length: Number(longueur.value), charset, v: enV1.value ? 1 : 2 }),
        );
        vaultMessage.value = "Site enregistré.";
      }

      saveVault(vault);
      refreshVault();
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
        // Un abonnement pris entre-temps doit se voir sans recharger la page.
        refreshPlan(result.session).then((plan) => (renewAllowed.value = isPaidPlan(plan)));
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
      localePath,
      fingerprint,
      vaultEntries,
      vaultMessage,
      saveEntry,
      pending,
      proposeChange,
      applyChange,
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
      renewAllowed,
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

.entry-list {
  list-style: none;
  margin: 12px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.entry-list li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 12px;
  border-radius: 12px;
  background: var(--surface-elevated);
  border: 1px solid var(--border-soft);
}

.entry-name {
  font-size: 0.9rem;
  word-break: break-all;
}

.change-box {
  margin-top: 14px;
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
