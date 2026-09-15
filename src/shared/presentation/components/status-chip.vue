<script setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import Tag from "primevue/tag";
const props = defineProps({ value: { type: String, default: "" } });
const { t, te } = useI18n();
const severity = computed(() =>
  ["Rejected", "Cancelled"].includes(props.value)
    ? "danger"
    : ["Approved", "Ordered", "Verified", "Issued"].includes(props.value)
      ? "success"
      : ["RequiresVerification", "Evaluation", "UnderReview"].includes(
            props.value,
          )
        ? "warn"
        : "secondary",
);
</script>
<template>
  <Tag
    :value="te('statuses.' + value) ? t('statuses.' + value) : value"
    :severity="severity"
    rounded
  />
</template>
