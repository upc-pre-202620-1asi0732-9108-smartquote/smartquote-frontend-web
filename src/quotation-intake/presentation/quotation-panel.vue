<script setup>
import { ref, computed, nextTick } from "vue";
import { useI18n } from "vue-i18n";
import Button from "primevue/button";
import InputText from "primevue/inputtext";
import Dialog from "primevue/dialog";
import Select from "primevue/select";
import Checkbox from "primevue/checkbox";
import Textarea from "primevue/textarea";
import DataTable from "primevue/datatable";
import ProgressBar from "primevue/progressbar";
import Column from "primevue/column";
import Field from "../../shared/presentation/components/form-field.vue";
import Status from "../../shared/presentation/components/status-chip.vue";
import { useWorkspace } from "../../shared/presentation/use-workspace.js";
import { useFormat } from "../../shared/presentation/format.js";
import { Quotation } from "../domain/quotation.entity.js";
import { DomainError } from "../../shared/domain/domain-error.js";
import Feedback from "../../shared/presentation/components/feedback-notice.vue";
const props = defineProps({
  request: { type: Object, required: true },
  quotes: { type: Array, required: true },
  busy: Boolean,
  execute: { type: Function, required: true },
  refresh: { type: Function, required: true },
  error: { type: String, default: "" },
});
const { t, te } = useI18n(),
  format = useFormat(),
  { services } = useWorkspace();
const uploadVisible = ref(false),
  files = ref([]),
  results = ref([]),
  selectedId = ref(""),
  editField = ref(null),
  specificationLine = ref(null),
  newSpecification = ref({ name: "", value: "", unitOfMeasure: "", sourcePageNumber: 1, sourceTextReference: "", reason: "" }),
  value = ref(""),
  reason = ref(""),
  reviewed = ref(false),
  showAllFields = ref(false),
  mappings = ref({});
