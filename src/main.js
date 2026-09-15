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
      50: "{emerald.50}",
      100: "{emerald.100}",
      200: "{emerald.200}",
      300: "{emerald.300}",
      400: "{emerald.400}",
      500: "{emerald.600}",
      600: "{emerald.700}",
      700: "{emerald.800}",
      800: "{emerald.900}",
      900: "{emerald.950}",
      950: "{emerald.950}",
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
