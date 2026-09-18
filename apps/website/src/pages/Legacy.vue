<template>
  <main class="legacy">
    <h1>Retrouver un ancien mot de passe</h1>

    <p class="intro">
      Cette page calcule les mots de passe de l'<strong>ancien algorithme (v1)</strong>, celui
      d'avant l'unification de la canonicalisation des domaines. Elle reste en ligne indéfiniment :
      un compte oublié doit rester récupérable, même des années plus tard.
    </p>

    <p class="intro">
      Tout est calculé dans votre navigateur. Rien n'est envoyé nulle part, rien n'est enregistré.
    </p>

    <form class="fields" @submit.prevent>
      <label for="legacy_key">Clef maîtresse</label>
      <div class="row">
        <input
          id="legacy_key"
          v-model="masterKey"
          :type="showKey ? 'text' : 'password'"
          autocomplete="off"
        />
        <button type="button" @click="showKey = !showKey">
          {{ showKey ? "Masquer" : "Afficher" }}
        </button>
      </div>

      <p v-if="fingerprint.text" class="fingerprint">
        Empreinte
        <span class="chip" :style="{ backgroundColor: fingerprint.color }">
          {{ fingerprint.text }}
        </span>
        <span class="hint">
          — si elle ne correspond pas à celle dont vous avez l'habitude, la clef est mal saisie.
        </span>
      </p>

      <label for="legacy_site">Site</label>
      <input
        id="legacy_site"
        v-model="site"
        type="text"
        placeholder="google.com, www.google.com, co.uk…"
      />
      <p class="hint">
        Essayez la forme exacte que vous utilisiez à l'époque : <code>www.google.com</code> et
        <code>google.com</code> ne donnaient pas le même mot de passe.
      </p>
    </form>

    <section v-if="results.length" class="results">
      <h2>{{ results.length }} possibilités</h2>
      <p class="hint">
        Les réglages n'étaient enregistrés nulle part : reconnaissez le bon mot de passe dans cette
        liste.
      </p>

      <ul>
        <li v-for="variant in results" :key="variant.password">
          <code>{{ variant.password }}</code>
          <span class="meta">{{ variant.label }}</span>
        </li>
      </ul>
    </section>
  </main>
</template>

<script lang="ts">
import { computed, defineComponent, ref, watch } from "vue";
import { generatePassword } from "@/utils";
import { keyFingerprint, type Fingerprint } from "@/fingerprint";

/**
 * Longueurs et jeux de caractères réellement utilisés. Énumérer les seize
 * combinaisons possibles noierait la bonne réponse : personne ne génère un mot
 * de passe de symboles seuls.
 */
const LENGTHS = [20, 16, 12, 8, 32];
const CHARSETS: Array<[string, [boolean, boolean, boolean, boolean]]> = [
  ["tout", [true, true, true, true]],
  ["sans symboles", [true, true, false, true]],
  ["lettres seules", [true, true, false, false]],
  ["minuscules et chiffres", [true, false, false, true]],
];

interface Variant {
  password: string;
  label: string;
}

export default defineComponent({
  name: "LegacyPage",
  setup() {
    const masterKey = ref("");
    const site = ref("");
    const showKey = ref(false);
    const results = ref<Variant[]>([]);
    const fingerprint = ref<Fingerprint>({ text: "", color: "", colorName: "" });

    watch(masterKey, async (value) => {
      fingerprint.value = await keyFingerprint(value);
    });

    watch([masterKey, site], async ([key, siteValue]) => {
      if (!key || !siteValue) {
        results.value = [];
        return;
      }

      const seen = new Set<string>();
      const out: Variant[] = [];
      for (const length of LENGTHS) {
        for (const [label, [lower, upper, symbols, numbers]] of CHARSETS) {
          // Le site est passé tel quel : cette page sert justement à retrouver
          // ce que donnait une saisie non canonicalisée.
          const password = await generatePassword(
            siteValue,
            key,
            length,
            lower,
            upper,
            symbols,
            numbers,
          );
          if (!password || seen.has(password)) continue;
          seen.add(password);
          out.push({ password, label: `${length} caractères, ${label}` });
        }
      }
      results.value = out;
    });

    return { masterKey, site, showKey, results, fingerprint: computed(() => fingerprint.value) };
  },
});
</script>

<style scoped>
.legacy {
  max-width: 44rem;
  margin: 0 auto;
  padding: 2rem 1rem;
}
.intro {
  line-height: 1.6;
}
.fields {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin: 2rem 0;
}
.row {
  display: flex;
  gap: 0.5rem;
}
.row input {
  flex: 1;
}
.fingerprint {
  margin: 0.25rem 0 1rem;
}
.chip {
  display: inline-block;
  padding: 0.1rem 0.5rem;
  border-radius: 0.25rem;
  color: #fff;
  font-family: monospace;
  font-weight: 700;
}
.hint {
  font-size: 0.875rem;
  opacity: 0.75;
  margin: 0.25rem 0 0.75rem;
}
.results ul {
  list-style: none;
  padding: 0;
}
.results li {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.5rem 0;
  border-bottom: 1px solid rgb(128 128 128 / 0.2);
}
.results code {
  font-size: 1rem;
  word-break: break-all;
}
.meta {
  font-size: 0.8125rem;
  opacity: 0.7;
  white-space: nowrap;
}
</style>
