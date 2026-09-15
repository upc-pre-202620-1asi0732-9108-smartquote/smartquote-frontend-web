<script setup>
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import Button from "primevue/button";
import InputText from "primevue/inputtext";
import Select from "primevue/select";
import Field from "../../shared/presentation/components/form-field.vue";
import Feedback from "../../shared/presentation/components/feedback-notice.vue";
import Terms from "../../shared/presentation/components/terms-dialog.vue";
const props = defineProps({ login: { type: Function, required: true } });
const { t, locale } = useI18n();
const email = ref(""),
  password = ref(""),
  busy = ref(false),
  error = ref("");
async function submit() {
  busy.value = true;
  error.value = "";
  try {
    await props.login(email.value, password.value);
  } catch (e) {
    error.value = t("error." + (e.code || "unexpected"));
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <main class="access-page">
    <section class="access-story">
      <a class="brand" href="#/"
        ><span class="brand-mark" aria-hidden="true"><span class="brand-bars"><i></i><i></i><i></i></span><i class="pi pi-check" /></span
        >SmartQuote</a
      >
      <div>
        <p class="eyebrow">{{ t("poultry") }}</p>
        <h1>{{ t("accessStory") }}</h1>
        <p>{{ t("accessSubtitle") }}</p>
      </div>
      <span class="access-proof"><i class="pi pi-shield" />SmartQuote</span>
    </section>
    <section class="access-form">
      <div class="access-form-inner">
        <Select
          v-model="locale"
          :options="[
            { label: 'English', value: 'en_US' },
            { label: 'Español', value: 'es_419' },
          ]"
          option-label="label"
          option-value="value"
          :aria-label="t('language')"
          class="language-select"
        />
        <h2>{{ t("accessTitle") }}</h2>
        <p class="muted">{{ t("accessIntro") }}</p>
        <Feedback :error="error" />
        <form @submit.prevent="submit" class="stack">
          <Field :label="t('email')" v-slot="{ id }"
            ><InputText :id="id" v-model="email" type="email" autocomplete="username" required :disabled="busy" /></Field
          ><Field :label="t('password')" v-slot="{ id }"
            ><InputText :id="id" v-model="password" type="password" autocomplete="current-password" required :disabled="busy" /></Field
          ><Button
            type="submit"
            :label="t('signIn')"
            icon="pi pi-arrow-right"
            icon-pos="right"
            :loading="busy"
          />
        </form>
        <p class="access-note"><i class="pi pi-lock" />{{ t("loginNote") }}</p>
        <p class="help-text">{{ t("accessHelp") }}</p>
        <Terms />
      </div>
    </section>
  </main>
</template>
