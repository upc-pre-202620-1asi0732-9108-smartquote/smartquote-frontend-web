<script setup>
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import Button from "primevue/button";
import InputText from "primevue/inputtext";
import Textarea from "primevue/textarea";
import Select from "primevue/select";
import Field from "../../shared/presentation/components/form-field.vue";
import Feedback from "../../shared/presentation/components/feedback-notice.vue";
import Terms from "../../shared/presentation/components/terms-dialog.vue";
const props = defineProps({ connect: { type: Function, required: true } });
const { t, locale } = useI18n();
const baseUrl = ref(
  localStorage.getItem("smartquote.api") ||
    import.meta.env.VITE_API_BASE_URL ||
    "http://localhost:8080",
);
const token = ref(""),
  busy = ref(false),
  error = ref("");
async function submit() {
  busy.value = true;
  error.value = "";
  try {
    await props.connect(baseUrl.value, token.value);
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
        ><span class="brand-mark"><i class="pi pi-check-circle" /></span
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
          <Field :label="t('backendUrl')" v-slot="{ id }"
            ><InputText
              :id="id"
              v-model="baseUrl"
              type="url"
              required
              :disabled="busy" /></Field
          ><Field :label="t('token')" v-slot="{ id }"
            ><Textarea
              :id="id"
              v-model="token"
              rows="4"
              required
              autocomplete="off"
              :spellcheck="false"
              :disabled="busy" /></Field
          ><Button
            type="submit"
            :label="t('connect')"
            icon="pi pi-arrow-right"
            icon-pos="right"
            :loading="busy"
          />
        </form>
        <p class="access-note"><i class="pi pi-lock" />{{ t("tokenNote") }}</p>
        <p class="help-text">{{ t("accessHelp") }}</p>
        <Terms />
      </div>
    </section>
  </main>
</template>