const supplier = ref({
  supplierId: "",
  supplierBusinessName: "",
  supplierTaxIdentifier: "",
});
const selected = computed(() =>
  props.quotes.find((q) => q.quotationId === selectedId.value),
);
const reviewFields = computed(() => {
  const fields = selected.value?.fields ?? [];
  return [...fields]
    .filter((field) => showAllFields.value || field.status === "Unresolved" ||
      field.fieldPath.startsWith("supplier.") || field.fieldPath.includes(".specifications[") || field.isRequired)
    .sort((a, b) => Number(b.status === "Unresolved") - Number(a.status === "Unresolved"));
});
function suggestedItem(line) {
  if (line.requestedItemId) return line.requestedItemId;
  if (props.request.items.length === 1) return props.request.items[0].itemId;
  const normalize = (text) => String(text || "").toLocaleLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, " ").trim();
  const description = normalize(line.description);
  const matches = props.request.items.filter((item) => {
    const requested = normalize(item.description);
    return requested && (description.includes(requested) || requested.includes(description));
  });
  return matches.length === 1 ? matches[0].itemId : "";
}
function select(quote) {
  selectedId.value = quote.quotationId;
  reviewed.value = false;
  showAllFields.value = false;
  mappings.value = Object.fromEntries(
    quote.lines.map((l) => [l.lineId, suggestedItem(l)]),
  );
}
function openSpecification(line) {
  const item = props.request.items.find((entry) => entry.itemId === mappings.value[line.lineId]);
  const missing = item?.requirements.find((requirement) =>
    !line.specifications.some((specification) =>
      specification.name.toLocaleLowerCase() === requirement.name.toLocaleLowerCase()));
  newSpecification.value = {
    name: missing?.name || "", value: "", unitOfMeasure: missing?.unitOfMeasure || "",
    sourcePageNumber: 1, sourceTextReference: "", reason: "",
  };
  specificationLine.value = line;
}
function label(path) {
  const specification = /^lines\[(\d+)\]\.specifications\[(\d+)\]\.value$/.exec(path);
  if (specification)
    return `${t('technicalValue')}: ${selected.value?.lines[Number(specification[1])]?.specifications?.[Number(specification[2])]?.name || path}`;
  const tail = path.replace(/^lines\[\d+\]\./, "");
  const key =
    tail === "unitOfMeasure"
      ? "unit"
      : tail === "deliveryLeadTimeDays"
        ? "deliveryDays"
        : tail === "supplier.businessName"
          ? "supplierName"
          : tail === "supplier.taxIdentifier"
            ? "taxId"
            : tail.includes(".specifications[")
              ? "technicalValue"
          : tail;
  return te(key) ? t(key) : path;
}
async function upload() {
  await props.execute(async () => {
    if (files.value.length < 1 || files.value.length > 20)
      throw new DomainError("pdfCount");
    const pending = [...files.value];
    results.value = pending.map((file, index) => ({ index, name: file.name, stage: "waiting" }));
    let cursor = 0;
    async function worker() {
      while (cursor < pending.length) {
        const index = cursor++;
        const file = pending[index];
        try {
          results.value[index].stage = "uploading";
          const metadata = pending.length === 1 ? supplier.value :
            { supplierId: "", supplierBusinessName: "", supplierTaxIdentifier: "" };
          const quote = await services.value.quotations.upload(props.request.requestId, metadata, file);
          results.value[index].stage = "processing";
          if (quote.status === "Uploaded" || quote.status === "Rejected")
            await services.value.quotations.process(quote.quotationId);
          results.value[index].stage = "done";
        } catch (e) {
          results.value[index].stage = "error";
          results.value[index].error = e.message || t("error.unexpected");
        }
        await nextTick();
      }
    }
    await Promise.all(Array.from({ length: Math.min(2, pending.length) }, worker));
    files.value = pending.filter((_, index) => results.value[index].stage === "error");
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
async function addSpecification() {
  await props.execute(async () => {
    await services.value.quotations.addSpecification(selected.value, specificationLine.value.lineId, newSpecification.value);
    specificationLine.value = null;
    newSpecification.value = { name: "", value: "", unitOfMeasure: "", sourcePageNumber: 1, sourceTextReference: "", reason: "" };
    reviewed.value = false;
    await props.refresh();
  }, t("saved"));
}
async function confirm() {
  await props.execute(async () => {
    await services.value.quotations.confirm(selected.value, mappings.value);
    await props.refresh();
    const updated = await services.value.quotations.list(props.request.requestId);
    if (props.request.status === "QuotationCollection" && updated.filter((quote) => quote.verified).length >= 2) {
      const current = await services.value.requests.get(props.request.requestId);
      if (current.status === "QuotationCollection")
        await services.value.requests.changeStatus(current, "Evaluation", "Dos o más cotizaciones verificadas están listas para comparar.");
      await props.refresh();
    }
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
          ><strong>{{ q.supplierBusinessName || t('supplierPending') }}</strong
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
              v-if="['Uploaded', 'Rejected'].includes(q.status) ||
                (q.status === 'Processing' && Date.now() - new Date(q.updatedAt).getTime() > 120000)"
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
        <h2>{{ selected.supplierBusinessName || t('supplierPending') }}</h2>
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
    <div class="section-heading">
      <h3>{{ t('reviewExceptions') }}</h3>
      <Button :label="showAllFields ? t('showPriorityFields') : t('showAllFields')" text @click="showAllFields = !showAllFields" />
    </div>
    <div class="extracted-grid">
      <article
        v-for="field in reviewFields"
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
          :label="field.fieldPath.startsWith('supplier.') ? t('confirmSupplierField') : t('correct')"
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
          {{ line.unitOfMeasure }}
          <small v-if="mappings[line.lineId] && !line.requestedItemId" class="muted"> · {{ t('suggestedMapping') }}</small></span
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
        <Button
          v-if="selected.status === 'RequiresVerification'"
          :label="t('addMissingSpecification')"
          icon="pi pi-plus"
          text
          size="small"
          :disabled="busy"
          @click="openSpecification(line)"
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
      <Feedback :error="error" />
      <details v-if="files.length === 1">
        <summary>{{ t('optionalSupplierData') }}</summary>
      <div class="form-grid">
        <Field :label="t('supplierId')" v-slot="{ id }"
          ><InputText
            :id="id"
            v-model="supplier.supplierId"
            maxlength="100"
            :disabled="busy" /></Field
        ><Field :label="t('taxId')" v-slot="{ id }"
          ><InputText
            :id="id"
            v-model="supplier.supplierTaxIdentifier"
            maxlength="20"
            :disabled="busy"
        /></Field>
      </div>
      <Field :label="t('supplierName')" v-slot="{ id }"
        ><InputText
          :id="id"
          v-model="supplier.supplierBusinessName"
          maxlength="200"
          :disabled="busy" /></Field>
      </details>
      <Field :label="t('selectPdfs')" v-slot="{ id }"
        ><input
          :id="id"
          type="file"
          accept="application/pdf,.pdf"
          multiple
          :disabled="busy"
          @change="files = Array.from($event.target.files || [])"
      /></Field>
      <p class="help-text">{{ t("pdfHelp") }}</p>
      <p v-if="results.length" role="status">{{ results.filter((result) => result.stage === 'done').length }} / {{ results.length }} {{ t('processedFiles') }}</p>
      <ul>
        <li v-for="result in results" :key="result.index">
          {{ result.name }} · {{ result.error || t('uploadStage.' + result.stage) }}
          <ProgressBar
            v-if="['uploading', 'processing'].includes(result.stage)"
            mode="indeterminate"
            :show-value="false"
            style="height: 0.4rem; margin-top: 0.4rem"
          />
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
      <Feedback :error="error" />
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
  <Dialog
    :visible="!!specificationLine"
    modal
    :header="t('addMissingSpecification')"
    :style="{ width: '36rem' }"
    @update:visible="(visible) => { if (!visible) specificationLine = null; }"
  >
    <form class="stack" @submit.prevent="addSpecification">
      <Feedback :error="error" />
      <p class="help-text">{{ t('missingSpecificationHelp') }}</p>
      <Field :label="t('requirementName')" v-slot="{ id }"><InputText :id="id" v-model="newSpecification.name" required :disabled="busy" /></Field>
      <div class="form-grid">
        <Field :label="t('value')" v-slot="{ id }"><InputText :id="id" v-model="newSpecification.value" required :disabled="busy" /></Field>
        <Field :label="t('unit')" v-slot="{ id }"><InputText :id="id" v-model="newSpecification.unitOfMeasure" :disabled="busy" /></Field>
      </div>
      <Field :label="t('page')" v-slot="{ id }"><input :id="id" v-model.number="newSpecification.sourcePageNumber" type="number" min="1" required :disabled="busy" /></Field>
      <Field :label="t('evidence')" v-slot="{ id }"><Textarea :id="id" v-model="newSpecification.sourceTextReference" rows="2" required :disabled="busy" /></Field>
      <Field :label="t('reason')" v-slot="{ id }"><Textarea :id="id" v-model="newSpecification.reason" rows="2" required :disabled="busy" /></Field>
      <Button type="submit" :label="t('save')" :loading="busy" />
    </form>
  </Dialog>
</template>
