import { inject, ref } from "vue";
import { useI18n } from "vue-i18n";
export function useWorkspace() {
  return inject("workspace");
}
export function useFeedback() {
  const workspace = useWorkspace(),
    { t } = useI18n();
  const busy = ref(false),
    error = ref(""),
    success = ref("");
  async function execute(work, message = "") {
    if (busy.value) return;
    busy.value = true;
    error.value = "";
    success.value = "";
    workspace.pending.value++;
    try {
      const result = await work();
      success.value = message;
      return result;
    } catch (e) {
      if (e.name !== "AbortError") {
        error.value = t("error." + (e.code || "unexpected"));
        if (e.code === "api" && e.detail) error.value += " " + e.detail;
        if (e.status === 401) workspace.disconnect();
      }
    } finally {
      busy.value = false;
      workspace.pending.value--;
    }
  }
  return { busy, error, success, execute };
}
