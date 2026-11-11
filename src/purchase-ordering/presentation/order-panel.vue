<script setup>
import { ref, computed, watch, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import Button from "primevue/button";
import InputText from "primevue/inputtext";
import Textarea from "primevue/textarea";
import Select from "primevue/select";
import Checkbox from "primevue/checkbox";
import Message from "primevue/message";
import Field from "../../shared/presentation/components/form-field.vue";
import AuditTimeline from "./audit-timeline.vue";
import BudgetPanel from "./budget-panel.vue";
import BudgetCheckNotice from "./budget-check-notice.vue";
import Status from "../../shared/presentation/components/status-chip.vue";
import { useWorkspace } from "../../shared/presentation/use-workspace.js";
import { useFormat } from "../../shared/presentation/format.js";
const props = defineProps({
  request: { type: Object, required: true },
  quotes: { type: Array, required: true },
  simulation: { type: Object, default: null },
  order: { type: Object, default: null },
  award: { type: Object, default: null },
  busy: Boolean,
  execute: { type: Function, required: true },
  refresh: { type: Function, required: true },
});
const emit = defineEmits(["order"]);
const { t } = useI18n(),
  format = useFormat(),
  { services, session } = useWorkspace();
const onTime = ref(null),
  quality = ref(null),
  notes = ref("");
const scoreOptions = [1, 2, 3, 4, 5].map((value) => ({ value, label: String(value) }));

// US21: a distributed award holds one order per supplier.
const orders = computed(() => props.award?.orders ?? (props.order ? [props.order] : []));
const selectedOrderId = ref(null);
const current = computed(
  () =>
    orders.value.find((o) => o.purchaseOrderId === selectedOrderId.value) ??
    orders.value[0] ??
    null,
);

async function markDelivered() {
  await props.execute(async () => {
    const delivered = await services.value.orders.markDelivered(current.value.purchaseOrderId);
    if (orders.value.length === 1) emit("order", delivered);
    await props.refresh();
  }, t("deliveredDone"));
}

async function evaluate() {
  await props.execute(async () => {
    await services.value.orders.evaluateDelivery(current.value.purchaseOrderId, {
      onTimeScore: onTime.value,
      qualityScore: quality.value,
      observations: notes.value,
    });
    onTime.value = null;
    quality.value = null;
    notes.value = "";
    await props.refresh();
  }, t("evaluationSaved"));
}

const chosen = ref(""),
  destination = ref(""),
  conditions = ref(""),
  confirmed = ref(false);
const distributed = computed(() => props.simulation?.distributed === true);
const eligible = computed(
  () =>
    props.simulation?.evaluations
      .filter((e) => e.isEligible)
      .map((e) => ({
        value: e.quotationId,
        label:
          props.quotes.find((q) => q.quotationId === e.quotationId)
            ?.supplierBusinessName || e.quotationId,
      })) ?? [],
);
const quoteId = computed(
  () => chosen.value || props.simulation?.recommendation?.quotationId || "",
);
const quote = computed(() =>
  props.quotes.find((q) => q.quotationId === quoteId.value),
);

// US20: budget of the request and its contrast against the amount to be issued.
const budget = ref(null),
  check = ref(null),
  checkError = ref("");
let checkRequest = 0;
async function loadBudget() {
  try {
    budget.value = await services.value.budgets.get(props.request.requestId);
  } catch {
    budget.value = null;
  }
}
async function loadCheck() {
  const run = props.simulation,
    ticket = ++checkRequest;
  check.value = null;
  checkError.value = "";
  if (orders.value.length || !run?.isCurrent || (!distributed.value && !quoteId.value)) return;
  if (distributed.value && !run.distribution?.canApprove) return;
  try {
    const result = distributed.value
      ? await services.value.budgets.checkAward(run.simulationRunId)
      : await services.value.budgets.check(run.simulationRunId, quoteId.value);
    if (ticket === checkRequest) check.value = result;
  } catch (e) {
    // A missing preserved exchange rate or an outdated decision blocks the approval.
    if (ticket === checkRequest)
      checkError.value = e.detail || t("error." + (e.code || "unexpected"));
  }
}
// A retry with identical content must reuse its key; different content needs a new one.
const idempotencyKey = ref(crypto.randomUUID());
watch(
  [
    quoteId,
    () => props.simulation?.simulationRunId,
    () => props.simulation?.isCurrent,
    () => budget.value?.version,
    () => orders.value.length,
  ],
  loadCheck,
);
watch(
  [destination, conditions, () => props.simulation?.simulationRunId, () => check.value?.budgetVersion],
  () => {
    idempotencyKey.value = crypto.randomUUID();
  },
);
watch(
  [chosen, destination, conditions, () => props.simulation?.simulationRunId],
  () => {
    confirmed.value = false;
  },
);
watch(() => props.request.version, loadBudget);
onMounted(async () => {
  await loadBudget();
  await loadCheck();
});
async function approve() {
  await props.execute(async () => {
    const order = await services.value.orders.approve(
      props.request.requestId,
      props.simulation.simulationRunId,
      quoteId.value,
      conditions.value,
      destination.value,
      check.value,
    );
    emit("order", order);
    confirmed.value = false;
    await props.refresh();
  }, t("saved"));
  // A rejected approval may mean the budget changed: contrast again before retrying.
  if (!orders.value.length) {
    await loadBudget();
    await loadCheck();
  }
}
async function approveAward() {
  await props.execute(async () => {
    await services.value.awards.approve(
      props.request.requestId,
      props.simulation.simulationRunId,
      check.value,
      conditions.value,
      destination.value,
      idempotencyKey.value,
    );
    confirmed.value = false;
    await props.refresh();
  }, t("awardSaved"));
  if (!orders.value.length) {
    await loadBudget();
    await loadCheck();
  }
}
function print() {
  window.print();
}
</script>
<template>
  <p v-if="!session.purchasing" class="empty-state">{{ t("managerOnly") }}</p>
  <template v-else>
    <div class="no-print">
      <BudgetPanel
        :request="request"
        :budget="budget"
        :awarded="orders.length > 0"
        :busy="busy"
        :execute="execute"
        @budget="(value) => (budget = value)"
      />
    </div>
    <template v-if="current"
      ><div class="section-heading no-print">
        <h2>{{ t("purchaseOrder") }}</h2>
        <Button v-if="session.manager" :label="t('print')" icon="pi pi-print" outlined @click="print" />
      </div>
      <section v-if="award && orders.length > 1" class="panel stack no-print">
        <h3>{{ t("distributedAward") }}</h3>
        <p class="muted">
          {{ t("awardSummary", { count: orders.length }) }} · {{ t("totalPen") }}:
          <strong>{{ format.money(award.totalPen, "PEN") }}</strong>
          <template v-if="award.budgetAmountPen != null">
            · {{ t("budgetLimit") }}: {{ format.money(award.budgetAmountPen, "PEN") }} ·
            {{ t("budgetMargin") }}: {{ format.money(award.budgetMarginPen, "PEN") }}
          </template>
        </p>
        <div class="inline-row" role="group" :aria-label="t('purchaseOrder')">
          <Button
            v-for="entry in orders"
            :key="entry.purchaseOrderId"
            :label="`${entry.orderNumber} · ${entry.supplierBusinessName}`"
            :outlined="entry.purchaseOrderId !== current.purchaseOrderId"
            :aria-pressed="entry.purchaseOrderId === current.purchaseOrderId"
            @click="selectedOrderId = entry.purchaseOrderId"
          />
        </div>
      </section>
      <article class="panel order-document">
        <header>
          <div>
            <span class="eyebrow">SMARTQUOTE · {{ t("purchaseOrder") }}</span>
            <h2>{{ current.orderNumber }}</h2>
          </div>
          <Status :value="current.status" />
        </header>
        <div class="form-grid">
          <div>
            <small class="muted">{{ t("supplier") }}</small>
            <h3>{{ current.supplierBusinessName }}</h3>
            <p>{{ t("taxId") }}: {{ current.supplierTaxIdentifier }}</p>
          </div>
          <div>
            <small class="muted">{{ t("deliveryDestination") }}</small>
            <h3>{{ current.deliveryDestination }}</h3>
            <p>{{ current.deliveryConditions }}</p>
            <p>{{ t("deliveryDays") }}: {{ current.deliveryLeadTimeDays }}</p>
          </div>
        </div>
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{{ t("description") }}</th>
                <th>{{ t("quantity") }}</th>
                <th>{{ t("unitPrice") }}</th>
                <th>{{ t("total") }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="line in current.lines" :key="line.lineId">
                <td>{{ line.description }}</td>
                <td>{{ line.quantity }} {{ line.unitOfMeasure }}</td>
                <td>
                  {{ format.money(line.unitPrice, current.currency) }}
                  <small
                    v-if="line.originalCurrency && line.originalCurrency !== current.currency"
                    class="conversion-note"
                    >{{ format.money(line.originalUnitPrice, line.originalCurrency) }}</small
                  >
                </td>
                <td>
                  {{
                    format.money(line.quantity * line.unitPrice, current.currency)
                  }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="order-total">
          {{ t("total")
          }}<strong>{{ format.money(current.total, current.currency) }}</strong>
        </div>
        <p v-if="current.policyEvidence" class="help-text">
          <template v-if="current.policyEvidence.budgetVersion != null">
            {{ t("budgetApplied") }} {{ current.policyEvidence.budgetVersion }}:
            {{ format.money(current.policyEvidence.budgetAmountPen, "PEN") }} ·
            {{ t("totalPen") }}: {{ format.money(current.policyEvidence.totalPen, "PEN") }} ·
            {{ t("budgetMargin") }}: {{ format.money(current.policyEvidence.marginPen, "PEN") }}
          </template>
          <template v-else>{{ t("budgetNotApplied") }}</template>
        </p>
        <footer>
          <span>{{ t("approvedBy") }}: {{ current.approvedBy }}</span
          ><span
            >{{ t("approvedAt") }}:
            {{ format.date(current.approvedAt, true) }}</span
          ><span class="identifier">{{ current.purchaseOrderId }}</span>
        </footer>
      </article>
      <section v-if="current.status === 'Issued'" class="panel stack">
        <h2>{{ t("deliveryTitle") }}</h2>
        <p class="muted">{{ t("deliveryHelp") }}</p>
        <div>
          <Button :label="t('markDelivered')" icon="pi pi-check" :loading="busy" @click="markDelivered" />
        </div>
      </section>
      <form v-else-if="current.status === 'Delivered'" class="panel stack" @submit.prevent="evaluate">
        <h2>{{ t("supplierEvaluation") }}</h2>
        <Field :label="t('onTimeScore')" v-slot="{ id }"
          ><Select :input-id="id" :aria-label="t('onTimeScore')" v-model="onTime" :options="scoreOptions" option-label="label" option-value="value" :disabled="busy"
        /></Field>
        <Field :label="t('qualityScore')" v-slot="{ id }"
          ><Select :input-id="id" :aria-label="t('qualityScore')" v-model="quality" :options="scoreOptions" option-label="label" option-value="value" :disabled="busy"
        /></Field>
        <Field :label="t('evaluationNotes')" v-slot="{ id }"
          ><Textarea :id="id" v-model="notes" rows="3" maxlength="500" :disabled="busy" /></Field>
        <p class="help-text">{{ t("evaluationNotesLimit") }} {{ notes.length }} / 500</p>
        <div>
          <Button type="submit" :label="t('saveEvaluation')" icon="pi pi-star" :loading="busy" />
        </div>
      </form>
      <AuditTimeline
        v-if="session.manager"
        :key="current.purchaseOrderId"
        entity-type="PurchaseOrder"
        :entity-id="current.purchaseOrderId"
      />
    </template>
    <form
      v-else-if="session.manager && simulation?.isCurrent && distributed"
      class="panel stack"
      @submit.prevent="approveAward"
    >
      <h2>{{ t("distributedAward") }}</h2>
      <Message v-if="!simulation.distribution?.canApprove" severity="warn">{{
        t("error.incompleteCoverage")
      }}</Message>
      <template v-else>
        <ul>
          <li
            v-for="allocation in simulation.distribution.allocations"
            :key="allocation.requestedItemId"
          >
            {{ allocation.description }} → <strong>{{ allocation.supplierBusinessName }}</strong>
            · {{ format.money(allocation.amountPen, "PEN") }}
          </li>
        </ul>
        <BudgetCheckNotice :check="check" :error="checkError" />
        <Field :label="t('deliveryDestination')" v-slot="{ id }"
          ><InputText :id="id" v-model="destination" required :disabled="busy" /></Field
        ><Field :label="t('deliveryConditions')" v-slot="{ id }"
          ><Textarea :id="id" v-model="conditions" rows="3" required :disabled="busy" /></Field
        ><label for="approve-award" class="check-label"
          ><Checkbox
            input-id="approve-award"
            v-model="confirmed"
            binary
            :disabled="busy"
          />{{ t("awardCheck") }}</label
        >
        <p class="help-text">{{ t("awardHelp") }}</p>
        <Button
          type="submit"
          :label="t('approveAward')"
          icon="pi pi-check-circle"
          :disabled="busy || !confirmed || !check?.canApprove"
        />
      </template>
    </form>
    <form
      v-else-if="session.manager && simulation?.isCurrent && eligible.length"
      class="panel stack"
      @submit.prevent="approve"
    >
      <h2>{{ t("purchaseOrder") }}</h2>
      <Field :label="t('chooseSupplier')" v-slot="{ id }"
        ><Select
          :input-id="id"
          :aria-label="t('chooseSupplier')"
          :model-value="quoteId"
          @update:model-value="(value) => (chosen = value)"
          :options="eligible"
          option-label="label"
          option-value="value"
          :disabled="busy"
      /></Field>
      <div v-if="quote" class="quote-summary">
        <strong>{{ quote.supplierBusinessName }}</strong
        ><span>{{ format.money(quote.total, quote.currency) }}</span>
      </div>
      <BudgetCheckNotice :check="check" :error="checkError" />
      <Field :label="t('deliveryDestination')" v-slot="{ id }"
        ><InputText
          :id="id"
          v-model="destination"
          required
          :disabled="busy" /></Field
      ><Field :label="t('deliveryConditions')" v-slot="{ id }"
        ><Textarea
          :id="id"
          v-model="conditions"
          rows="3"
          required
          :disabled="busy" /></Field
      ><label for="approve-order" class="check-label"
        ><Checkbox
          input-id="approve-order"
          v-model="confirmed"
          binary
          :disabled="busy"
        />{{ t("approvalCheck") }}</label
      >
      <p class="help-text">{{ t("approvalHelp") }}</p>
      <Button
        type="submit"
        :label="t('approveOrder')"
        icon="pi pi-check-circle"
        :disabled="busy || !confirmed || !quoteId || check?.exceeded || Boolean(checkError)"
      />
    </form>
    <p v-else class="empty-state">{{ t(session.manager ? "orderMissing" : "managerOnly") }}</p>
  </template>
</template>
