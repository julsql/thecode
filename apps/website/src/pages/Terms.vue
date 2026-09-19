<template>
  <LegalDocument kind="terms" />
</template>

<script lang="ts">
import { defineComponent } from "vue";
import LegalDocument from "./LegalDocument.vue";

export default defineComponent({ name: "Terms", components: { LegalDocument } });
</script>
