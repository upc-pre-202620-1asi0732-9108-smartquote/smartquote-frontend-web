<script setup>
import { useId } from "vue";
defineProps({ label: { type: String, required: true } });
const id = useId();
</script>
<template>
  <div class="form-field">
    <label :for="id">{{ label }}</label
    ><slot :id="id" />
  </div>
</template>
