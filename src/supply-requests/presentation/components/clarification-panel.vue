<script setup>
import { ref, computed, onMounted, watch } from "vue";
import { useI18n } from "vue-i18n";
import Button from "primevue/button";
import InputText from "primevue/inputtext";
import Select from "primevue/select";
import Textarea from "primevue/textarea";
import Checkbox from "primevue/checkbox";
import Message from "primevue/message";
import Field from "../../../shared/presentation/components/form-field.vue";
import Status from "../../../shared/presentation/components/status-chip.vue";
import Feedback from "../../../shared/presentation/components/feedback-notice.vue";
import {
  useWorkspace,
  useFeedback,
} from "../../../shared/presentation/use-workspace.js";
import { useFormat } from "../../../shared/presentation/format.js";
// US15: technical clarifications between purchasing and the requesting specialist.
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
const items = ref([]),
  revisions = ref([]);
const question = ref({ itemId: null, requirementId: null, question: "" });
const answers = ref({}),
  revising = ref(null),
  revision = ref(null),
  revisionReason = ref("");
const analyst = computed(() => session.value.hasRole("PurchaseAnalyst"));
const itemOptions = computed(() =>
  props.request.items.map((item) => ({ value: item.itemId, label: item.description })),
);
const requirementOptions = computed(
  () =>
    props.request.items
      .find((item) => item.itemId === question.value.itemId)
      ?.requirements.map((r) => ({ value: r.requirementId, label: r.name })) ?? [],
);
function origin(entry) {
  const item = props.request.items.find((i) => i.itemId === entry.itemId);
  const requirement = item?.requirements.find(
    (r) => r.requirementId === entry.requirementId,
  );
  return { item, requirement };
}
const describe = (r) =>
  `${r.name}: ${t("operators." + r.operator)} ${r.expectedValue} ${r.unitOfMeasure ?? ""}`.trim();
const who = (id, role) =>
  id === session.value.userId ? `${t("role." + role)} (${t("you")})` : t("role." + role);
