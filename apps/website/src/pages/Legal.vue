<template>
  <LegalDocument kind="legalNotice" />
</template>

<script lang="ts">
import { defineComponent } from "vue";
import LegalDocument from "./LegalDocument.vue";

export default defineComponent({ name: "Legal", components: { LegalDocument } });
</script>
