<script setup>
import { ref, onMounted, onUnmounted, watch } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import Button from "primevue/button";
import Checkbox from "primevue/checkbox";
import Tag from "primevue/tag";
import Feedback from "../../shared/presentation/components/feedback-notice.vue";
import {
  useWorkspace,
  useFeedback,
} from "../../shared/presentation/use-workspace.js";
import { useFormat } from "../../shared/presentation/format.js";
// US17: preventive alerts for quotations close to expiry. Reading never extends validity.
const { t } = useI18n(),
  format = useFormat(),
  router = useRouter(),
  { services } = useWorkspace();
const { busy, error, execute } = useFeedback(),
  alerts = ref([]),
  unreadOnly = ref(false);
let abort;
async function load() {
  abort?.abort();
  abort = new AbortController();
  alerts.value = await services.value.quotations.expiryAlerts(
    unreadOnly.value,
    abort.signal,
  );
}
async function mark(alert) {
  await execute(async () => {
    await services.value.quotations.readExpiryAlert(alert.id);
    await load();
  });
}
const open = (alert) =>
  router.push({ path: "/requests/" + alert.requestId, query: { tab: "quotes" } });
watch(unreadOnly, () => execute(load));
onMounted(() => execute(load));
onUnmounted(() => abort?.abort());
</script>
<template>
  <div class="page-heading">
    <div>
      <h1>{{ t("expiryAlerts") }}</h1>
      <p class="muted">{{ t("expiryAlertsIntro") }}</p>
    </div>
    <div class="inline-row">
      <label class="check-label" for="unread-alerts"
        ><Checkbox
          input-id="unread-alerts"
          v-model="unreadOnly"
          binary
          :disabled="busy"
        />{{ t("unreadOnly") }}</label
      ><Button
        :label="t('refresh')"
        icon="pi pi-refresh"
        outlined
        :loading="busy"
        @click="execute(load)"
      />
    </div>
  </div>
  <Feedback :error="error" />
  <section class="panel">
    <p v-if="!alerts.length" class="empty-state" role="status">
      {{ busy ? t("loading") : t("emptyExpiryAlerts") }}
    </p>
    <article v-for="alert in alerts" :key="alert.id" class="notification">
      <i class="pi pi-clock" />
      <div>
        <button class="text-button" @click="open(alert)">
          {{ alert.supplierName }} · {{ t("request") }} {{ alert.requestId.slice(0, 8) }}
        </button>
        <p>
          {{ t("validUntil") }}: <strong>{{ format.date(alert.validUntil) }}</strong>
          <Tag
            v-if="alert.expired"
            :value="t('commercial.Expired')"
            severity="danger"
            rounded
          /><Tag
            v-else
            :value="t('expiresInDays', { days: alert.daysLeft })"
            severity="warn"
            rounded
          />
        </p>
        <small class="muted"
          >{{ t("quotation") }} {{ alert.quotationId.slice(0, 8) }} ·
          {{ t("alertLeadDays", { days: alert.leadDays }) }} ·
          {{ format.date(alert.createdAt, true) }}</small
        >
      </div>
      <Button
        v-if="!alert.readAt"
        :label="t('markRead')"
        text
        :disabled="busy"
        @click="mark(alert)"
      /><span v-else class="muted">{{ t("read") }}</span>
    </article>
  </section>
</template>
