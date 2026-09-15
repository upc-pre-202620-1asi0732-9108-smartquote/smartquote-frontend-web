<script setup>
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import Button from "primevue/button";
import InputText from "primevue/inputtext";
import InputNumber from "primevue/inputnumber";
import Select from "primevue/select";
import Checkbox from "primevue/checkbox";
import Field from "../../../shared/presentation/components/form-field.vue";
import Feedback from "../../../shared/presentation/components/feedback-notice.vue";
import {
  useWorkspace,
  useFeedback,
} from "../../../shared/presentation/use-workspace.js";
const { t } = useI18n(),
  router = useRouter(),
  { session, services } = useWorkspace();
const { busy, error, execute } = useFeedback();
const requirement = () => ({
  name: "",
  operator: "Equals",
  expectedValue: "",
  unitOfMeasure: "",
  isMandatory: true,
});
const item = () => ({
  description: "",
  quantity: 1,
  unitOfMeasure: "",
  requirements: [requirement()],
});
const form = ref({ requiredDate: "", priority: "Normal", items: [item()] });
async function submit() {
  const result = await execute(() =>
    services.value.requests.create(form.value),
  );
  if (result) router.push("/requests/" + result.requestId);
}
</script>
<template>
  <Button
    :label="t('back')"
    icon="pi pi-arrow-left"
    text
    :disabled="busy"
    @click="router.push('/requests')"
  />
  <div class="page-heading">
    <div>
      <h1>{{ t("newRequest") }}</h1>
      <p class="muted">{{ t("requestFormIntro") }}</p>
    </div>
  </div>
  <Feedback :error="error" />
  <p v-if="!session.production" class="empty-state">
    {{ t("productionOnly") }}
  </p>
  <form v-else @submit.prevent="submit" class="stack">
    <fieldset :disabled="busy" class="form-fieldset">
      <div class="panel form-grid">
        <Field :label="t('requiredDate')" v-slot="{ id }"
          ><InputText
            :id="id"
            v-model="form.requiredDate"
            type="date"
            required /></Field
        ><Field :label="t('priority')" v-slot="{ id }"
          ><Select
            :input-id="id"
            :aria-label="t('priority')"
            v-model="form.priority"
            :options="
              ['Normal', 'High', 'Emergency'].map((value) => ({
                value,
                label: t('priorities.' + value),
              }))
            "
            option-label="label"
            option-value="value"
        /></Field>
      </div>
      <section
        v-for="(entry, index) in form.items"
        :key="index"
        class="panel item-form"
      >
        <div class="section-heading">
          <h2>{{ t("items") }} {{ index + 1 }}</h2>
          <Button
            v-if="form.items.length > 1"
            :label="t('removeItem')"
            icon="pi pi-trash"
            severity="danger"
            text
            @click="form.items.splice(index, 1)"
          />
        </div>
        <div class="item-fields">
          <Field :label="t('description')" v-slot="{ id }"
            ><InputText :id="id" v-model="entry.description" required /></Field
          ><Field :label="t('quantity')" v-slot="{ id }"
            ><InputNumber
              :input-id="id"
              v-model="entry.quantity"
              :min="0.001"
              :max-fraction-digits="3"
              required /></Field
          ><Field :label="t('unit')" v-slot="{ id }"
            ><InputText :id="id" v-model="entry.unitOfMeasure" required
          /></Field>
        </div>
        <h3>{{ t("requirements") }}</h3>
        <div
          v-for="(req, ri) in entry.requirements"
          :key="ri"
          class="requirement-form"
        >
          <Field :label="t('requirementName')" v-slot="{ id }"
            ><InputText :id="id" v-model="req.name" required /></Field
          ><Field :label="t('operator')" v-slot="{ id }"
            ><Select
              :input-id="id"
              :aria-label="t('operator')"
              v-model="req.operator"
              :options="
                [
                  'Equals',
                  'Contains',
                  'GreaterThanOrEqual',
                  'LessThanOrEqual',
                ].map((value) => ({ value, label: t('operators.' + value) }))
              "
              option-label="label"
              option-value="value" /></Field
          ><Field :label="t('expectedValue')" v-slot="{ id }"
            ><InputText :id="id" v-model="req.expectedValue" required /></Field
          ><Field :label="t('unit')" v-slot="{ id }"
            ><InputText :id="id" v-model="req.unitOfMeasure" /></Field
          ><label class="check-label" :for="'mandatory-' + index + '-' + ri"
            ><Checkbox
              :input-id="'mandatory-' + index + '-' + ri"
              v-model="req.isMandatory"
              binary
            />{{ t("mandatory") }}</label
          ><Button
            v-if="entry.requirements.length > 1"
            icon="pi pi-times"
            text
            severity="danger"
            :aria-label="t('removeRequirement')"
            @click="entry.requirements.splice(ri, 1)"
          />
        </div>
        <Button
          :label="t('addRequirement')"
          icon="pi pi-plus"
          text
          @click="entry.requirements.push(requirement())"
        />
      </section>
    </fieldset>
    <div class="actions">
      <Button
        :label="t('addItem')"
        icon="pi pi-plus"
        outlined
        :disabled="busy"
        @click="form.items.push(item())"
      /><Button
        type="submit"
        :label="t('submitRequest')"
        icon="pi pi-check"
        :loading="busy"
      />
    </div>
  </form>
</template>
