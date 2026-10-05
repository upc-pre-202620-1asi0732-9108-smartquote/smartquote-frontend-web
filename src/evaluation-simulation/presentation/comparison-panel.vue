<script setup>
import { ref, computed } from "vue";
import { useI18n } from "vue-i18n";
import Button from "primevue/button";
import Slider from "primevue/slider";
import Message from "primevue/message";
import { useWorkspace } from "../../shared/presentation/use-workspace.js";
import { useFormat } from "../../shared/presentation/format.js";
import { defaultCriteria } from "../domain/evaluation-scenario.entity.js";
const props = defineProps({
  request: { type: Object, required: true },
  quotes: { type: Array, required: true },
  scenario: { type: Object, default: null },
  simulation: { type: Object, default: null },
  busy: Boolean,
  execute: { type: Function, required: true },
  acceptRun: { type: Function, required: true },
});
const emit = defineEmits(["scenario", "order"]);
const { t } = useI18n(),
  format = useFormat(),
  { services, session } = useWorkspace();
const criteria = ref(
    JSON.parse(
      JSON.stringify(
        props.scenario?.criteria ?? defaultCriteria(props.request),
      ),
    ),
  );
const weighted = computed(() =>
  criteria.value.filter((c) => c.mode === "Weighted"),
);
const price = computed(() => weighted.value.find((c) => c.category === "Price"));
const delivery = computed(() => weighted.value.find((c) => c.category === "DeliveryTime"));
function setPriceWeight(value) {
  if (price.value && delivery.value) {
    price.value.weight = value;
    delivery.value.weight = 100 - value;
  }
}
const weightSum = computed(() =>
  weighted.value.reduce((sum, c) => sum + (c.weight || 0), 0),
);
const dirty = computed(
  () =>
    JSON.stringify(criteria.value) !==
    JSON.stringify(props.scenario?.criteria ?? defaultCriteria(props.request)),
);
const verified = computed(() => props.quotes.filter((q) => q.verified));
const canRun = computed(
  () =>
    props.request.status === "Evaluation" &&
    verified.value.length >= 2 &&
    verified.value.every((q) => ["PEN", "USD"].includes(q.currency?.toUpperCase())) &&
    weightSum.value === 100,
);
const winner = computed(() =>
  props.quotes.find(
    (q) => q.quotationId === props.simulation?.recommendation?.quotationId,
  ),
);
const winnerEvaluation = computed(() =>
  props.simulation?.evaluations.find(
    (evaluation) => evaluation.quotationId === winner.value?.quotationId,
  ),
);
async function run() {
  await props.execute(async () => {
    let current = props.scenario;
    if (!current || dirty.value) {
      current = await services.value.evaluations.save(props.request.requestId, criteria.value, current);
      emit("scenario", current);
    }
    await props.acceptRun(
      await services.value.evaluations.simulate(current.scenarioId),
    );
  });
}
const name = (id) =>
  props.quotes.find((q) => q.quotationId === id)?.supplierBusinessName || id;
