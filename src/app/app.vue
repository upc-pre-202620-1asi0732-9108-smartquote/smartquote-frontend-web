<script setup>
import {
  computed,
  onMounted,
  onUnmounted,
  provide,
  ref,
  shallowRef,
  watch,
} from "vue";
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
const session = shallowRef(null),
  pending = ref(0),
  mobile = ref(false),
  restoring = ref(true);
const services = computed(() =>
  session.value ? createServices(session.value) : null,
);
async function login(email, password) {
  session.value = await auth.login(email, password);
  await router.replace("/requests");
}
function focusMain() {
  document.getElementById("main-content")?.focus();
}
async function disconnect() {
  try {
    await auth.logout();
  } finally {
    clearTimeout(timer);
    mobile.value = false;
    await router.replace("/");
  }
  session.value = null;
}
async function renewSession() {
  try {
    const renewed = await auth.restore();
    if (renewed) session.value = renewed;
    else session.value = null;
  } catch {
    const remaining = session.value?.expiresAt - Date.now() || 0;
    if (remaining > 0)
      timer = setTimeout(renewSession, Math.min(30000, remaining));
  }
}
provide("workspace", { session, services, pending, disconnect });
let timer;
watch(
  session,
  (s) => {
    clearTimeout(timer);
    if (s)
      timer = setTimeout(
        renewSession,
        Math.min(Math.max(0, s.expiresAt - Date.now() - 30000), 2147483647),
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
const removeGuard = router.beforeEach((to) => {
  const allowedRoles = to.meta.roles;
  if (
    allowedRoles &&
    (!session.value || !allowedRoles.some((role) => session.value.hasRole(role)))
  )
    return "/requests";
  return true;
});
onMounted(async () => {
  try {
    session.value = await auth.restore();
  } catch {
    session.value = null;
  } finally {
    restoring.value = false;
  }
});
onUnmounted(() => {
  clearTimeout(timer);
  removeGuard();
});
</script>
<template>
  <main v-if="restoring" class="access-page"><span class="muted">{{ t("restoringSession") }}</span></main>
  <AccessPage v-else-if="!session" :login="login" />
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
          <strong>{{ session.displayName }}</strong
          ><small>{{ t("role." + session.roles[0]) }}</small>
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
