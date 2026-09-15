<script setup>
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import Button from "primevue/button";
import Status from "../../../shared/presentation/components/status-chip.vue";
import Feedback from "../../../shared/presentation/components/feedback-notice.vue";
import {
  useWorkspace,
  useFeedback,
} from "../../../shared/presentation/use-workspace.js";
import { useFormat } from "../../../shared/presentation/format.js";
const { t } = useI18n(),
  format = useFormat(),
  router = useRouter(),
  { services } = useWorkspace();
const { busy, error, execute } = useFeedback(),
  items = ref([]);
async function load() {
  items.value = await services.value.requests.notifications();
}
onMounted(() => execute(load));
async function mark(id) {
  await execute(async () => {
    await services.value.requests.readNotification(id);
    await load();
  });
}
</script>
<template>
  <div class="page-heading">
    <h1>{{ t("notifications") }}</h1>
    <Button
      :label="t('refresh')"
      icon="pi pi-refresh"
      outlined
      :loading="busy"
      @click="execute(load)"
    />
  </div>
  <Feedback :error="error" />
  <section class="panel">
    <p v-if="!items.length" class="empty-state">
      {{ t("emptyNotifications") }}
    </p>
    <article
      v-for="note in items"
      :key="note.notificationId"
      class="notification"
    >
      <i class="pi pi-bell" />
      <div>
        <button
          class="text-button"
          @click="router.push('/requests/' + note.purchaseRequestId)"
        >
          {{ t("request") }} {{ note.purchaseRequestId.slice(0, 8) }}
        </button>
        <div>
          <Status :value="note.newStatus" /><small class="muted">{{
            format.date(note.createdAt, true)
          }}</small>
        </div>
      </div>
      <Button
        v-if="!note.readAt"
        :label="t('markRead')"
        text
        :disabled="busy"
        @click="mark(note.notificationId)"
      /><span v-else class="muted">{{ t("read") }}</span>
    </article>
  </section>
</template>
