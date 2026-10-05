import { createApp } from "vue";
import PrimeVue from "primevue/config";
import { definePreset } from "@primeuix/themes";
import Material from "@primeuix/themes/material";
import App from "./app/app.vue";
import { router } from "./app/router.js";
import { i18n } from "./shared/presentation/i18n/index.js";
import "primeicons/primeicons.css";
import "./shared/presentation/styles.css";
const theme = definePreset(Material, {
  semantic: {
    primary: {
      50: "#f2f7fa",
      100: "#dbeaf2",
      200: "#b9d5e5",
      300: "#8bbbd3",
      400: "#4c8fb4",
      500: "#0f5b8c",
      600: "#0c4e78",
      700: "#093a5a",
      800: "#07314c",
      900: "#05263b",
      950: "#031b2a",
    },
  },
});
createApp(App)
  .use(PrimeVue, {
    ripple: true,
    theme: { preset: theme, options: { darkModeSelector: ".dark-mode" } },
  })
  .use(i18n)
  .use(router)
  .mount("#app");
