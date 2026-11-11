<script setup>
import { ref, computed, onMounted, watch } from "vue";
import { useI18n } from "vue-i18n";
import Button from "primevue/button";
import InputNumber from "primevue/inputnumber";
import Message from "primevue/message";
import Tag from "primevue/tag";
import Feedback from "../../shared/presentation/components/feedback-notice.vue";
import {
  useWorkspace,
  useFeedback,
} from "../../shared/presentation/use-workspace.js";
import { useFormat } from "../../shared/presentation/format.js";
import { MAX_VARIANTS } from "../domain/sensitivity.entity.js";
// US19: how the recommendation changes when the commercial weights vary.
const props = defineProps({
  request: { type: Object, required: true },
  quotes: { type: Array, required: true },
  scenario: { type: Object, default: null },
  busy: Boolean,
  execute: { type: Function, required: true },
  acceptRun: { type: Function, required: true },
});
const emit = defineEmits(["scenario"]);
const { t } = useI18n(),
  format = useFormat(),
  { services } = useWorkspace(),
  // Own loader: the page may still be busy when this panel mounts.
  { error: loadError, execute: loadSafely } = useFeedback();
const analyses = ref([]),
  analysis = ref(null),
  next = ref(null);
const weighted = computed(
  () => props.scenario?.criteria.filter((c) => c.mode === "Weighted") ?? [],
);
const price = computed(() => weighted.value.find((c) => c.category === "Price"));
const delivery = computed(() => weighted.value.find((c) => c.category === "DeliveryTime"));
const commercial = computed(
  () => (price.value?.weight ?? 0) + (delivery.value?.weight ?? 0),
);
// Suggested variations around the current price weight, inside the commercial range.
const priceWeights = ref(
  [20, 40, 50, 60, 80].filter(
    (w) => w !== price.value?.weight && w <= commercial.value,
  ),
);
const eligibleQuotes = computed(() => props.quotes.filter((q) => q.verified).length);
const canRun = computed(
  () =>
    props.request.status === "Evaluation" &&
    props.scenario?.status === "Active" &&
    price.value &&
    delivery.value &&
    eligibleQuotes.value >= 2 &&
    priceWeights.value.length > 0,
);
const supplier = (id) =>
  id
    ? (props.quotes.find((q) => q.quotationId === id)?.supplierBusinessName ??
      id.slice(0, 8))
    : t("noRecommendation");
// Criteria of the analyzed scenario version, keyed by scenario id.
const analyzedCriteria = ref({});
async function loadAnalyzedCriteria(entry) {
  if (!entry || analyzedCriteria.value[entry.scenarioId]) return;
  const source =
    entry.scenarioId === props.scenario?.scenarioId
      ? props.scenario
      : await services.value.evaluations.get(entry.scenarioId);
  analyzedCriteria.value = { ...analyzedCriteria.value, [entry.scenarioId]: source.criteria };
}
// Not through loadSafely: it ignores calls while the initial load is still running.
watch(analysis, (entry) =>
  loadAnalyzedCriteria(entry).catch((e) => {
    loadError.value = t("error." + (e.code || "unexpected"));
  }),
);
const weightOf = (configuration, category) =>
  analysis.value?.weightFor(
    configuration,
    category,
    analyzedCriteria.value[analysis.value.scenarioId] ?? [],
  );
const scoreOf = (configuration) =>
  configuration.results.find(
    (r) => r.quotationId === configuration.recommendedQuotationId,
  )?.score;