function friendlyExplanation(raw) {
  if (!raw) return t("criterionNoEvidence");
  const legacy = /^(.*?): '([^']*)' (satisfies|does not satisfy) (Equals|Contains|GreaterThanOrEqual|LessThanOrEqual) '([^']*)'\.$/.exec(raw);
  if (!legacy) return raw;
  const [, criterion, observed, outcome, operator, expected] = legacy;
  return `${criterion}: ${observed === "N/A" ? t("criterionNoEvidence") : `${t("criterionObserved")} ${observed}`}; ${t("criterionNeeds")} ${t("operators." + operator)} ${expected}. ${t(outcome === "satisfies" ? "criterionPass" : "criterionFail")}`;
}
</script>
<template>
  <div class="section-heading">
    <div>
      <h2>{{ t("criteria") }}</h2>
      <p class="muted">{{ t("criteriaIntro") }}</p>
    </div>
    <span v-if="scenario" class="muted"
      >{{ t("version") }} {{ scenario.version }}</span
    >
  </div>
  <section class="panel">
    <div v-if="price && delivery" class="weights-grid">
      <div>
        <label for="price-weight">{{ t('category.Price') }}: {{ price.weight }}%</label>
        <Slider
          id="price-weight"
          :model-value="price.weight"
          :min="0"
          :max="100"
          :step="5"
          :disabled="busy"
          :aria-label="t('priceWeight')"
          @update:model-value="setPriceWeight"
        />
        <span class="muted">{{ t('category.DeliveryTime') }}: {{ delivery.weight }}%</span>
      </div>
      <div class="weight-total">
        <small>{{ t("weightTotal") }}</small
        ><strong :class="{ invalid: weightSum !== 100 }"
          >{{ weightSum }}%</strong
        >
      </div>
    </div>
    <details class="technical-criteria">
      <summary>
        {{ t("mandatory") }} ·
        {{ criteria.filter((c) => c.mode === "Mandatory").length }}
      </summary>
      <ul class="requirements">
        <li
          v-for="criterion in criteria.filter((c) => c.mode === 'Mandatory')"
          :key="criterion.targetField"
        >
          <i class="pi pi-check-circle" />
          <div>
            <strong>{{ criterion.name }}</strong
            ><span
              >{{ t("operators." + criterion.operator) }}
              {{ criterion.expectedValue }} {{ criterion.unitOfMeasure }}</span
            >
          </div>
        </li>
      </ul>
    </details>
    <div class="actions">
      <Button
        :label="t('runComparison')"
        icon="pi pi-play"
        :disabled="busy || !canRun"
        @click="run"
      />
    </div>
    <p class="help-text">{{ t("comparisonHelp") }}</p>
  </section>
  <template v-if="simulation"
    ><div class="comparison-toolbar">
      <span class="muted"
        >{{ format.date(simulation.executedAt, true) }} · {{ t("version") }}
        {{ simulation.criteriaVersion }}</span
      >
    </div>
    <Message v-if="!simulation.isCurrent" severity="warn">{{
      t("staleComparison")
    }}</Message>
    <section v-if="simulation.exchangeRate" class="exchange-rate-card" aria-live="polite">
      <i class="pi pi-arrow-right-arrow-left" />
      <div>
        <strong>{{ t("exchangeRateApplied") }}</strong>
        <p>
          1 {{ simulation.exchangeRate.sourceCurrency }} =
          {{ simulation.exchangeRate.rate }} {{ simulation.exchangeRate.targetCurrency }}
          · {{ t("saleRate") }}
        </p>
        <small>
          {{ simulation.exchangeRate.source }} ·
          {{ t("publishedOn") }} {{ format.date(simulation.exchangeRate.publishedOn) }} ·
          {{ t("retrievedAt") }} {{ format.date(simulation.exchangeRate.retrievedAt, true) }}
        </small>
      </div>
    </section>
    <div v-if="winner" class="recommendation">
      <span class="recommendation-icon"><i class="pi pi-trophy" /></span>
      <div>
        <span class="eyebrow">{{ t("recommended") }}</span>
        <h3>{{ winner.supplierBusinessName }}</h3>
        <p>
          {{ format.money(winnerEvaluation?.comparisonTotal ?? winner.total, winnerEvaluation?.comparisonCurrency ?? winner.currency) }}
          <template v-if="winnerEvaluation?.conversionApplied">
            ({{ format.money(winnerEvaluation.originalTotal, winnerEvaluation.originalCurrency) }})
          </template>
          · {{ t("score") }}
          {{ format.score(simulation.recommendation.score) }} / 100
        </p>
      </div>
      <Button
        v-if="session.manager"
        :label="t('reviewOrder')"
        icon="pi pi-arrow-right"
        icon-pos="right"
        :disabled="busy || !simulation.isCurrent"
        @click="emit('order')"
      />
    </div>
    <section class="panel table-panel">
      <div class="table-scroll">
        <table class="comparison-table">
          <thead>
            <tr>
              <th>{{ t("supplier") }}</th>
              <th>{{ t("originalTotal") }}</th>
              <th>{{ t("comparisonTotal") }}</th>
              <th>{{ t("status") }}</th>
              <th>{{ t("score") }}</th>
              <th>{{ t("rank") }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="evaluation in simulation.evaluations"
              :key="evaluation.quotationId"
            >
              <td>{{ name(evaluation.quotationId) }}</td>
              <td>{{ format.money(evaluation.originalTotal, evaluation.originalCurrency) }}</td>
              <td>
                <strong>{{ format.money(evaluation.comparisonTotal, evaluation.comparisonCurrency) }}</strong>
                <small v-if="evaluation.conversionApplied" class="conversion-note">{{ t("convertedWithOfficialRate") }}</small>
              </td>
              <td :class="evaluation.isEligible ? 'eligible' : 'invalid'">
                {{ evaluation.isEligible ? t("eligible") : t("excluded") }}
              </td>
              <td>
                <strong class="score">{{
                  format.score(evaluation.totalScore)
                }}</strong>
                / 100
              </td>
              <td>{{ evaluation.rank ?? "—" }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
    <section class="panel">
      <h3>{{ t("details") }}</h3>
      <details
        v-for="evaluation in simulation.evaluations"
        :key="evaluation.quotationId"
        class="evaluation-details"
      >
        <summary>{{ name(evaluation.quotationId) }}</summary>
        <p
          v-for="(reason, index) in evaluation.exclusionReasons"
          :key="'reason' + index"
        >
          {{ friendlyExplanation(reason.explanation) }}
        </p>
        <div
          v-for="result in evaluation.criterionResults"
          :key="result.criterionId"
          class="criterion-result"
        >
          <span>{{ friendlyExplanation(result.explanation) }}</span
          ><strong>{{ format.score(result.weightedContribution) }}</strong>
        </div>
      </details>
    </section></template
  >
  <p v-else class="empty-state">{{ t("emptyComparison") }}</p>
</template>
