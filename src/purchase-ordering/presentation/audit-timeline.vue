<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import { useI18n } from "vue-i18n";
import Feedback from "../../shared/presentation/components/feedback-notice.vue";
import {
  useWorkspace,
  useFeedback,
} from "../../shared/presentation/use-workspace.js";
import { useFormat } from "../../shared/presentation/format.js";

const props = defineProps({
  entityType: { type: String, required: true },
  entityId: { type: String, required: true },
});

const { t } = useI18n();
const format = useFormat();
const { services } = useWorkspace();
const { busy, error, execute } = useFeedback();
const events = ref([]);
let controller;

function describe(action) {
  if (action === "Submitted") return t("auditSubmitted");
  if (action === "Issued") return t("auditIssued");
  if (action === "Delivered") return t("auditDelivered");
  if (action.startsWith("StatusChanged:")) {
    const [from, to] = action.slice("StatusChanged:".length).split("->");
    return `${t("auditStatusChanged")}: ${from} → ${to}`;
  }
  return action;
}

async function load() {
  controller?.abort();
  controller = new AbortController();
  await execute(async () => {
    events.value = await services.value.audit.timeline(
      props.entityType,
      props.entityId,
      controller.signal,
    );
  });
}

onMounted(load);
onUnmounted(() => controller?.abort());
</script>

<template>
  <section class="panel stack">
    <h2>{{ t("auditTrail") }}</h2>
    <p class="muted">{{ t("auditTrailHelp") }}</p>
    <Feedback :error="error" />
    <p v-if="!busy && !events.length && !error" class="empty-state">
      {{ t("auditEmpty") }}
    </p>
    <div v-if="events.length" class="table-scroll">
      <table>
        <thead>
          <tr>
            <th>{{ t("date") }}</th>
            <th>{{ t("auditAction") }}</th>
            <th>{{ t("actor") }}</th>
            <th>{{ t("reason") }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="event in events" :key="event.auditEventId">
            <td>{{ format.date(event.occurredAt, true) }}</td>
            <td>{{ describe(event.action) }}</td>
            <td>{{ event.actorName || event.actorId.slice(0, 8) }}</td>
            <td>{{ event.reason || "—" }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
