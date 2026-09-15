<script setup>
import { computed, provide, ref, shallowRef, watch, onUnmounted } from "vue";
import { useI18n } from "vue-i18n";
import { RouterLink, RouterView } from "vue-router";
import { usePrimeVue } from "primevue/config";
import Button from "primevue/button";
import Drawer from "primevue/drawer";
import Select from "primevue/select";
import AccessPage from "../identity/presentation/access-page.vue";
import Terms from "../shared/presentation/components/terms-dialog.vue";

import { createServices, createSessionService } from "./composition-root.js";
import { router } from "./router.js";
const { t, locale } = useI18n(),
  primevue = usePrimeVue();
const auth = createSessionService();
const session = shallowRef(auth.restore()),
  pending = ref(0),
  mobile = ref(false);
const services = computed(() =>
  session.value ? createServices(session.value) : null,
);
async function connect(url, token) {
  session.value = await auth.connect(url, token);
}
function focusMain() {
  document.getElementById("main-content")?.focus();
}
function disconnect() {
  auth.disconnect();
  session.value = null;
}
provide("workspace", { session, services, pending, disconnect });
let timer;
watch(
  session,
  (s) => {
    clearTimeout(timer);
    if (s)
      timer = setTimeout(
        disconnect,
        Math.min(Math.max(0, s.expiresAt - Date.now()), 2147483647),
      );
  },
  { immediate: true },
);
watch(
  locale,
  (value) => {
    localStorage.setItem("smartquote.locale", value);
    document.documentElement.lang = value === "es_419" ? "es-419" : "en-US";
    document.title = "SmartQuote | " + t("workspace");
    primevue.config.locale.aria = {
      ...primevue.config.locale.aria,
      close: t("cancel"),
      nextPageLabel: value === "es_419" ? "Página siguiente" : "Next page",
      prevPageLabel: value === "es_419" ? "Página anterior" : "Previous page",
      firstPageLabel: value === "es_419" ? "Primera página" : "First page",
      lastPageLabel: value === "es_419" ? "Última página" : "Last page",
    };
  },
  { immediate: true },
);
const links = computed(() => [
  { to: "/requests", label: t("requests"), icon: "pi pi-inbox" },
  ...(session.value?.production
    ? [
        {
          to: "/requests/new",
          label: t("newRequest"),
          icon: "pi pi-plus-circle",
        },
        { to: "/notifications", label: t("notifications"), icon: "pi pi-bell" },
      ]
    : []),
]);
const removeGuard = router.beforeEach(() => pending.value === 0);
onUnmounted(() => {
  clearTimeout(timer);
  removeGuard();
});
</script>
<template>
  <AccessPage v-if="!session" :connect="connect" />
  <div v-else class="workspace">
    <a href="#main-content" class="skip-link" @click.prevent="focusMain">{{
      t("skipContent")
    }}</a>
    <aside class="sidebar">
      <a href="#/requests" class="brand"
        ><span class="brand-mark"><i class="pi pi-check-circle" /></span
        >SmartQuote</a
      >
      <p class="sidebar-caption">{{ t("workspace") }}</p>
      <nav :aria-label="t('workspace')">
        <RouterLink v-for="link in links" :key="link.to" :to="link.to"
          ><i :class="link.icon" />{{ link.label }}</RouterLink
        >
      </nav>
      <div class="sidebar-profile">
        <span class="avatar">{{
          session.manager ? "PM" : session.production ? "PS" : "PA"
        }}</span>
        <div>
          <strong>{{ t("role." + session.roles[0]) }}</strong
          ><small>{{ session.userId.slice(0, 8) }}</small>
        </div>
      </div>
      <Button
        :label="t('signOut')"
        icon="pi pi-sign-out"
        severity="secondary"
        text
        :disabled="pending > 0"
        @click="disconnect"
      />
    </aside>
    <Drawer v-model:visible="mobile" :header="t('workspace')"
      ><nav class="mobile-nav">
        <RouterLink
          v-for="link in links"
          :key="link.to"
          :to="link.to"
          @click="mobile = false"
          >{{ link.label }}</RouterLink
        ><Button
          :label="t('signOut')"
          :disabled="pending > 0"
          @click="disconnect"
        /></nav
    ></Drawer>
    <div class="workspace-body">
      <header class="topbar">
        <Button
          class="mobile-menu"
          icon="pi pi-bars"
          text
          :aria-label="t('menu')"
          @click="mobile = true"
        /><span class="topbar-title">{{ t("workspace") }}</span
        ><Select
          v-model="locale"
          :options="[
            { label: 'English', value: 'en_US' },
            { label: 'Español', value: 'es_419' },
          ]"
          option-label="label"
          option-value="value"
          :aria-label="t('language')"
        /><span class="connection-dot" aria-hidden="true" />
      </header>
      <main id="main-content" class="workspace-main" tabindex="-1">
        <RouterView v-slot="{ Component, route }"
          ><component :is="Component" :key="route.path" /></RouterView
        ><Terms />
      </main>
    </div>
  </div>
</template>
