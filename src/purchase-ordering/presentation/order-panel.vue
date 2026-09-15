<script setup>
import { ref, computed, watch } from "vue";
import { useI18n } from "vue-i18n";
import Button from "primevue/button";
import InputText from "primevue/inputtext";
import Textarea from "primevue/textarea";
import Select from "primevue/select";
import Checkbox from "primevue/checkbox";
import Field from "../../shared/presentation/components/form-field.vue";
import Status from "../../shared/presentation/components/status-chip.vue";
import { useWorkspace } from "../../shared/presentation/use-workspace.js";
import { useFormat } from "../../shared/presentation/format.js";
const props = defineProps({
  request: { type: Object, required: true },
  quotes: { type: Array, required: true },
  simulation: { type: Object, default: null },
  order: { type: Object, default: null },
  busy: Boolean,
  execute: { type: Function, required: true },
  refresh: { type: Function, required: true },
});
const emit = defineEmits(["order"]);
const { t } = useI18n(),
  format = useFormat(),
  { services, session } = useWorkspace();
const chosen = ref(""),
  destination = ref(""),
  conditions = ref(""),
  confirmed = ref(false);
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
watch(
  [chosen, destination, conditions, () => props.simulation?.simulationRunId],
  () => {
    confirmed.value = false;
  },
);
async function approve() {
  await props.execute(async () => {
    const order = await services.value.orders.approve(
      props.request.requestId,
      props.simulation.simulationRunId,
      quoteId.value,
      conditions.value,
      destination.value,
    );
    emit("order", order);
    confirmed.value = false;
  }, t("saved"));
}
async function markOrdered() {
  await props.execute(async () => {
    let current = await services.value.requests.get(props.request.requestId);
    if (current.status === "Evaluation") {
      await services.value.requests.changeStatus(
        current,
        "Approved",
        props.order.orderNumber,
      );
      current = await services.value.requests.get(current.requestId);
    }
    if (current.status === "Approved")
      await services.value.requests.changeStatus(
        current,
        "Ordered",
        props.order.orderNumber,
      );
    await props.refresh();
  }, t("saved"));
}
function print() {
  window.print();
}
</script>
<template>
  <p v-if="!session.manager" class="empty-state">{{ t("managerOnly") }}</p>
  <template v-else-if="order"
    ><div class="section-heading no-print">
      <h2>{{ t("purchaseOrder") }}</h2>
      <Button :label="t('print')" icon="pi pi-print" outlined @click="print" />
    </div>
    <article class="panel order-document">
      <header>
        <div>
          <span class="eyebrow">SMARTQUOTE · {{ t("purchaseOrder") }}</span>
          <h2>{{ order.orderNumber }}</h2>
        </div>
        <Status :value="order.status" />
      </header>
      <div class="form-grid">
        <div>
          <small class="muted">{{ t("supplier") }}</small>
          <h3>{{ order.supplierBusinessName }}</h3>
          <p>{{ t("taxId") }}: {{ order.supplierTaxIdentifier }}</p>
        </div>
        <div>
          <small class="muted">{{ t("deliveryDestination") }}</small>
          <h3>{{ order.deliveryDestination }}</h3>
          <p>{{ order.deliveryConditions }}</p>
          <p>{{ t("deliveryDays") }}: {{ order.deliveryLeadTimeDays }}</p>
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
            <tr v-for="line in order.lines" :key="line.lineId">
              <td>{{ line.description }}</td>
              <td>{{ line.quantity }} {{ line.unitOfMeasure }}</td>
              <td>{{ format.money(line.unitPrice, order.currency) }}</td>
              <td>
                {{
                  format.money(line.quantity * line.unitPrice, order.currency)
                }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="order-total">
        {{ t("total")
        }}<strong>{{ format.money(order.total, order.currency) }}</strong>
      </div>
      <footer>
        <span>{{ t("approvedBy") }}: {{ order.approvedBy }}</span
        ><span
          >{{ t("approvedAt") }}:
          {{ format.date(order.approvedAt, true) }}</span
        ><span class="identifier">{{ order.purchaseOrderId }}</span>
      </footer>
    </article>
    <Button
      v-if="['Evaluation', 'Approved'].includes(request.status)"
      class="no-print"
      :label="t('markOrdered')"
      icon="pi pi-check"
      :disabled="busy"
      @click="markOrdered"
  /></template>
  <form
    v-else-if="simulation?.isCurrent && eligible.length"
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
      :disabled="busy || !confirmed || !quoteId"
    />
  </form>
  <p v-else class="empty-state">{{ t("orderMissing") }}</p>
</template>
