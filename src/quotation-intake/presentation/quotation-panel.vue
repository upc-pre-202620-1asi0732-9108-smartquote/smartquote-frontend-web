<script setup>
import { ref, computed } from "vue";
import { useI18n } from "vue-i18n";
import Button from "primevue/button";
import InputText from "primevue/inputtext";
import Dialog from "primevue/dialog";
import Select from "primevue/select";
import Checkbox from "primevue/checkbox";
import Textarea from "primevue/textarea";
import DataTable from "primevue/datatable";
import Column from "primevue/column";
import Field from "../../shared/presentation/components/form-field.vue";
import Status from "../../shared/presentation/components/status-chip.vue";
import { useWorkspace } from "../../shared/presentation/use-workspace.js";
import { useFormat } from "../../shared/presentation/format.js";
import { Quotation } from "../domain/quotation.entity.js";
import { DomainError } from "../../shared/domain/domain-error.js";
const props = defineProps({
  request: { type: Object, required: true },
  quotes: { type: Array, required: true },
  busy: Boolean,
  execute: { type: Function, required: true },
  refresh: { type: Function, required: true },
});
const { t, te } = useI18n(),
  format = useFormat(),
  { services } = useWorkspace();
const uploadVisible = ref(false),
  files = ref([]),
  results = ref([]),
  selectedId = ref(""),
  editField = ref(null),
  value = ref(""),
  reason = ref(""),
  reviewed = ref(false),
  mappings = ref({});
