<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { useI18n } from "vue-i18n";
import Button from "primevue/button";
import Select from "primevue/select";
import Textarea from "primevue/textarea";
import DataTable from "primevue/datatable";
import Column from "primevue/column";
import Message from "primevue/message";
import Field from "../../shared/presentation/components/form-field.vue";
import Status from "../../shared/presentation/components/status-chip.vue";
import Feedback from "../../shared/presentation/components/feedback-notice.vue";
import {
  useWorkspace,
  useFeedback,
} from "../../shared/presentation/use-workspace.js";
import { useFormat } from "../../shared/presentation/format.js";
// US18: the purchase manager enables, suspends or reactivates suppliers for new purchases.
const { t } = useI18n(),
  format = useFormat(),
  { services, session } = useWorkspace();
const { busy, error, success, execute } = useFeedback();
const suppliers = ref([]),
  status = ref(""),
  selected = ref(null),
  action = ref(""),
  reason = ref("");
let abort;
const history = computed(() =>
  [...(selected.value?.history ?? [])].sort((a, b) => b.version - a.version),
);
async function load() {
  abort?.abort();
  abort = new AbortController();
  suppliers.value = await services.value.eligibility.list(status.value, abort.signal);
}
async function open(supplier) {
  await execute(async () => {
    selected.value = await services.value.eligibility.get(supplier.id);
    action.value = selected.value.nextActions[0] ?? "";
    reason.value = "";
  });
}
async function decide() {
  await execute(async () => {
    selected.value = await services.value.eligibility.decide(
      selected.value,
      action.value,
      reason.value,
    );
    action.value = selected.value.nextActions[0] ?? "";
    reason.value = "";
    await load();
  }, t("supplierDecisionSaved"));
}
// Only purchase managers authorize: identify the role, not the internal id.
const who = (id) =>
  id === session.value.userId
    ? `${t("role.PurchaseManager")} (${t("you")})`
    : t("role.PurchaseManager");
watch(status, () => execute(load));
onMounted(() => execute(load));
onUnmounted(() => abort?.abort());
</script>
<template>
  <div class="page-heading">
    <div>
      <p class="eyebrow">SMARTQUOTE</p>
      <h1>{{ t("eligibilityTitle") }}</h1>
      <p class="muted">{{ t("eligibilitySubtitle") }}</p>
    </div>
  </div>
  <Feedback :error="error" :success="success" />
  <section class="panel">
    <div class="list-toolbar">
      <Select
        v-model="status"
        :disabled="busy"
        :options="
          ['', 'Pending', 'Enabled', 'Suspended'].map((value) => ({
            value,
            label: value ? t('statuses.' + value) : t('allStatuses'),
          }))
        "
        option-label="label"
        option-value="value"
        :placeholder="t('allStatuses')"
        :aria-label="t('status')"
      /><Button
        icon="pi pi-refresh"
        :label="t('refresh')"
        outlined
        :loading="busy"
        @click="execute(load)"
      />
    </div>
    <DataTable
      :value="suppliers"
      :loading="busy"
      data-key="id"
      table-style="min-width:600px"
      ><template #empty
        ><div class="empty-state">{{ t("emptySuppliers") }}</div></template
      ><Column :header="t('supplier')"
        ><template #body="{ data: row }"
          ><button class="text-button request-title" @click="open(row)">
            {{ row.businessName }}</button
          ></template
        ></Column
      ><Column :header="t('taxId')"
        ><template #body="{ data: row }">{{ row.taxIdentifier }}</template></Column
      ><Column :header="t('status')"
        ><template #body="{ data: row }"><Status :value="row.status" /></template></Column
      ><Column :header="t('registeredAt')"
        ><template #body="{ data: row }">{{
          format.date(row.createdAt)
        }}</template></Column
      ><Column :header="t('open')"
        ><template #body="{ data: row }"
          ><Button
            icon="pi pi-arrow-right"
            text
            :aria-label="t('open') + ' ' + row.businessName"
            @click="open(row)" /></template></Column
    ></DataTable>
  </section>
  <section v-if="selected" class="panel stack" aria-live="polite">
    <div class="section-heading">
      <div>
        <h2>{{ selected.businessName }}</h2>
        <p class="muted">
          {{ t("taxId") }}: {{ selected.taxIdentifier }} · {{ t("version") }}
          {{ selected.version }}
        </p>
      </div>
      <Status :value="selected.status" />
    </div>
    <Message severity="info">{{ t("eligibilityDisclaimer") }}</Message>
    <form
      v-if="session.manager && selected.nextActions.length"
      class="stack"
      @submit.prevent="decide"
    >
      <h3>{{ t("supplierAction." + action) }}</h3>
      <Field :label="t('reason')" v-slot="{ id }"
        ><Textarea
          :id="id"
          v-model="reason"
          rows="3"
          maxlength="2000"
          required
          :disabled="busy"
      /></Field>
      <p v-if="action === 'suspend'" class="help-text">{{ t("suspendHelp") }}</p>
      <p v-if="action === 'reactivate'" class="help-text">{{ t("reactivateHelp") }}</p>
      <div>
        <Button
          type="submit"
          :label="t('supplierAction.' + action)"
          :icon="action === 'suspend' ? 'pi pi-ban' : 'pi pi-check-circle'"
          :severity="action === 'suspend' ? 'danger' : undefined"
          :disabled="busy"
        />
      </div>
    </form>
    <p v-else-if="!session.manager" class="help-text">{{ t("eligibilityManagerOnly") }}</p>
    <h3>{{ t("decisionHistory") }}</h3>
    <p v-if="!history.length" class="muted">{{ t("emptyDecisions") }}</p>
    <article v-for="entry in history" :key="entry.id" class="history-entry">
      <i class="pi pi-clock" />
      <div>
        <div class="inline-row">
          <Status :value="entry.previousStatus" /><i class="pi pi-arrow-right" /><Status
            :value="entry.newStatus"
          />
        </div>
        <p>{{ entry.reason }}</p>
        <small class="muted"
          >{{ format.date(entry.decidedAt, true) }} · {{ who(entry.decidedBy) }} ·
          {{ t("version") }} {{ entry.version }}</small
        >
      </div>
    </article>
  </section>
</template>
