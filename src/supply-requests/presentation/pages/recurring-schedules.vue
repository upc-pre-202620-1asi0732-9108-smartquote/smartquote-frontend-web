<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import Button from "primevue/button";
import InputText from "primevue/inputtext";
import InputNumber from "primevue/inputnumber";
import Select from "primevue/select";
import Field from "../../../shared/presentation/components/form-field.vue";
import Status from "../../../shared/presentation/components/status-chip.vue";
import Feedback from "../../../shared/presentation/components/feedback-notice.vue";
import ItemsEditor from "../components/request-items-editor.vue";
import { isoDate, newItem } from "../components/request-item-defaults.js";
import {
  useWorkspace,
  useFeedback,
} from "../../../shared/presentation/use-workspace.js";
import { useFormat } from "../../../shared/presentation/format.js";
// US16: recurring schedules generate drafts that the specialist reviews before submitting.
const { t } = useI18n(),
  router = useRouter(),
  format = useFormat(),
  { services } = useWorkspace();
const { busy, error, success, execute } = useFeedback();
const schedules = ref([]),
  creating = ref(false);
const todayIso = isoDate(new Date());
const blank = () => ({
  startDate: todayIso,
  intervalDays: 7,
  requiredDateOffsetDays: 2,
  timeZoneId: "America/Lima",
  priority: "Normal",
  items: [newItem()],
});
const form = ref(blank());
const abort = new AbortController();
async function load() {
  schedules.value = await services.value.schedules.list(abort.signal);
}
async function create() {
  const created = await execute(async () => {
    const schedule = await services.value.schedules.create(form.value);
    await load();
    return schedule;
  }, t("scheduleSaved"));
  if (created) {
    creating.value = false;
    form.value = blank();
  }
}
async function pause(schedule) {
  await execute(async () => {
    await services.value.schedules.pause(schedule);
    await load();
  }, t("schedulePaused"));
}
onMounted(() => execute(load));
onUnmounted(() => abort.abort());
</script>
<template>
  <div class="page-heading">
    <div>
      <p class="eyebrow">SMARTQUOTE</p>
      <h1>{{ t("schedulesTitle") }}</h1>
      <p class="muted">{{ t("schedulesSubtitle") }}</p>
    </div>
    <div class="inline-row">
      <Button
        :label="t('refresh')"
        icon="pi pi-refresh"
        outlined
        :loading="busy"
        @click="execute(load)"
      /><Button
        v-if="!creating"
        :label="t('newSchedule')"
        icon="pi pi-plus"
        :disabled="busy"
        @click="creating = true"
      />
    </div>
  </div>
  <Feedback :error="error" :success="success" />
  <form v-if="creating" class="stack" @submit.prevent="create">
    <fieldset :disabled="busy" class="form-fieldset">
      <div class="panel form-grid">
        <Field :label="t('scheduleStart')" v-slot="{ id }"
          ><InputText
            :id="id"
            v-model="form.startDate"
            type="date"
            :min="todayIso"
            required /></Field
        ><Field :label="t('scheduleInterval')" v-slot="{ id }"
          ><InputNumber
            :input-id="id"
            v-model="form.intervalDays"
            :min="1"
            :max="3650"
            :max-fraction-digits="0"
            required /></Field
        ><Field :label="t('scheduleOffset')" v-slot="{ id }"
          ><InputNumber
            :input-id="id"
            v-model="form.requiredDateOffsetDays"
            :min="0"
            :max="3650"
            :max-fraction-digits="0"
            required /></Field
        ><Field :label="t('scheduleTimeZone')" v-slot="{ id }"
          ><InputText :id="id" v-model="form.timeZoneId" required maxlength="64" /></Field
        ><Field :label="t('priority')" v-slot="{ id }"
          ><Select
            :input-id="id"
            :aria-label="t('priority')"
            v-model="form.priority"
            :options="
              ['Normal', 'High', 'Emergency'].map((value) => ({
                value,
                label: t('priorities.' + value),
              }))
            "
            option-label="label"
            option-value="value"
        /></Field>
      </div>
      <p class="help-text">{{ t("scheduleHelp") }}</p>
      <ItemsEditor v-model="form.items" />
    </fieldset>
    <div class="actions">
      <Button
        :label="t('cancel')"
        text
        :disabled="busy"
        @click="creating = false"
      /><Button
        type="submit"
        :label="t('saveSchedule')"
        icon="pi pi-check"
        :loading="busy"
      />
    </div>
  </form>
  <p v-if="!schedules.length && !creating" class="empty-state" role="status">
    {{ busy ? t("loading") : t("emptySchedules") }}
  </p>
  <article v-for="schedule in schedules" :key="schedule.id" class="panel stack">
    <div class="section-heading">
      <div>
        <h2>{{ schedule.title }}</h2>
        <p class="muted">
          {{ t("scheduleEvery", { days: schedule.intervalDays }) }} ·
          {{ t("priorities." + schedule.priority) }} · {{ schedule.timeZoneId }}
        </p>
      </div>
      <div class="inline-row">
        <Status :value="schedule.isActive ? 'Active' : 'Paused'" /><Button
          v-if="schedule.isActive"
          :label="t('pauseSchedule')"
          icon="pi pi-pause"
          severity="secondary"
          outlined
          :disabled="busy"
          @click="pause(schedule)"
        />
      </div>
    </div>
    <dl>
      <dt>{{ t("scheduleStart") }}</dt>
      <dd>{{ format.date(schedule.startDate) }}</dd>
      <dt>{{ t("scheduleOffset") }}</dt>
      <dd>{{ schedule.requiredDateOffsetDays }}</dd>
      <template v-if="schedule.isActive">
        <dt>{{ t("nextOccurrence") }}</dt>
        <dd>{{ format.date(schedule.nextOccurrenceDate) }}</dd>
      </template>
      <template v-else>
        <dt>{{ t("pausedAt") }}</dt>
        <dd>{{ format.date(schedule.pausedAt, true) }}</dd>
      </template>
    </dl>
    <ul>
      <li v-for="(item, index) in schedule.items" :key="index">
        {{ item.description }} · {{ item.quantity }} {{ item.unitOfMeasure }}
      </li>
    </ul>
    <details>
      <summary>{{ t("occurrences") }} · {{ schedule.occurrences.length }}</summary>
      <p v-if="!schedule.occurrences.length" class="muted">
        {{ t("emptyOccurrences") }}
      </p>
      <div v-else class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>{{ t("date") }}</th>
              <th>{{ t("status") }}</th>
              <th>{{ t("request") }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="occurrence in schedule.occurrences" :key="occurrence.id">
              <td>{{ format.date(occurrence.scheduledDate) }}</td>
              <td><Status :value="occurrence.status" /></td>
              <td>
                <button
                  v-if="occurrence.requestId"
                  class="text-button"
                  @click="router.push('/requests/' + occurrence.requestId)"
                >
                  {{ t("reviewDraft") }} {{ occurrence.requestId.slice(0, 8) }}
                </button>
                <span v-else class="muted">{{ t("notAvailable") }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </details>
  </article>
</template>
