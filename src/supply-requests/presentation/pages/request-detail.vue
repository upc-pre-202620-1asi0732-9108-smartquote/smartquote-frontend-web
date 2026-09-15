<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import Button from "primevue/button";
import Select from "primevue/select";
import Textarea from "primevue/textarea";
import Dialog from "primevue/dialog";
import Tabs from "primevue/tabs";
import TabList from "primevue/tablist";
import Tab from "primevue/tab";
import TabPanels from "primevue/tabpanels";
import TabPanel from "primevue/tabpanel";
import Field from "../../../shared/presentation/components/form-field.vue";
import Status from "../../../shared/presentation/components/status-chip.vue";
import Feedback from "../../../shared/presentation/components/feedback-notice.vue";
import {
  useWorkspace,
  useFeedback,
} from "../../../shared/presentation/use-workspace.js";
import { useFormat } from "../../../shared/presentation/format.js";
import { optional } from "../../../shared/application/optional.js";
import QuotationPanel from "../../../quotation-intake/presentation/quotation-panel.vue";
import ComparisonPanel from "../../../evaluation-simulation/presentation/comparison-panel.vue";
import OrderPanel from "../../../purchase-ordering/presentation/order-panel.vue";
const { t } = useI18n(),
  format = useFormat(),
  route = useRoute(),
  router = useRouter();
const { services, session } = useWorkspace(),
  { busy, error, success, execute } = useFeedback();
const id = route.params.id,
  request = ref(null),
  history = ref([]),
  quotes = ref([]),
  scenario = ref(null),
  simulation = ref(null),
  order = ref(null);
const tab = ref("request"),
  dialog = ref(false),
  nextStatus = ref(""),
  reason = ref("");
const runKey =
  "smartquote.run:" +
  session.value.baseUrl +
  ":" +
  session.value.userId +
  ":" +
  id;
