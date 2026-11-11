<script setup>
import { useId } from "vue";
import { useI18n } from "vue-i18n";
import Button from "primevue/button";
import InputText from "primevue/inputtext";
import InputNumber from "primevue/inputnumber";
import Select from "primevue/select";
import Checkbox from "primevue/checkbox";
import Field from "../../../shared/presentation/components/form-field.vue";
import { newItem, newRequirement } from "./request-item-defaults.js";
// Shared by regular requests, generated drafts (US16) and recurring schedules (US16).
const items = defineModel({ type: Array, required: true });
const { t } = useI18n(),
  uid = useId();
</script>
<template>
  <section v-for="(entry, index) in items" :key="index" class="panel item-form">
    <div class="section-heading">
      <h2>{{ t("items") }} {{ index + 1 }}</h2>
      <Button
        v-if="items.length > 1"
        :label="t('removeItem')"
        icon="pi pi-trash"
        severity="danger"
        text
        @click="items.splice(index, 1)"
      />
    </div>
    <div class="item-fields">
      <Field :label="t('description')" v-slot="{ id }"
        ><InputText :id="id" v-model="entry.description" required maxlength="250" /></Field
      ><Field :label="t('quantity')" v-slot="{ id }"
        ><InputNumber
          :input-id="id"
          v-model="entry.quantity"
          :min="0.001"
          :max-fraction-digits="3"
          required /></Field
      ><Field :label="t('unit')" v-slot="{ id }"
        ><InputText :id="id" v-model="entry.unitOfMeasure" required maxlength="30"
      /></Field>
    </div>
    <h3>{{ t("requirements") }}</h3>
    <div v-for="(req, ri) in entry.requirements" :key="ri" class="requirement-form">
      <Field :label="t('requirementName')" v-slot="{ id }"
        ><InputText :id="id" v-model="req.name" required maxlength="150" /></Field
      ><Field :label="t('operator')" v-slot="{ id }"
        ><Select
          :input-id="id"
          :aria-label="t('operator')"
          v-model="req.operator"
          :options="
            ['Equals', 'Contains', 'GreaterThanOrEqual', 'LessThanOrEqual'].map(
              (value) => ({ value, label: t('operators.' + value) }),
            )
          "
          option-label="label"
          option-value="value" /></Field
      ><Field :label="t('expectedValue')" v-slot="{ id }"
        ><InputText :id="id" v-model="req.expectedValue" required maxlength="250" /></Field
      ><Field :label="t('unit')" v-slot="{ id }"
        ><InputText :id="id" v-model="req.unitOfMeasure" maxlength="30" /></Field
      ><label class="check-label" :for="`${uid}-mandatory-${index}-${ri}`"
        ><Checkbox
          :input-id="`${uid}-mandatory-${index}-${ri}`"
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
      @click="entry.requirements.push(newRequirement())"
    />
  </section>
  <div>
    <Button
      :label="t('addItem')"
      icon="pi pi-plus"
      outlined
      @click="items.push(newItem())"
    />
  </div>
</template>
