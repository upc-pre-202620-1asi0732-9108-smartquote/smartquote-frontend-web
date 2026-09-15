<script setup>
import Message from "primevue/message";
defineProps({
  error: { type: String, default: "" },
  success: { type: String, default: "" },
});
</script>
<template>
  <Message v-if="error" severity="error" role="alert" class="notice">{{
    error
  }}</Message
  ><Message v-if="success" severity="success" role="status" class="notice">{{
    success
  }}</Message>
</template>