const supplier = ref({
  supplierId: "",
  supplierBusinessName: "",
  supplierTaxIdentifier: "",
});
const selected = computed(() =>
  props.quotes.find((q) => q.quotationId === selectedId.value),
);
function select(quote) {
  selectedId.value = quote.quotationId;
  reviewed.value = false;
  mappings.value = Object.fromEntries(
    quote.lines.map((l) => [l.lineId, l.requestedItemId || ""]),
  );
}
function label(path) {
  const tail = path.replace(/^lines\[\d+\]\./, "");
  const key =
    tail === "unitOfMeasure"
      ? "unit"
      : tail === "deliveryLeadTimeDays"
        ? "deliveryDays"
        : tail === "supplier.businessName"
          ? "supplierName"
          : tail;
  return te(key) ? t(key) : path;
}
async function upload() {
  await props.execute(async () => {
    if (files.value.length < 1 || files.value.length > 20)
      throw new DomainError("pdfCount");
    results.value = [];
    for (const file of files.value) {
      try {
        await services.value.quotations.upload(
          props.request.requestId,
          supplier.value,
          file,
        );
        results.value.push({ name: file.name, ok: true });
      } catch (e) {
        results.value.push({
          name: file.name,
          ok: false,
          error: t("error." + (e.code || "unexpected")),
        });
      }
    }
    files.value = files.value.filter((file) =>
      results.value.some((r) => r.name === file.name && !r.ok),
    );
    await props.refresh();
  });
}
async function process(quote) {
  await props.execute(async () => {
    await services.value.quotations.process(quote.quotationId);
    await props.refresh();
    const updated = props.quotes.find(
      (q) => q.quotationId === quote.quotationId,
    );
    if (updated) select(updated);
  }, t("saved"));
}
async function correct() {
  await props.execute(async () => {
    await services.value.quotations.correct(
      selected.value,
      editField.value.fieldId,
      value.value,
      reason.value,
    );
    editField.value = null;
    reviewed.value = false;
    await props.refresh();
  }, t("saved"));
}
async function confirm() {
  await props.execute(async () => {
    await services.value.quotations.confirm(selected.value, mappings.value);
    await props.refresh();
    reviewed.value = false;
  }, t("verified"));
}
</script>
<template>
  <div class="section-heading">
    <div>
      <h2>{{ t("quotations") }}</h2>
      <p class="muted">{{ t("reviewHelp") }}</p>
    </div>
    <Button
      :label="t('uploadQuotes')"
      icon="pi pi-upload"
      :disabled="busy || !request.acceptsQuotations"
      @click="uploadVisible = true"
    />
  </div>
  <p v-if="!request.acceptsQuotations" class="help-text">
    {{ t("uploadStateHelp") }}
  </p>
  <section class="panel table-panel">
    <DataTable
      :value="quotes"
      data-key="quotationId"
      table-style="min-width:650px"
      ><template #empty
        ><p class="empty-state">{{ t("emptyQuotes") }}</p></template
      ><Column :header="t('supplier')"
        ><template #body="{ data: q }"
          ><strong>{{ q.supplierBusinessName }}</strong
          ><small class="muted block">{{ q.fileName }}</small></template
        ></Column
      ><Column :header="t('status')"
        ><template #body="{ data: q }"
          ><Status :value="q.status" /></template></Column
      ><Column :header="t('total')"
        ><template #body="{ data: q }">{{
          format.money(q.total, q.currency || "PEN")
        }}</template></Column
      ><Column :header="t('review')"
        ><template #body="{ data: q }"
          ><div class="inline-row">
            <Button
              v-if="q.status === 'Uploaded'"
              :label="t('process')"
              size="small"
              :disabled="busy"
              @click="process(q)"
            /><Button
              :label="t('review')"
              text
              :disabled="busy"
              @click="select(q)"
            /></div></template></Column
    ></DataTable>
  </section>
  <section v-if="selected" class="panel quote-review">
    <div class="section-heading">
      <div>
        <h2>{{ selected.supplierBusinessName }}</h2>
        <Status :value="selected.status" />
      </div>
      <Button
        icon="pi pi-times"
        text
        :aria-label="t('cancel')"
        :disabled="busy"
        @click="selectedId = ''"
      />
    </div>
    <p v-if="selected.rejectionReason" role="alert">
      {{ selected.rejectionReason }}
    </p>
    <div class="quote-summary">
      <div>
        <span>{{ t("currency") }}</span
        ><strong>{{ selected.currency || "—" }}</strong>
      </div>
      <div>
        <span>{{ t("deliveryDays") }}</span
        ><strong>{{ selected.deliveryLeadTimeDays ?? "—" }}</strong>
      </div>
      <div>
        <span>{{ t("total") }}</span
        ><strong>{{
          format.money(selected.total, selected.currency || "PEN")
        }}</strong>
      </div>
    </div>
    <div class="extracted-grid">
      <article
        v-for="field in selected.fields"
        :key="field.fieldId"
        class="field-card"
      >
        <div class="section-heading">
          <strong>{{ label(field.fieldPath) }}</strong
          ><Status :value="field.status" />
        </div>
        <p class="field-value">{{ field.currentValue ?? "—" }}</p>
        <details>
          <summary>
            {{ t("evidence") }} · {{ t("page") }} {{ field.sourcePageNumber }} ·
            {{ format.score(field.confidence) }}%
          </summary>
          <blockquote>
            {{ field.sourceTextReference || t("noEvidence") }}
          </blockquote>
          <small
            >{{ t("originalValue") }}: {{ field.originalValue ?? "—" }}</small
          >
          <p v-for="(correction, index) in field.corrections" :key="index">
            {{ correction.previousValue }} → {{ correction.correctedValue }} ·
            {{ correction.reason }}
          </p>
        </details>
        <Button
          v-if="
            Quotation.editable(field.fieldPath) &&
            selected.status === 'RequiresVerification'
          "
          :label="t('correct')"
          icon="pi pi-pencil"
          text
          :disabled="busy"
          @click="
            editField = field;
            value = field.currentValue || '';
            reason = '';
          "
        /><small
          v-else-if="!Quotation.editable(field.fieldPath)"
          class="muted"
          >{{ t("readOnlyField") }}</small
        >
      </article>
    </div>
    <template v-if="selected.lines.length"
      ><h3>{{ t("mapping") }}</h3>
      <div
        v-for="line in selected.lines"
        :key="line.lineId"
        class="line-mapping"
      >
        <span
          >{{ line.description }} · {{ line.quantity }}
          {{ line.unitOfMeasure }}</span
        ><Select
          v-model="mappings[line.lineId]"
          :options="
            request.items.map((item) => ({
              value: item.itemId,
              label: item.description,
            }))
          "
          option-label="label"
          option-value="value"
          :placeholder="t('selectItem')"
          :aria-label="t('selectItem') + ' ' + line.description"
          :disabled="busy || selected.status !== 'RequiresVerification'"
        />
      </div>
      <template v-if="selected.status === 'RequiresVerification'"
        ><label for="review-fields" class="check-label"
          ><Checkbox
            input-id="review-fields"
            v-model="reviewed"
            binary
            :disabled="busy"
          />{{ t("confirmReview") }}</label
        ><Button
          :label="t('verify')"
          icon="pi pi-check"
          :disabled="busy || !reviewed"
          @click="confirm" /></template
    ></template>
  </section>
  <Dialog
    v-model:visible="uploadVisible"
    modal
    :header="t('uploadQuotes')"
    :style="{ width: '40rem' }"
    ><form class="stack" @submit.prevent="upload">
      <div class="form-grid">
        <Field :label="t('supplierId')" v-slot="{ id }"
          ><InputText
            :id="id"
            v-model="supplier.supplierId"
            maxlength="100"
            required
            :disabled="busy" /></Field
        ><Field :label="t('taxId')" v-slot="{ id }"
          ><InputText
            :id="id"
            v-model="supplier.supplierTaxIdentifier"
            maxlength="20"
            required
            :disabled="busy"
        /></Field>
      </div>
      <Field :label="t('supplierName')" v-slot="{ id }"
        ><InputText
          :id="id"
          v-model="supplier.supplierBusinessName"
          maxlength="200"
          required
          :disabled="busy" /></Field
      ><Field :label="t('selectPdfs')" v-slot="{ id }"
        ><input
          :id="id"
          type="file"
          accept="application/pdf,.pdf"
          multiple
          :disabled="busy"
          @change="files = Array.from($event.target.files || [])"
      /></Field>
      <p class="help-text">{{ t("pdfHelp") }}</p>
      <ul>
        <li v-for="result in results" :key="result.name">
          {{ result.name }} · {{ result.ok ? t("success") : result.error }}
        </li>
      </ul>
      <Button type="submit" :label="t('upload')" :loading="busy" /></form
  ></Dialog>
  <Dialog
    :visible="!!editField"
    modal
    :header="t('correct')"
    :style="{ width: '32rem' }"
    @update:visible="
      (visible) => {
        if (!visible) editField = null;
      }
    "
    ><form class="stack" @submit.prevent="correct">
      <Field :label="t('value')" v-slot="{ id }"
        ><InputText :id="id" v-model="value" required :disabled="busy" /></Field
      ><Field :label="t('reason')" v-slot="{ id }"
        ><Textarea
          :id="id"
          v-model="reason"
          rows="3"
          required
          :disabled="busy" /></Field
      ><Button type="submit" :label="t('save')" :loading="busy" /></form
  ></Dialog>
</template>
