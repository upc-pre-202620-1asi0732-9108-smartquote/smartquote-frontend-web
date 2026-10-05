<script setup>
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import Button from "primevue/button";
import InputText from "primevue/inputtext";
import Select from "primevue/select";
import Field from "../../shared/presentation/components/form-field.vue";
import Feedback from "../../shared/presentation/components/feedback-notice.vue";
import {
  REGISTRATION_ROLES,
  isPasswordValid,
  passwordRules,
} from "../domain/registration.entity.js";

const props = defineProps({ register: { type: Function, required: true } });
const emit = defineEmits(["done"]);
const { t } = useI18n();

const email = ref(""),
  displayName = ref(""),
  password = ref(""),
  confirmation = ref(""),
  role = ref(REGISTRATION_ROLES[0]),
  busy = ref(false),
  errorKey = ref(""),
  errorDetail = ref(""),
  successKey = ref("");

const errorMessage = computed(() => {
  if (!errorKey.value) return "";
  return errorKey.value === "invalidRegistration" && errorDetail.value
    ? errorDetail.value
    : t("error." + errorKey.value);
});
const successMessage = computed(() => (successKey.value ? t(successKey.value) : ""));

const roleOptions = REGISTRATION_ROLES.map((value) => ({
  value,
  label: t("role." + value),
}));

const RULE_LABELS = {
  length: "ruleLength",
  upper: "ruleUpper",
  lower: "ruleLower",
  digit: "ruleDigit",
  symbol: "ruleSymbol",
  control: "ruleControl",
  email: "ruleEmail",
};

const rules = computed(() =>
  Object.entries(passwordRules(password.value, email.value)).map(([key, ok]) => ({
    key,
    ok,
    label: RULE_LABELS[key],
  })),
);

async function submit() {
  errorKey.value = "";
  errorDetail.value = "";
  successKey.value = "";
  if (password.value !== confirmation.value) {
    errorKey.value = "passwordMismatch";
    return;
  }
  if (!isPasswordValid(password.value, email.value)) {
    errorKey.value = "passwordPolicy";
    return;
  }
  busy.value = true;
  try {
    const account = await props.register({
      email: email.value,
      displayName: displayName.value,
      password: password.value,
      role: role.value,
    });
    successKey.value = account.initialSetup
      ? "registerDoneActive"
      : "registerDonePending";
    password.value = "";
    confirmation.value = "";
    emit("done");
  } catch (e) {
    errorKey.value = e.code || "unexpected";
    errorDetail.value = e.detail || "";
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="register-form">
    <h2>{{ t("createAccountTitle") }}</h2>
    <p class="muted">{{ t("createAccountIntro") }}</p>
    <Feedback :error="errorMessage" :success="successMessage" />
    <form @submit.prevent="submit" class="stack" novalidate>
      <Field :label="t('displayName')" v-slot="{ id }"
        ><InputText :id="id" v-model="displayName" autocomplete="name" required :disabled="busy" /></Field
      ><Field :label="t('email')" v-slot="{ id }"
        ><InputText :id="id" v-model="email" type="email" autocomplete="email" required :disabled="busy" /></Field
      ><Field :label="t('accountRole')" v-slot="{ id }"
        ><Select :input-id="id" v-model="role" :options="roleOptions" option-label="label" option-value="value" :disabled="busy"
      /></Field
      ><Field :label="t('password')" v-slot="{ id }"
        ><InputText :id="id" v-model="password" type="password" autocomplete="new-password" required :disabled="busy" /></Field
      ><ul class="password-rules" :aria-label="t('passwordRulesTitle')">
        <li v-for="rule in rules" :key="rule.key" :class="{ 'is-ok': rule.ok }">
          <i :class="rule.ok ? 'pi pi-check-circle' : 'pi pi-circle'" aria-hidden="true" />
          <span>{{ t(rule.label) }}</span>
        </li>
      </ul><Field :label="t('confirmPassword')" v-slot="{ id }"
        ><InputText :id="id" v-model="confirmation" type="password" autocomplete="new-password" required :disabled="busy" /></Field
      ><Button
        type="submit"
        :label="t('registerSubmit')"
        icon="pi pi-user-plus"
        :loading="busy"
      />
    </form>
  </div>
</template>
