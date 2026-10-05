<script setup>
import { useI18n } from "vue-i18n";
import { RouterLink } from "vue-router";

const { t, tm, rt } = useI18n();
const email = "supportRouteguard@gmail.com";
const sections = [
  "objective",
  "definitions",
  "accounts",
  "acceptableUse",
  "data",
  "availability",
  "ip",
  "liability",
  "termination",
  "changes",
  "law",
  "contact",
];
const listed = ["definitions", "acceptableUse"];
</script>

<template>
  <article class="panel stack agreement">
    <RouterLink class="text-button" to="/requests">{{ t("agreement.back") }}</RouterLink>
    <p class="eyebrow">SMARTQUOTE</p>
    <h1>{{ t("agreement.title") }}</h1>
    <p class="muted">{{ t("agreement.intro") }}</p>
    <p class="muted">{{ t("agreement.updated") }}</p>
    <section v-for="id in sections" :key="id" class="stack">
      <h2>{{ t(`agreement.sections.${id}.title`) }}</h2>
      <p>{{ t(`agreement.sections.${id}.body`, { email }) }}</p>
      <ul v-if="listed.includes(id)">
        <li v-for="(item, index) in tm(`agreement.sections.${id}.items`)" :key="index">
          {{ rt(item) }}
        </li>
      </ul>
    </section>
  </article>
</template>
