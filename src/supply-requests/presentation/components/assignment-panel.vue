<script setup>
import { ref, computed, onMounted, watch } from "vue";
import { useI18n } from "vue-i18n";
import Button from "primevue/button";
import Select from "primevue/select";
import Textarea from "primevue/textarea";
import Field from "../../../shared/presentation/components/form-field.vue";
import Feedback from "../../../shared/presentation/components/feedback-notice.vue";
import {
  useWorkspace,
  useFeedback,
} from "../../../shared/presentation/use-workspace.js";
import { useFormat } from "../../../shared/presentation/format.js";
// US22: one responsible analyst per active request, with a justified reassignment history.
const props = defineProps({
  request: { type: Object, required: true },
  busy: Boolean,
  execute: { type: Function, required: true },
  refresh: { type: Function, required: true },
});
const { t } = useI18n(),
  format = useFormat(),
  { services, session } = useWorkspace(),
  // Own loader: the page may still be busy when this panel mounts.
  { error: loadError, execute: loadSafely } = useFeedback();
const analysts = ref([]),
  history = ref([]),
  analystId = ref(null),
  reason = ref("");
const reassigning = computed(() => Boolean(props.request.assignedAnalystId));
const options = computed(() =>
  analysts.value
    .filter((a) => a.userId !== props.request.assignedAnalystId)
    .map((a) => ({ value: a.userId, label: `${a.displayName} · ${a.email}` })),
);
function name(id) {
  if (!id) return t("unassigned");
  if (id === session.value.userId) return t("assignedToYou");
  return (
    analysts.value.find((a) => a.userId === id)?.displayName ??
    `${t("role.PurchaseAnalyst")} (${id.slice(0, 8)})`
  );
}
async function load() {
  const api = services.value.collaboration;
  const [directory, entries] = await Promise.all([
    session.value.manager ? api.analysts() : [],
    api.assignmentHistory(props.request.requestId),
  ]);
  analysts.value = directory;
  history.value = [...entries].sort((a, b) => b.assignedAt.localeCompare(a.assignedAt));
}
async function assign() {
  await props.execute(async () => {
    await services.value.collaboration.assign(props.request, analystId.value, reason.value);
    analystId.value = null;
    reason.value = "";
    await props.refresh();
  }, t("assignmentSaved"));
}
onMounted(() => loadSafely(load));
watch(
  () => props.request.version,
  () => loadSafely(load),
);
</script>
<template>
  <Feedback :error="loadError" />
  <section class="panel stack">
    <h2>{{ t("assignmentTitle") }}</h2>
    <dl>
      <dt>{{ t("responsibleAnalyst") }}</dt>
      <dd>{{ name(request.assignedAnalystId) }}</dd>
    </dl>
    <p v-if="!request.isActive" class="help-text">{{ t("assignmentInactive") }}</p>
    <form
      v-else-if="session.manager"
      class="stack"
      @submit.prevent="assign"
    >
      <Field :label="reassigning ? t('reassignTo') : t('assignTo')" v-slot="{ id }"
        ><Select
          :input-id="id"
          :aria-label="reassigning ? t('reassignTo') : t('assignTo')"
          v-model="analystId"
          :options="options"
          option-label="label"
          option-value="value"
          :placeholder="t('chooseAnalyst')"
          :empty-message="t('noAnalysts')"
          :disabled="busy"
      /></Field>
      <Field v-if="reassigning" :label="t('reason')" v-slot="{ id }"
        ><Textarea
          :id="id"
          v-model="reason"
          rows="2"
          maxlength="2000"
          required
          :disabled="busy"
      /></Field>
      <div>
        <Button
          type="submit"
          :label="reassigning ? t('reassign') : t('assign')"
          icon="pi pi-user-edit"
          :disabled="busy || !analystId"
        />
      </div>
      <p class="help-text">{{ t("assignmentHelp") }}</p>
    </form>
    <details v-if="history.length">
      <summary>{{ t("assignmentHistory") }} · {{ history.length }}</summary>
      <article v-for="entry in history" :key="entry.id" class="history-entry">
        <i class="pi pi-user" />
        <div>
          <p>
            <template v-if="entry.previousAnalystId"
              >{{ name(entry.previousAnalystId) }} <i class="pi pi-arrow-right" />
            </template>
            <strong>{{ name(entry.analystId) }}</strong>
          </p>
          <p v-if="entry.reason">{{ entry.reason }}</p>
          <small class="muted"
            >{{ format.date(entry.assignedAt, true) }} ·
            {{ t("assignedBy") }}
            {{ entry.assignedBy === session.userId ? `${t("role.PurchaseManager")} (${t("you")})` : t("role.PurchaseManager") }}</small
          >
        </div>
      </article>
    </details>
  </section>
</template>
