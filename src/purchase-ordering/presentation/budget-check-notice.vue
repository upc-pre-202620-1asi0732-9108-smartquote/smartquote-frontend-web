<script setup>
import { useI18n } from "vue-i18n";
import Message from "primevue/message";
import { useFormat } from "../../shared/presentation/format.js";
// US20: result of contrasting the amount to be issued with the current budget.
defineProps({
  check: { type: Object, default: null },
  error: { type: String, default: "" },
});
const { t } = useI18n(),
  format = useFormat();
</script>
<template>
  <Message v-if="error" severity="error" role="alert">{{ error }}</Message>
  <template v-else-if="check">
    <Message
      :severity="
        check.exceeded ? 'error' : check.status === 'WithinBudget' ? 'success' : 'info'
      "
      :role="check.exceeded ? 'alert' : 'status'"
    >
      <strong>{{ t("budgetStatus." + check.status) }}</strong>
      · {{ t("totalPen") }}: {{ format.money(check.assessment.totalPen, "PEN") }}
      <template v-if="check.status !== 'NotConfigured'">
        · {{ t("budgetLimit") }}:
        {{ format.money(check.assessment.budgetAmountPen, "PEN") }} ({{ t("version") }}
        {{ check.assessment.budgetVersion }})
        <template v-if="check.exceeded">
          · {{ t("budgetExcess") }}:
          {{ format.money(check.assessment.excessPen, "PEN") }}</template
        >
        <template v-else>
          · {{ t("budgetMargin") }}:
          {{ format.money(check.assessment.marginPen, "PEN") }}</template
        >
      </template>
    </Message>
    <p v-if="check.exchangeRate" class="help-text">
      {{ t("budgetRateNote") }} 1 {{ check.exchangeRate.sourceCurrency }} =
      {{ check.exchangeRate.rate }} {{ check.exchangeRate.targetCurrency }} ·
      {{ check.exchangeRate.source }} ·
      {{ format.date(check.exchangeRate.publishedOn) }}
    </p>
  </template>
</template>
