<script setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import Button from "primevue/button";
import Message from "primevue/message";
import { useWorkspace } from "../../shared/presentation/use-workspace.js";
import { useFormat } from "../../shared/presentation/format.js";
// US21: one eligible supplier per complete item; quantities are never split.
const props = defineProps({
  request: { type: Object, required: true },
  quotes: { type: Array, required: true },
  simulation: { type: Object, required: true },
  busy: Boolean,
});
const emit = defineEmits(["order"]);
const { t } = useI18n(),
  format = useFormat(),
  { session } = useWorkspace();
const distribution = computed(() => props.simulation.distribution);
const itemName = (id) =>
  props.request.items.find((item) => item.itemId === id)?.description ?? id.slice(0, 8);
const quote = (id) => props.quotes.find((q) => q.quotationId === id);
const supplierName = (id) => quote(id)?.supplierBusinessName ?? id.slice(0, 8);
const excluded = computed(() =>
  props.request.items
    .map((item) => ({
      item,
      candidates: distribution.value.candidates.filter(
        (c) => c.itemId === item.itemId && !c.isEligible,
      ),
    }))
    .filter((group) => group.candidates.length),
);
</script>
<template>
  <Message v-if="!distribution.canApprove" severity="warn" role="alert">
    {{ t("distributionIncomplete") }}
    <template v-if="distribution.uncoveredItemIds.length">
      {{ t("uncoveredItems") }}:
      {{ distribution.uncoveredItemIds.map(itemName).join(", ") }}.
    </template>
  </Message>
  <div v-else class="recommendation">
    <span class="recommendation-icon"><i class="pi pi-sitemap" /></span>
    <div>
      <span class="eyebrow">{{ t("distributedCombination") }}</span>
      <h3>{{ format.money(distribution.totalPen, "PEN") }}</h3>
      <p>
        {{ t("distributionSuppliers", {
          count: new Set(distribution.allocations.map((a) => a.supplierAccountId)).size,
        }) }}
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
            <th>{{ t("items") }}</th>
            <th>{{ t("supplier") }}</th>
            <th>{{ t("quotation") }}</th>
            <th>{{ t("quantity") }}</th>
            <th>{{ t("originalTotal") }}</th>
            <th>{{ t("totalPen") }}</th>
            <th>{{ t("score") }}</th>
            <th>{{ t("deliveryDays") }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="allocation in distribution.allocations" :key="allocation.requestedItemId">
            <td>{{ allocation.description || itemName(allocation.requestedItemId) }}</td>
            <td>
              <strong>{{ allocation.supplierBusinessName }}</strong
              ><small class="muted block">{{ allocation.supplierTaxIdentifier }}</small>
            </td>
            <td>
              {{ quote(allocation.quotationId)?.fileName ?? allocation.quotationId.slice(0, 8) }}
            </td>
            <td>{{ allocation.quantity }} {{ allocation.unitOfMeasure }}</td>
            <td>{{ format.money(allocation.originalTotal, allocation.originalCurrency) }}</td>
            <td>
              <strong>{{ format.money(allocation.amountPen, "PEN") }}</strong>
            </td>
            <td>
              <strong class="score">{{ format.score(allocation.score) }}</strong> / 100
            </td>
            <td>{{ allocation.deliveryLeadTimeDays }}</td>
          </tr>
          <tr v-for="id in distribution.uncoveredItemIds" :key="'uncovered-' + id">
            <td>{{ itemName(id) }}</td>
            <td colspan="7" class="invalid">{{ t("noEligibleOffer") }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="order-total">
      {{ t("totalPen") }}<strong>{{ format.money(distribution.totalPen, "PEN") }}</strong>
    </div>
  </section>
  <section v-if="excluded.length" class="panel">
    <h3>{{ t("excludedOffers") }}</h3>
    <details v-for="group in excluded" :key="group.item.itemId" class="evaluation-details">
      <summary>{{ group.item.description }} · {{ group.candidates.length }}</summary>
      <div
        v-for="candidate in group.candidates"
        :key="candidate.quotationId + (candidate.lineId ?? '')"
        class="criterion-result"
      >
        <span
          ><strong>{{ supplierName(candidate.quotationId) }}</strong
          >: {{ candidate.exclusions.join(" ") || t("excluded") }}</span
        >
      </div>
    </details>
  </section>
</template>
