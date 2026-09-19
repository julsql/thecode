<!--
  Rendu d'un document légal.

  Un seul gabarit pour les trois : mentions légales, conditions de vente et
  politique de confidentialité ont la même forme — un titre, une date, des
  sections. Trois pages identiques à l'apparence près auraient fini par
  diverger, et c'est précisément sur ces pages-là qu'une incohérence se
  remarque.
-->
<template>
  <div class="page-wrapper">
    <header class="page-hero">
      <div class="page-hero-inner">
        <h1>{{ doc.title }}</h1>
        <p class="page-hero-sub">
          <i>{{ t("legal_updated") }} {{ doc.updated }}</i>
        </p>
      </div>
    </header>

    <div class="legal-container fadeIn">
      <article class="legal-card">
        <p v-for="(line, index) in doc.intro || []" :key="`intro-${index}`" class="legal-intro">
          <span v-html="emphasise(line)"></span>
        </p>

        <section v-for="section in doc.sections" :key="section.heading">
          <h2>{{ section.heading }}</h2>
          <p v-for="(line, index) in section.paragraphs || []" :key="index">
            <span v-html="emphasise(line)"></span>
          </p>
          <ul v-if="section.items">
            <li v-for="(item, index) in section.items" :key="index">{{ item }}</li>
          </ul>
        </section>

        <p class="legal-contact">
          <a :href="`mailto:${email}`">{{ email }}</a>
        </p>
      </article>
    </div>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent } from "vue";
import { useI18n } from "@/i18n";
import { legalDoc, type LegalKind } from "@/legal";
import { IDENTITY } from "@/legal/identity";
import { loadService, service } from "@/service";

export default defineComponent({
  name: "LegalDocument",
  props: {
    kind: { type: String as () => LegalKind, required: true },
  },
  setup(props) {
    const { t, lang } = useI18n();
    // Les conditions de vente et la politique changent selon qu'une offre
    // payante existe : le service est seul à le savoir.
    loadService();
    const doc = computed(() => legalDoc(props.kind, lang.value, service.plans.plansEnforced));

    /**
     * Rend gras ce qui est encadré de `**`.
     *
     * Les textes sont du texte, pas du HTML : ils sont écrits pour être relus
     * par quelqu'un qui ne lit pas de balises. Seule cette mise en valeur est
     * interprétée, et l'échappement est fait d'abord — une phrase juridique
     * n'a aucune raison de pouvoir injecter du HTML.
     */
    const emphasise = (line: string): string => {
      const escaped = line
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
      return escaped.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    };

    return { t, doc, emphasise, email: IDENTITY.email };
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
  max-width: 760px;
  margin: 0 auto;
}

.page-hero h1 {
  font-size: clamp(2rem, 4vw, 2.8rem);
  margin: 0 0 12px;
  color: #fff;
}

.page-hero-sub {
  margin: 0;
  color: rgba(255, 255, 255, 0.78);
}

.legal-container {
  max-width: 820px;
  margin: -50px auto 0;
  padding: 0 24px 80px;
  position: relative;
  z-index: 2;
}

.legal-card {
  background: var(--surface);
  border: 1px solid var(--border-soft);
  border-radius: 18px;
  padding: 34px 32px;
  box-shadow: var(--shadow-soft);
  line-height: 1.7;
}

.legal-intro {
  color: var(--text);
}

.legal-card h2 {
  margin: 30px 0 10px;
  font-size: 1.1rem;
}

.legal-card p {
  margin: 0 0 12px;
  color: var(--text-muted);
}

.legal-card ul {
  margin: 0 0 12px;
  padding-left: 20px;
  color: var(--text-muted);
}

.legal-card li {
  margin-bottom: 6px;
}

.legal-card :deep(strong) {
  color: var(--text);
}

.legal-contact {
  margin-top: 30px;
  padding-top: 18px;
  border-top: 1px solid var(--border-soft);
}

.legal-contact a {
  color: var(--c4);
}

@media (max-width: 600px) {
  .legal-card {
    padding: 24px 20px;
  }
}
</style>
