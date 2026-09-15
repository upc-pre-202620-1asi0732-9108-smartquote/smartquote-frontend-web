<script setup>
import { ref, computed } from "vue";
import { useI18n } from "vue-i18n";
import Button from "primevue/button";
import InputNumber from "primevue/inputnumber";
import InputText from "primevue/inputtext";
import Message from "primevue/message";
import Field from "../../shared/presentation/components/form-field.vue";
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
  ),
  runId = ref("");
const weighted = computed(() =>
  criteria.value.filter((c) => c.mode === "Weighted"),
);
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
    new Set(verified.value.map((q) => q.currency)).size === 1 &&
    props.scenario &&
    !dirty.value,
);
const winner = computed(() =>
  props.quotes.find(
    (q) => q.quotationId === props.simulation?.recommendation?.quotationId,
  ),
);
async function save() {
  await props.execute(async () => {
    emit(
      "scenario",
      await services.value.evaluations.save(
        props.request.requestId,
        criteria.value,
        props.scenario,
      ),
    );
  }, t("saved"));
}
async function run() {
  await props.execute(async () => {
    await props.acceptRun(
      await services.value.evaluations.simulate(props.scenario.scenarioId),
    );
  });
}
async function restore() {
  await props.execute(async () => {
    await props.acceptRun(
      await services.value.evaluations.simulation(runId.value.trim()),
    );
  });
}
async function copy() {
  await props.execute(
    () => navigator.clipboard.writeText(window.location.href),
    t("copied"),
  );
}
const name = (id) =>
  props.quotes.find((q) => q.quotationId === id)?.supplierBusinessName || id;
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
    <div class="weights-grid">
      <Field
        v-for="criterion in weighted"
        :key="criterion.targetField"
        :label="t('category.' + criterion.category)"
        v-slot="{ id }"
        ><InputNumber
          :input-id="id"
          v-model="criterion.weight"
          suffix=" %"
          :min="0"
          :max="100"
          :max-fraction-digits="2"
          :disabled="busy"
      /></Field>
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
        :label="t('saveCriteria')"
        icon="pi pi-save"
        outlined
        :disabled="
          busy ||
          weightSum !== 100 ||
          !request.acceptsQuotations ||
          (scenario && !dirty)
        "
        @click="save"
      /><Button
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
      ><Button
        :label="t('copyLink')"
        icon="pi pi-link"
        text
        :disabled="busy"
        @click="copy"
      />
    </div>
    <Message v-if="!simulation.isCurrent" severity="warn">{{
      t("staleComparison")
    }}</Message>
    <div v-if="winner" class="recommendation">
      <span class="recommendation-icon"><i class="pi pi-trophy" /></span>
      <div>
        <span class="eyebrow">{{ t("recommended") }}</span>
        <h3>{{ winner.supplierBusinessName }}</h3>
        <p>
          {{ format.money(winner.total, winner.currency) }} · {{ t("score") }}
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
          {{ reason.explanation }}
        </p>
        <div
          v-for="result in evaluation.criterionResults"
          :key="result.criterionId"
          class="criterion-result"
        >
          <span>{{ result.explanation }}</span
          ><strong>{{ format.score(result.weightedContribution) }}</strong>
        </div>
      </details>
    </section></template
  >
  <p v-else class="empty-state">{{ t("emptyComparison") }}</p>
  <details class="restore-comparison">
    <summary>{{ t("restoreSimulation") }}</summary>
    <form class="inline-row" @submit.prevent="restore">
      <InputText
        v-model="runId"
        :aria-label="t('simulationId')"
        :placeholder="t('simulationId')"
        required
        :disabled="busy"
      /><Button type="submit" :label="t('open')" outlined :disabled="busy" />
    </form>
  </details>
</template>