async function load() {
  const api = services.value.collaboration,
    id = props.request.requestId;
  const [list, history] = await Promise.all([api.clarifications(id), api.revisions(id)]);
  items.value = list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  revisions.value = [...history].sort((a, b) => b.changedAt.localeCompare(a.changedAt));
}
async function ask() {
  await props.execute(async () => {
    await services.value.collaboration.ask(props.request, question.value);
    question.value = { itemId: null, requirementId: null, question: "" };
    await props.refresh();
    await load();
  }, t("clarificationSent"));
}
async function respond(entry) {
  await props.execute(async () => {
    await services.value.collaboration.respond(entry, answers.value[entry.id] ?? "");
    delete answers.value[entry.id];
    await load();
  }, t("clarificationAnswered"));
}
function startRevision(entry) {
  const { requirement } = origin(entry);
  revising.value = entry.id;
  revisionReason.value = "";
  revision.value = {
    name: requirement.name,
    operator: requirement.operator,
    expectedValue: requirement.expectedValue,
    unitOfMeasure: requirement.unitOfMeasure ?? "",
    isMandatory: requirement.isMandatory,
  };
}
async function revise(entry) {
  await props.execute(async () => {
    await services.value.collaboration.revise(
      entry,
      props.request,
      revision.value,
      revisionReason.value,
    );
    revising.value = null;
    await props.refresh();
    await load();
  }, t("requirementRevised"));
}
onMounted(() => loadSafely(load));
watch(
  () => props.request.version,
  () => loadSafely(load),
);
</script>
<template>
  <Feedback :error="loadError" />
  <div class="section-heading">
    <div>
      <h2>{{ t("clarifications") }}</h2>
      <p class="muted">{{ t("clarificationsIntro") }}</p>
    </div>
    <span class="muted"
      >{{ t("technicalRevision") }} {{ request.technicalRevision ?? 0 }}</span
    >
  </div>
  <form
    v-if="analyst && request.isActive"
    class="panel stack"
    @submit.prevent="ask"
  >
    <h3>{{ t("askClarification") }}</h3>
    <div class="form-grid">
      <Field :label="t('clarificationItem')" v-slot="{ id }"
        ><Select
          :input-id="id"
          :aria-label="t('clarificationItem')"
          v-model="question.itemId"
          :options="itemOptions"
          option-label="label"
          option-value="value"
          :disabled="busy"
          @update:model-value="question.requirementId = null" /></Field
      ><Field :label="t('clarificationRequirement')" v-slot="{ id }"
        ><Select
          :input-id="id"
          :aria-label="t('clarificationRequirement')"
          v-model="question.requirementId"
          :options="requirementOptions"
          option-label="label"
          option-value="value"
          :disabled="busy || !question.itemId"
      /></Field>
    </div>
    <Field :label="t('clarificationQuestion')" v-slot="{ id }"
      ><Textarea
        :id="id"
        v-model="question.question"
        rows="3"
        maxlength="4000"
        required
        :disabled="busy"
    /></Field>
    <p class="help-text">{{ t("clarificationRecipientHelp") }}</p>
    <div>
      <Button
        type="submit"
        :label="t('sendClarification')"
        icon="pi pi-send"
        :disabled="busy || !question.itemId || !question.requirementId"
      />
    </div>
  </form>
  <p v-if="!items.length" class="empty-state">{{ t("emptyClarifications") }}</p>
  <article v-for="entry in items" :key="entry.id" class="panel stack">
    <div class="section-heading">
      <div>
        <h3>{{ origin(entry).item?.description ?? entry.itemId.slice(0, 8) }}</h3>
        <p v-if="origin(entry).requirement" class="muted">
          {{ describe(origin(entry).requirement) }}
        </p>
      </div>
      <Status :value="entry.status" />
    </div>
    <p>
      <strong>{{ t("clarificationQuestion") }}:</strong> {{ entry.question }}
    </p>
    <small class="muted"
      >{{ who(entry.authorId, "PurchaseAnalyst") }} · {{ format.date(entry.createdAt, true) }} ·
      {{ t("technicalRevision") }} {{ entry.sourceTechnicalRevision }}</small
    >
    <template v-if="entry.answer">
      <p>
        <strong>{{ t("clarificationAnswer") }}:</strong> {{ entry.answer }}
      </p>
      <small class="muted"
        >{{ who(entry.answeredBy, "ProductionSpecialist") }} · {{ format.date(entry.answeredAt, true) }}</small
      >
    </template>
    <form
      v-else-if="entry.canBeAnsweredBy(session.userId) && request.isActive"
      class="stack"
      @submit.prevent="respond(entry)"
    >
      <Field :label="t('clarificationAnswer')" v-slot="{ id }"
        ><Textarea
          :id="id"
          v-model="answers[entry.id]"
          rows="3"
          maxlength="4000"
          required
          :disabled="busy"
      /></Field>
      <div>
        <Button type="submit" :label="t('respond')" icon="pi pi-reply" :disabled="busy" />
      </div>
    </form>
    <p v-else class="help-text">{{ t("clarificationPending") }}</p>
    <template v-if="entry.answered && entry.specialistId === session.userId">
      <Message
        v-if="!entry.canBeRevisedBy(session.userId, request)"
        severity="warn"
        >{{ t("clarificationOutdated") }}</Message
      >
      <div v-else-if="revising !== entry.id">
        <Button
          :label="t('reviseRequirement')"
          icon="pi pi-pencil"
          outlined
          :disabled="busy || !origin(entry).requirement"
          @click="startRevision(entry)"
        />
      </div>
      <form v-else class="stack" @submit.prevent="revise(entry)">
        <h4>{{ t("reviseRequirement") }}</h4>
        <div class="requirement-form">
          <Field :label="t('requirementName')" v-slot="{ id }"
            ><InputText :id="id" v-model="revision.name" required maxlength="150" /></Field
          ><Field :label="t('operator')" v-slot="{ id }"
            ><Select
              :input-id="id"
              :aria-label="t('operator')"
              v-model="revision.operator"
              :options="
                ['Equals', 'Contains', 'GreaterThanOrEqual', 'LessThanOrEqual'].map(
                  (value) => ({ value, label: t('operators.' + value) }),
                )
              "
              option-label="label"
              option-value="value" /></Field
          ><Field :label="t('expectedValue')" v-slot="{ id }"
            ><InputText
              :id="id"
              v-model="revision.expectedValue"
              required
              maxlength="250" /></Field
          ><Field :label="t('unit')" v-slot="{ id }"
            ><InputText :id="id" v-model="revision.unitOfMeasure" maxlength="30" /></Field
          ><label class="check-label" :for="'revision-mandatory-' + entry.id"
            ><Checkbox
              :input-id="'revision-mandatory-' + entry.id"
              v-model="revision.isMandatory"
              binary
            />{{ t("mandatory") }}</label
          >
        </div>
        <Field :label="t('reason')" v-slot="{ id }"
          ><Textarea
            :id="id"
            v-model="revisionReason"
            rows="2"
            maxlength="2000"
            required
            :disabled="busy"
        /></Field>
        <p class="help-text">{{ t("revisionHelp") }}</p>
        <div class="inline-row">
          <Button
            type="submit"
            :label="t('confirmRevision')"
            icon="pi pi-check"
            :disabled="busy"
          /><Button
            :label="t('cancel')"
            text
            :disabled="busy"
            @click="revising = null"
          />
        </div>
      </form>
    </template>
  </article>
  <section v-if="revisions.length" class="panel stack">
    <h3>{{ t("requirementRevisions") }}</h3>
    <Message v-if="session.purchasing" severity="info">{{
      t("revisionNeedsEvaluation")
    }}</Message>
    <article v-for="entry in revisions" :key="entry.id" class="history-entry">
      <i class="pi pi-history" />
      <div>
        <p>
          <span class="muted">{{ describe(entry.previous) }}</span>
          <i class="pi pi-arrow-right" />
          <strong>{{ describe(entry.current) }}</strong>
        </p>
        <p>{{ entry.reason }}</p>
        <small class="muted"
          >{{ t("technicalRevision") }} {{ entry.technicalRevision }} ·
          {{ format.date(entry.changedAt, true) }} · {{ who(entry.changedBy, "ProductionSpecialist") }}</small
        >
      </div>
    </article>
  </section>
</template>
