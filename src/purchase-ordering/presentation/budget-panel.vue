<script setup>
import { ref, computed } from "vue";
import { useI18n } from "vue-i18n";
import Button from "primevue/button";
import InputNumber from "primevue/inputnumber";
import Textarea from "primevue/textarea";
import Field from "../../shared/presentation/components/form-field.vue";
import { useWorkspace } from "../../shared/presentation/use-workspace.js";
import { useFormat } from "../../shared/presentation/format.js";
// US20: maximum budget in PEN for one request, versioned and justified.
const props = defineProps({
  request: { type: Object, required: true },
  budget: { type: Object, default: null },
  awarded: Boolean,
  busy: Boolean,
  execute: { type: Function, required: true },
});
const emit = defineEmits(["budget"]);
const { t } = useI18n(),
  format = useFormat(),
  { services, session } = useWorkspace();
const amount = ref(null),
  reason = ref("");
const revisions = computed(() =>
  [...(props.budget?.revisions ?? [])].sort((a, b) => b.version - a.version),
);
// Only purchase managers authorize: identify the role, not the internal id.
const who = (id) =>
  id === session.value.userId
    ? `${t("role.PurchaseManager")} (${t("you")})`
    : t("role.PurchaseManager");
async function save() {
  await props.execute(async () => {
    const updated = await services.value.budgets.authorize(
      props.request,
      props.budget,
      amount.value,
      reason.value,
    );
    amount.value = null;
    reason.value = "";
    emit("budget", updated);
  }, t("budgetSaved"));
}
</script>
<template>
  <section class="panel stack">
    <div class="section-heading">
      <h2>{{ t("budgetTitle") }}</h2>
      <span v-if="budget?.configured" class="muted"
        >{{ t("version") }} {{ budget.version }}</span
      >
    </div>
    <div class="quote-summary">
      <template v-if="budget?.configured"
        ><span>{{ t("budgetLimit") }}</span
        ><strong>{{ format.money(budget.amountPen, "PEN") }}</strong></template
      >
      <span v-else>{{ t("budgetNotConfigured") }}</span>
    </div>
    <form
      v-if="session.manager && request.isActive && !awarded"
      class="stack"
      @submit.prevent="save"
    >
      <div class="form-grid">
        <Field :label="t('budgetAmount')" v-slot="{ id }"
          ><InputNumber
            :input-id="id"
            v-model="amount"
            :min="0.0001"
            :max-fraction-digits="4"
            :disabled="busy"
            required /></Field
        ><Field :label="t('reason')" v-slot="{ id }"
          ><Textarea
            :id="id"
            v-model="reason"
            rows="2"
            maxlength="2000"
            required
            :disabled="busy"
        /></Field>
      </div>
      <div>
        <Button
          type="submit"
          :label="budget?.configured ? t('updateBudget') : t('authorizeBudget')"
          icon="pi pi-wallet"
          :disabled="busy || !amount"
        />
      </div>
      <p class="help-text">{{ t("budgetHelp") }}</p>
    </form>
    <details v-if="revisions.length">
      <summary>{{ t("budgetHistory") }} · {{ revisions.length }}</summary>
      <article v-for="entry in revisions" :key="entry.id" class="history-entry">
        <i class="pi pi-wallet" />
        <div>
          <p>
            <strong>{{ format.money(entry.amountPen, "PEN") }}</strong> ·
            {{ t("version") }} {{ entry.version }}
          </p>
          <p>{{ entry.reason }}</p>
          <small class="muted"
            >{{ format.date(entry.authorizedAt, true) }} ·
            {{ who(entry.authorizedBy) }}</small
          >
        </div>
      </article>
    </details>
  </section>
</template>
