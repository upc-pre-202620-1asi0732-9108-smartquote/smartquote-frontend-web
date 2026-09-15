import { useI18n } from "vue-i18n";
export function useFormat() {
  const { locale } = useI18n(),
    language = () => (locale.value === "es_419" ? "es-419" : "en-US");
  return {
    money(value, currency = "PEN") {
      if (value == null) return "—";
      try {
        return new Intl.NumberFormat(language(), {
          style: "currency",
          currency,
        }).format(value);
      } catch {
        return value + " " + currency;
      }
    },
    date(value, time = false) {
      return value
        ? new Date(
            value.length === 10 ? value + "T12:00:00" : value,
          ).toLocaleString(
            language(),
            time
              ? { dateStyle: "medium", timeStyle: "short" }
              : { dateStyle: "medium" },
          )
        : "—";
    },
    score(value) {
      return new Intl.NumberFormat(language(), {
        maximumFractionDigits: 1,
      }).format(value * 100);
    },
  };
}
