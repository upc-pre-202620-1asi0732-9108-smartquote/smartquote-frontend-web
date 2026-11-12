<script setup>
import { ref, onMounted, onUnmounted, watch } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import Button from "primevue/button";
import Select from "primevue/select";
import Status from "../../../shared/presentation/components/status-chip.vue";
import Feedback from "../../../shared/presentation/components/feedback-notice.vue";
import {
  useWorkspace,
  useFeedback,
} from "../../../shared/presentation/use-workspace.js";
import { useFormat } from "../../../shared/presentation/format.js";
// US15: the specialist's inbox of clarifications; answers are given in the request context.
const { t } = useI18n(),
  format = useFormat(),
  router = useRouter(),
  { services } = useWorkspace();
const { busy, error, execute } = useFeedback(),
  items = ref([]),
  status = ref("Pending");
let abort;
async function load() {
  abort?.abort();
  abort = new AbortController();
  items.value = await services.value.collaboration.inbox(status.value, abort.signal);
}
async function mark(entry) {
  await execute(async () => {
    await services.value.collaboration.markRead(entry.id);
    await load();
  });
}
const open = (entry) =>
  router.push({ path: "/requests/" + entry.requestId, query: { tab: "clarifications" } });
watch(status, () => execute(load));
onMounted(() => execute(load));
onUnmounted(() => abort?.abort());
</script>
<template>
  <div class="page-heading">
    <div>
      <h1>{{ t("clarificationInbox") }}</h1>
      <p class="muted">{{ t("clarificationInboxIntro") }}</p>
    </div>
    <div class="inline-row">
      <Select
        v-model="status"
        :disabled="busy"
        :options="
          ['Pending', 'Answered', 'RevisionApplied', ''].map((value) => ({
            value,
            label: value ? t('statuses.' + value) : t('allStatuses'),
          }))
        "
        option-label="label"
        option-value="value"
        :placeholder="t('allStatuses')"
        :aria-label="t('status')"
      /><Button
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
    <p v-if="!items.length" class="empty-state" role="status">
      {{ busy ? t("loading") : t("emptyClarifications") }}
    </p>
    <article v-for="entry in items" :key="entry.id" class="notification">
      <i class="pi pi-comments" />
      <div>
        <button class="text-button" @click="open(entry)">
          {{ t("request") }} {{ entry.requestId.slice(0, 8) }}
        </button>
        <p>{{ entry.question }}</p>
        <div>
          <Status :value="entry.status" /><small class="muted">{{
            format.date(entry.createdAt, true)
          }}</small>
        </div>
      </div>
      <div class="inline-row">
        <Button
          v-if="entry.pending && !entry.noticeReadAt"
          :label="t('markRead')"
          text
          :disabled="busy"
          @click="mark(entry)"
        /><span v-else-if="entry.noticeReadAt" class="muted">{{ t("read") }}</span
        ><Button
          :label="entry.pending ? t('respond') : t('open')"
          icon="pi pi-arrow-right"
          icon-pos="right"
          outlined
          :disabled="busy"
          @click="open(entry)"
        />
      </div>
    </article>
  </section>
</template>
