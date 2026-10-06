<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import { useI18n } from "vue-i18n";
import Button from "primevue/button";
import Select from "primevue/select";
import DataTable from "primevue/datatable";
import Column from "primevue/column";
import Feedback from "../../shared/presentation/components/feedback-notice.vue";
import {
  useWorkspace,
  useFeedback,
} from "../../shared/presentation/use-workspace.js";
import { useFormat } from "../../shared/presentation/format.js";
import { REGISTRATION_ROLES } from "../domain/registration.entity.js";

const { t } = useI18n();
const format = useFormat();
const { services } = useWorkspace();
const { busy, error, success, execute } = useFeedback();

const requests = ref([]);
const chosenRole = ref({});
const roleOptions = REGISTRATION_ROLES.map((value) => ({
  value,
  label: t("role." + value),
}));
let controller;

async function load() {
  if (busy.value) return;
  controller?.abort();
  controller = new AbortController();
  await execute(async () => {
    requests.value = await services.value.registrations.pending(controller.signal);
    chosenRole.value = Object.fromEntries(
      requests.value.map((item) => [item.userId, item.requestedRole]),
    );
  });
}

async function approve(item) {
  const role = chosenRole.value[item.userId] || item.requestedRole;
  await execute(async () => {
    await services.value.registrations.approve(item.userId, role);
    requests.value = requests.value.filter((row) => row.userId !== item.userId);
  }, t("approvedAccount", { email: item.email }));
}

async function reject(item) {
  if (!window.confirm(t("rejectConfirm", { email: item.email }))) return;
  await execute(async () => {
    await services.value.registrations.reject(item.userId);
    requests.value = requests.value.filter((row) => row.userId !== item.userId);
  }, t("rejectedAccount", { email: item.email }));
}

onMounted(load);
onUnmounted(() => controller?.abort());
</script>

<template>
  <div class="page-heading">
    <div>
      <p class="eyebrow">SMARTQUOTE</p>
      <h1>{{ t("registrationsTitle") }}</h1>
      <p class="muted">{{ t("registrationsSubtitle") }}</p>
    </div>
    <Button
      :label="t('refresh')"
      icon="pi pi-refresh"
      severity="secondary"
      :loading="busy"
      @click="load"
    />
  </div>

  <Feedback :error="error" :success="success" />

  <section class="panel">
    <DataTable
      :value="requests"
      data-key="userId"
      :loading="busy"
      responsive-layout="scroll"
      :empty-message="t('registrationsEmpty')"
    >
      <Column field="displayName" :header="t('displayName')" />
      <Column field="email" :header="t('email')" />
      <Column :header="t('accountRole')">
        <template #body="{ data: item }">
          <Select
            v-model="chosenRole[item.userId]"
            :options="roleOptions"
            option-label="label"
            option-value="value"
            :aria-label="t('accountRole')"
            :disabled="busy"
          />
        </template>
      </Column>
      <Column :header="t('createdAt')">
        <template #body="{ data: item }">{{ format.date(item.createdAt, true) }}</template>
      </Column>
      <Column>
        <template #body="{ data: item }">
          <div class="actions">
            <Button
              :label="t('approveAccount')"
              icon="pi pi-check"
              size="small"
              :disabled="busy"
              @click="approve(item)"
            />
            <Button
              :label="t('rejectAccount')"
              icon="pi pi-times"
              size="small"
              severity="danger"
              text
              :disabled="busy"
              @click="reject(item)"
            />
          </div>
        </template>
      </Column>
    </DataTable>
  </section>
</template>
