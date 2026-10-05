<script setup>
import { onMounted, onUnmounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import Button from "primevue/button";
import Feedback from "../../shared/presentation/components/feedback-notice.vue";
import { useFeedback, useWorkspace } from "../../shared/presentation/use-workspace.js";
import { useFormat } from "../../shared/presentation/format.js";

const { t, locale } = useI18n();
const format = useFormat();
const { services } = useWorkspace();
const { busy, error, execute } = useFeedback();
const today = new Date().toISOString().slice(0, 10);
const from = ref(today.slice(0, 8) + "01");
const to = ref(today);
const metrics = ref(null);
let controller;

function number(value) {
  return new Intl.NumberFormat(locale.value === "es_419" ? "es-419" : "en-US", {
    maximumFractionDigits: 2,
  }).format(value);
}

async function load() {
  if (busy.value) return;
  controller?.abort();
  controller = new AbortController();
  metrics.value = null;
  await execute(async () => {
    metrics.value = await services.value.metrics.get(from.value, to.value, controller.signal);
  });
}

onMounted(load);
onUnmounted(() => controller?.abort());
</script>

<template>
  <div class="page-heading">
    <div>
      <p class="eyebrow">SMARTQUOTE</p>
      <h1>{{ t("metricsTitle") }}</h1>
      <p class="muted">{{ t("metricsSubtitle") }}</p>
    </div>
  </div>

  <Feedback :error="error" />
  <section class="panel metrics-filter" :aria-label="t('metricsFilters')">
    <form class="metrics-filter-form" @submit.prevent="load">
      <label>
        <span>{{ t("from") }}</span>
        <input v-model="from" class="p-inputtext" type="date" required :max="to" />
      </label>
      <label>
        <span>{{ t("to") }}</span>
        <input v-model="to" class="p-inputtext" type="date" required :min="from" />
      </label>
      <Button type="submit" :label="t('applyFilters')" icon="pi pi-filter" :loading="busy" />
    </form>
    <p class="muted metrics-note">{{ t("metricsFilterNote") }}</p>
  </section>

  <template v-if="metrics">
    <p class="muted metrics-period">
      {{ t("metricsPeriod") }}: {{ format.date(metrics.from) }} – {{ format.date(metrics.to) }}
      · {{ t("metricsOrderStatus") }}: {{ t("statuses.Issued") }}
      · {{ t("metricsOrderCount") }}: {{ number(metrics.orderCount) }}
    </p>
    <div class="metrics-grid">
      <section class="panel metrics-card" :aria-label="t('averageProcessingTime')">
        <p class="eyebrow">{{ t("averageProcessingTime") }}</p>
        <strong class="metrics-value" data-testid="average-processing-hours">
          {{ metrics.averageProcessingHours == null
            ? t("notAvailable")
            : number(metrics.averageProcessingHours) + " " + t("hours") }}
        </strong>
        <p class="muted">{{ t("metricsSamples") }}: {{ number(metrics.timeSampleCount) }}</p>
        <p class="metrics-definition">{{ t("timeMetricDefinition") }}</p>
      </section>
      <section class="panel metrics-card" :aria-label="t('comparativeSavings')">
        <p class="eyebrow">{{ t("comparativeSavings") }}</p>
        <strong class="metrics-value" data-testid="comparative-savings">
          {{ metrics.comparativeSavings == null
            ? t("notAvailable")
            : format.money(metrics.comparativeSavings, metrics.savingsCurrency) }}
        </strong>
        <p class="muted">{{ t("metricsSamples") }}: {{ number(metrics.savingsSampleCount) }}</p>
        <p class="metrics-definition">{{ t("savingsMetricDefinition") }}</p>
      </section>
    </div>
  </template>
</template>

<style scoped>
.metrics-filter { margin-bottom: 20px; }
.metrics-filter-form { display: flex; align-items: end; flex-wrap: wrap; gap: 16px; }
.metrics-filter-form label { display: grid; gap: 6px; font-weight: 600; }
.metrics-filter-form input { min-height: 40px; }
.metrics-note { margin: 14px 0 0; }
.metrics-period { margin: 20px 0; }
.metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; }
.metrics-card { min-width: 0; }
.metrics-value { display: block; margin: 12px 0; font-size: clamp(1.5rem, 4vw, 2.3rem); }
.metrics-definition { line-height: 1.5; }
</style>
