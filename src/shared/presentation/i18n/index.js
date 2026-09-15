import { createI18n } from "vue-i18n";
import messages from "./messages.js";
export const i18n = createI18n({
  legacy: false,
  locale: ["en_US", "es_419"].includes(
    localStorage.getItem("smartquote.locale"),
  )
    ? localStorage.getItem("smartquote.locale")
    : "en_US",
  fallbackLocale: "en_US",
  messages,
});
