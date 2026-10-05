<script setup>
import { ref, onUnmounted } from "vue";
import { useI18n } from "vue-i18n";
import Button from "primevue/button";
import InputText from "primevue/inputtext";
import Field from "../../shared/presentation/components/form-field.vue";
import Feedback from "../../shared/presentation/components/feedback-notice.vue";
import {
  useWorkspace,
  useFeedback,
} from "../../shared/presentation/use-workspace.js";
import { useFormat } from "../../shared/presentation/format.js";

const { t, locale } = useI18n();
const format = useFormat();
const { services } = useWorkspace();
const { busy, error, execute } = useFeedback();
const taxId = ref("");
const performance = ref(null);
let controller;

function score(value) {
  if (value == null) return t("notAvailable");
  return new Intl.NumberFormat(locale.value === "es_419" ? "es-419" : "en-US", {
    maximumFractionDigits: 2,
  }).format(value);
}

async function search() {
  if (busy.value) return;
  controller?.abort();
  controller = new AbortController();
  performance.value = null;
  await execute(async () => {
    performance.value = await services.value.suppliers.performance(
      taxId.value,
      controller.signal,
    );
  });
}

onUnmounted(() => controller?.abort());
</script>

<template>
  <div class="page-heading">
    <div>
      <p class="eyebrow">SMARTQUOTE</p>
      <h1>{{ t("suppliersTitle") }}</h1>
      <p class="muted">{{ t("suppliersSubtitle") }}</p>
    </div>
  </div>

  <Feedback :error="error" />

  <section class="panel">
    <form class="stack" @submit.prevent="search">
      <Field :label="t('taxId')" v-slot="{ id }"
        ><InputText
          :id="id"
          v-model="taxId"
          inputmode="numeric"
          maxlength="11"
          required
          :disabled="busy"
      /></Field>
      <div>
        <Button type="submit" :label="t('lookUpSupplier')" icon="pi pi-search" :loading="busy" />
      </div>
    </form>
  </section>

  <section v-if="performance" class="panel stack">
    <h2>{{ t("supplierPerformance") }}</h2>
    <p class="muted">{{ t("taxId") }}: {{ performance.supplierTaxIdentifier }}</p>
    <p v-if="!performance.evaluationCount" class="empty-state">
      {{ t("noEvaluations") }}
    </p>
    <div v-else class="form-grid">
      <div>
        <small class="muted">{{ t("overallScore") }}</small>
        <h3>{{ score(performance.overallScore) }}</h3>
      </div>
      <div>
        <small class="muted">{{ t("onTimeScore") }}</small>
        <h3>{{ score(performance.averageOnTimeScore) }}</h3>
      </div>
      <div>
        <small class="muted">{{ t("qualityScore") }}</small>
        <h3>{{ score(performance.averageQualityScore) }}</h3>
      </div>
      <div>
        <small class="muted">{{ t("evaluationCount") }}</small>
        <h3>{{ performance.evaluationCount }}</h3>
        <p class="muted">
          {{ format.date(performance.firstEvaluatedAt) }} – {{ format.date(performance.lastEvaluatedAt) }}
        </p>
      </div>
    </div>
  </section>
</template>
