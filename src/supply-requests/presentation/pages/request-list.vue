<script setup>
import { ref, onMounted, onUnmounted, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import Button from "primevue/button";
import InputText from "primevue/inputtext";
import Select from "primevue/select";
import DataTable from "primevue/datatable";
import Column from "primevue/column";
import Paginator from "primevue/paginator";
import Status from "../../../shared/presentation/components/status-chip.vue";
import Feedback from "../../../shared/presentation/components/feedback-notice.vue";
import {
  useWorkspace,
  useFeedback,
} from "../../../shared/presentation/use-workspace.js";
import { useFormat } from "../../../shared/presentation/format.js";
const { t } = useI18n(),
  router = useRouter(),
  format = useFormat();
const { services, session } = useWorkspace(),
  { error, busy, execute } = useFeedback();
const data = ref(null),
  search = ref(""),
  status = ref(""),
  page = ref(1);
let abort;
async function load() {
  if (busy.value) return;
  abort?.abort();
  abort = new AbortController();
  await execute(async () => {
    data.value = await services.value.requests.list(
      status.value,
      page.value,
      abort.signal,
    );
  });
}
watch(status, () => {
  page.value = 1;
  load();
});
onMounted(load);
onUnmounted(() => abort?.abort());
</script>
<template>
  <div class="page-heading">
    <div>
      <p class="eyebrow">SMARTQUOTE</p>
      <h1>{{ t("requests") }}</h1>
      <p class="muted">{{ t("requestSubtitle") }}</p>
    </div>
    <Button
      v-if="session.production"
      :label="t('newRequest')"
      icon="pi pi-plus"
      @click="router.push('/requests/new')"
    />
  </div>
  <Feedback :error="error" />
  <section class="panel">
    <div class="list-toolbar">
      <InputText
        v-model="search"
        :placeholder="t('search')"
        :aria-label="t('search')"
      /><Select
        v-model="status"
        :disabled="busy"
        :options="
          [
            '',
            'Submitted',
            'UnderReview',
            'QuotationCollection',
            'Evaluation',
            'Approved',
            'Ordered',
            'Rejected',
            'Cancelled',
          ].map((value) => ({
            value,
            label: value ? t('statuses.' + value) : t('allStatuses'),
          }))
        "
        option-label="label"
        option-value="value"
        :aria-label="t('status')"
      /><Button
        icon="pi pi-refresh"
        :label="t('refresh')"
        outlined
        :loading="busy"
        @click="load"
      />
    </div>
    <DataTable
      :value="
        (data?.items || []).filter((row) =>
          (row.title + ' ' + row.requestId)
            .toLowerCase()
            .includes(search.toLowerCase()),
        )
      "
      :loading="busy"
      data-key="requestId"
      table-style="min-width:700px"
      ><template #empty
        ><div class="empty-state">{{ t("emptyRequests") }}</div></template
      ><Column :header="t('request')"
        ><template #body="{ data: row }"
          ><button
            class="text-button request-title"
            @click="router.push('/requests/' + row.requestId)"
          >
            {{ row.title }}</button
          ><small class="muted block">{{
            row.requestId.slice(0, 8)
          }}</small></template
        ></Column
      ><Column :header="t('status')"
        ><template #body="{ data: row }"
          ><Status :value="row.status" /></template></Column
      ><Column :header="t('priority')"
        ><template #body="{ data: row }">{{
          t("priorities." + row.priority)
        }}</template></Column
      ><Column :header="t('requiredDate')"
        ><template #body="{ data: row }">{{
          format.date(row.requiredDate)
        }}</template></Column
      ><Column :header="t('open')"
        ><template #body="{ data: row }"
          ><Button
            icon="pi pi-arrow-right"
            text
            :aria-label="t('open') + ' ' + row.title"
            @click="
              router.push('/requests/' + row.requestId)
            " /></template></Column
    ></DataTable>
    <div class="pagination">
      <span class="muted">{{ data?.totalItems || 0 }} {{ t("rows") }}</span
      ><Paginator
        :first="(page - 1) * 12"
        :rows="12"
        :total-records="data?.totalItems || 0"
        @page="
          (event) => {
            if (busy) return;
            page = event.page + 1;
            load();
          }
        "
      />
    </div>
  </section>
</template>
