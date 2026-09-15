<script setup>
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import Dialog from "primevue/dialog";
const { t } = useI18n(),
  visible = ref(false);
</script>
<template>
  <footer class="app-footer">
    <button class="text-button" @click="visible = true">
      {{ t("terms") }}
    </button>
  </footer>
  <Dialog
    v-model:visible="visible"
    modal
    :header="t('terms')"
    :style="{ width: '36rem' }"
    ><p>{{ t("termsIntro") }}</p>
    <p>{{ t("termsReview") }}</p>
    <p>{{ t("termsData") }}</p>
    <p class="muted">{{ t("termsDraft") }}</p></Dialog
  >
</template>