const abort = new AbortController();
async function refresh() {
  const api = services.value;
  const [r, h, q, s] = await Promise.all([
    api.requests.get(id, abort.signal),
    api.requests.history(id, abort.signal),
    session.value.purchasing ? api.quotations.list(id, abort.signal) : [],
    session.value.purchasing
      ? optional(api.evaluations.current(id, abort.signal))
      : null,
  ]);
  request.value = r;
  history.value = h.entries;
  quotes.value = q;
  scenario.value = s;
  const runId =
    new URLSearchParams(window.location.hash.split("?")[1] || "").get(
      "simulation",
    ) || localStorage.getItem(runKey);
  if (runId && session.value.purchasing) {
    simulation.value = await optional(
      api.evaluations.currentSimulation(id, runId, abort.signal),
    );
    order.value = session.value.manager
      ? await optional(api.orders.findBySimulation(runId))
      : null;
  }
}
async function acceptRun(run) {
  simulation.value = await services.value.evaluations.currentSimulation(
    id,
    run.simulationRunId,
  );
  localStorage.setItem(runKey, run.simulationRunId);
  const url = new URL(window.location.href);
  url.hash = "/requests/" + id + "?simulation=" + run.simulationRunId;
  window.history.replaceState(window.history.state, "", url);
  order.value = session.value.manager
    ? await optional(
        services.value.orders.findBySimulation(run.simulationRunId),
      )
    : null;
}
async function updateStatus() {
  await execute(async () => {
    await services.value.requests.changeStatus(
      request.value,
      nextStatus.value,
      reason.value,
    );
    dialog.value = false;
    reason.value = "";
    await refresh();
  }, t("saved"));
}
async function attach(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  await execute(async () => {
    await services.value.requests.attach(request.value, file);
    await refresh();
  }, t("saved"));
  event.target.value = "";
}
onMounted(() => execute(refresh));
onUnmounted(() => abort.abort());
</script>
<template>
  <Button
    :label="t('back')"
    icon="pi pi-arrow-left"
    text
    :disabled="busy"
    @click="router.push('/requests')"
  /><Feedback :error="error" :success="success" />
  <p v-if="!request" class="empty-state" role="status">
    {{ busy ? t("loading") : t("emptyRequests") }}
  </p>
  <template v-else
    ><div class="page-heading">
      <div>
        <p class="eyebrow">{{ t("request") }} · {{ id.slice(0, 8) }}</p>
        <h1>{{ request.title }}</h1>
        <div class="inline-row">
          <Status :value="request.status" /><span class="muted"
            >{{ t("version") }} {{ request.version }} ·
            {{ format.date(request.createdAt) }}</span
          >
        </div>
      </div>
      <div class="inline-row">
        <Button
          :label="t('refresh')"
          icon="pi pi-refresh"
          outlined
          :loading="busy"
          @click="execute(refresh)"
        /><Button
          v-if="session.purchasing && request.nextStatuses.length"
          :label="t('changeStatus')"
          :disabled="busy"
          @click="
            nextStatus = request.nextStatuses[0];
            dialog = true;
          "
        />
      </div>
    </div>
    <ol class="workflow" :aria-label="t('status')">
      <li
        v-for="(step, index) in [
          'Submitted',
          'UnderReview',
          'QuotationCollection',
          'Evaluation',
          'Approved',
          'Ordered',
        ]"
        :key="step"
        :class="{ active: request.status === step }"
        :aria-current="request.status === step ? 'step' : undefined"
      >
        <span>{{ index + 1 }}</span
        >{{ t("statuses." + step) }}
      </li>
    </ol>
    <Tabs v-model:value="tab"
      ><TabList
        ><Tab value="request">{{ t("request") }}</Tab
        ><Tab v-if="session.purchasing" value="quotes"
          >{{ t("quotations") }} ({{ quotes.length }})</Tab
        ><Tab v-if="session.purchasing" value="comparison">{{
          t("comparison")
        }}</Tab
        ><Tab v-if="session.manager" value="order">{{ t("purchaseOrder") }}</Tab
        ><Tab value="history">{{ t("history") }}</Tab></TabList
      ><TabPanels>
        <TabPanel value="request"
          ><div class="detail-grid">
            <section class="panel">
              <h2>{{ t("items") }}</h2>
              <article
                v-for="item in request.items"
                :key="item.itemId"
                class="request-item"
              >
                <div class="section-heading">
                  <h3>{{ item.description }}</h3>
                  <strong>{{ item.quantity }} {{ item.unitOfMeasure }}</strong>
                </div>
                <ul class="requirements">
                  <li v-for="req in item.requirements" :key="req.requirementId">
                    <i class="pi pi-check-circle" />
                    <div>
                      <strong>{{ req.name }}</strong
                      ><span
                        >{{ t("operators." + req.operator) }}
                        {{ req.expectedValue }} {{ req.unitOfMeasure }}</span
                      >
                    </div>
                    <small v-if="req.isMandatory">{{ t("mandatory") }}</small>
                  </li>
                </ul>
              </article>
            </section>
            <aside class="stack">
              <section class="panel">
                <dl>
                  <dt>{{ t("priority") }}</dt>
                  <dd>{{ t("priorities." + request.priority) }}</dd>
                  <dt>{{ t("requiredDate") }}</dt>
                  <dd>{{ format.date(request.requiredDate) }}</dd>
                  <dt>{{ t("requester") }}</dt>
                  <dd class="identifier">{{ request.requesterId }}</dd>
                  <dt>{{ t("updatedAt") }}</dt>
                  <dd>{{ format.date(request.updatedAt, true) }}</dd>
                </dl>
              </section>
              <section class="panel">
                <h2>{{ t("attachments") }}</h2>
                <p class="help-text">{{ t("attachmentHelp") }}</p>
                <p v-if="!request.attachments.length" class="muted">
                  {{ t("emptyAttachments") }}
                </p>
                <ul>
                  <li
                    v-for="file in request.attachments"
                    :key="file.attachmentId"
                  >
                    {{ file.fileName }}
                  </li>
                </ul>
                <Field
                  v-if="session.production"
                  :label="t('attach')"
                  v-slot="{ id: inputId }"
                  ><input
                    :id="inputId"
                    type="file"
                    :disabled="busy"
                    @change="attach"
                /></Field>
              </section>
            </aside></div
        ></TabPanel>
        <TabPanel v-if="session.purchasing" value="quotes"
          ><QuotationPanel
            :request="request"
            :quotes="quotes"
            :busy="busy"
            :execute="execute"
            :refresh="refresh"
        /></TabPanel>
        <TabPanel v-if="session.purchasing" value="comparison"
          ><ComparisonPanel
            :key="scenario?.scenarioId || request.version"
            :request="request"
            :quotes="quotes"
            :scenario="scenario"
            :simulation="simulation"
            :busy="busy"
            :execute="execute"
            :accept-run="acceptRun"
            @scenario="
              (value) => {
                scenario = value;
                if (simulation) simulation.isCurrent = false;
              }
            "
            @order="tab = 'order'"
        /></TabPanel>
        <TabPanel v-if="session.manager" value="order"
          ><OrderPanel
            :request="request"
            :quotes="quotes"
            :simulation="simulation"
            :order="order"
            :busy="busy"
            :execute="execute"
            :refresh="refresh"
            @order="(value) => (order = value)"
        /></TabPanel>
        <TabPanel value="history"
          ><section class="panel">
            <h2>{{ t("history") }}</h2>
            <p v-if="!history.length" class="empty-state">
              {{ t("historyEmpty") }}
            </p>
            <article
              v-for="(entry, index) in history"
              :key="index"
              class="history-entry"
            >
              <i class="pi pi-clock" />
              <div>
                <div class="inline-row">
                  <Status v-if="entry.fromStatus" :value="entry.fromStatus" /><i
                    class="pi pi-arrow-right"
                  /><Status :value="entry.toStatus" />
                </div>
                <p>{{ entry.reason }}</p>
                <small class="muted"
                  >{{ format.date(entry.changedAt, true) }} ·
                  {{ entry.changedBy }}</small
                >
              </div>
            </article>
          </section></TabPanel
        >
      </TabPanels></Tabs
    >
    <Dialog
      v-model:visible="dialog"
      modal
      :header="t('changeStatus')"
      :style="{ width: '32rem' }"
      ><form @submit.prevent="updateStatus" class="stack">
        <Field :label="t('nextStatus')" v-slot="{ id: inputId }"
          ><Select
            :input-id="inputId"
            :aria-label="t('nextStatus')"
            v-model="nextStatus"
            :options="
              request.nextStatuses.map((value) => ({
                value,
                label: t('statuses.' + value),
              }))
            "
            option-label="label"
            option-value="value"
            :disabled="busy" /></Field
        ><Field :label="t('reason')" v-slot="{ id: inputId }"
          ><Textarea
            :id="inputId"
            v-model="reason"
            rows="3"
            required
            :disabled="busy" /></Field
        ><Button
          type="submit"
          :label="t('save')"
          :loading="busy"
        /></form></Dialog
  ></template>
</template>