function addVariant() {
  const value = next.value;
  if (
    value == null ||
    value === price.value?.weight ||
    priceWeights.value.includes(value) ||
    priceWeights.value.length >= MAX_VARIANTS
  )
    return;
  priceWeights.value = [...priceWeights.value, value].sort((a, b) => a - b);
  next.value = null;
}
async function load() {
  analyses.value = await services.value.evaluations.sensitivityAnalyses(
    props.request.requestId,
  );
  analysis.value =
    analyses.value.find((a) => a.id === analysis.value?.id) ?? analyses.value[0] ?? null;
}
async function run() {
  await props.execute(async () => {
    analysis.value = await services.value.evaluations.analyzeSensitivity(
      props.scenario,
      priceWeights.value,
    );
    analyses.value = [analysis.value, ...analyses.value];
  }, t("sensitivityDone"));
}
// Scenario 4: a configuration of interest becomes an official criteria version and
// simulation; the order still needs the regular approval and its validations.
async function promote(configuration) {
  await props.execute(async () => {
    const { scenario, simulation } = await services.value.evaluations.promoteSensitivity(
      analysis.value,
      configuration.id,
    );
    emit("scenario", scenario);
    await props.acceptRun(simulation);
  }, t("sensitivityPromoted"));
}
onMounted(() => loadSafely(load));
</script>
<template>
  <div class="section-heading">
    <div>
      <h2>{{ t("sensitivityTitle") }}</h2>
      <p class="muted">{{ t("sensitivityIntro") }}</p>
    </div>
  </div>
  <Feedback :error="loadError" />
  <section class="panel stack">
    <p v-if="!scenario || !price || !delivery" class="help-text">
      {{ t("sensitivityNeedsScenario") }}
    </p>
    <template v-else>
      <p>
        {{ t("sensitivityBaseline") }}: {{ t("category.Price") }} {{ price.weight }}% ·
        {{ t("category.DeliveryTime") }} {{ delivery.weight }}%
      </p>
      <div class="inline-row" role="list" :aria-label="t('sensitivityVariants')">
        <Tag
          v-for="value in priceWeights"
          :key="value"
          role="listitem"
          severity="secondary"
          rounded
          ><span
            >{{ t("category.Price") }} {{ value }}% · {{ t("category.DeliveryTime") }}
            {{ commercial - value }}%</span
          ><button
            type="button"
            class="text-button"
            :aria-label="t('removeVariant') + ' ' + value + '%'"
            :disabled="busy"
            @click="priceWeights = priceWeights.filter((w) => w !== value)"
          >
            <i class="pi pi-times" /></button
        ></Tag>
      </div>
      <div class="inline-row">
        <label for="sensitivity-weight">{{ t("priceWeight") }}</label>
        <InputNumber
          input-id="sensitivity-weight"
          v-model="next"
          :min="0"
          :max="commercial"
          :max-fraction-digits="2"
          suffix="%"
          :disabled="busy"
        /><Button
          :label="t('addVariant')"
          icon="pi pi-plus"
          outlined
          :disabled="busy || next == null || priceWeights.length >= MAX_VARIANTS"
          @click="addVariant"
        /><Button
          :label="t('runSensitivity')"
          icon="pi pi-chart-line"
          :disabled="busy || !canRun"
          @click="run"
        />
      </div>
      <p class="help-text">{{ t("sensitivityHelp") }}</p>
    </template>
  </section>
  <template v-if="analysis">
    <div class="comparison-toolbar">
      <span class="muted"
        >{{ format.date(analysis.createdAt, true) }} · {{ t("version") }}
        {{ analysis.criteriaVersion }}</span
      >
      <div v-if="analyses.length > 1" class="inline-row">
        <Button
          v-for="entry in analyses"
          :key="entry.id"
          :label="format.date(entry.createdAt, true)"
          text
          :disabled="busy || entry.id === analysis.id"
          @click="analysis = entry"
        />
      </div>
    </div>
    <Message v-if="!analysis.isCurrent" severity="warn">{{ t("staleAnalysis") }}</Message>
    <Message :severity="analysis.isStable ? 'success' : 'warn'" role="status">
      <strong>{{
        analysis.isStable
          ? t("sensitivityStable")
          : t("sensitivityChanges", { count: analysis.changedCount })
      }}</strong>
      {{ t("sensitivityScope") }}
    </Message>
    <section class="panel table-panel">
      <div class="table-scroll">
        <table class="comparison-table">
          <thead>
            <tr>
              <th>{{ t("configuration") }}</th>
              <th>{{ t("category.Price") }}</th>
              <th>{{ t("category.DeliveryTime") }}</th>
              <th>{{ t("recommended") }}</th>
              <th>{{ t("score") }}</th>
              <th>{{ t("sensitivityOutcome") }}</th>
              <th>{{ t("actions") }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="configuration in analysis.comparison" :key="configuration.id">
              <td>
                {{ configuration.isBaseline ? t("baseline") : t("variant") + " " + configuration.variantNumber }}
              </td>
              <td>{{ weightOf(configuration, "Price") ?? "—" }}%</td>
              <td>{{ weightOf(configuration, "DeliveryTime") ?? "—" }}%</td>
              <td>
                <strong>{{ supplier(configuration.recommendedQuotationId) }}</strong
                ><small v-if="configuration.tiedWinnerIds.length > 1" class="muted block">{{
                  t("tieNote")
                }}</small>
              </td>
              <td>
                <template v-if="scoreOf(configuration) != null"
                  ><strong class="score">{{ format.score(scoreOf(configuration)) }}</strong>
                  / 100</template
                ><template v-else>—</template>
              </td>
              <td :class="configuration.changesRecommendation ? 'invalid' : 'eligible'">
                {{
                  configuration.isBaseline
                    ? t("baseline")
                    : configuration.changesRecommendation
                      ? t("recommendationChanges")
                      : t("recommendationHolds")
                }}
              </td>
              <td>
                <Button
                  v-if="!configuration.isBaseline"
                  :label="t('promoteConfiguration')"
                  text
                  :disabled="busy || !analysis.isCurrent"
                  @click="promote(configuration)"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
    <p class="help-text">{{ t("sensitivityPromoteHelp") }}</p>
  </template>
</template>
