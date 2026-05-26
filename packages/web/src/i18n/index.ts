import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import he from "./he.json";
import en from "./en.json";

export function initI18n(locale: "he" | "en" = "he") {
  if (i18n.isInitialized) {
    i18n.changeLanguage(locale);
    return i18n;
  }
  i18n.use(initReactI18next).init({
    resources: { he: { translation: he }, en: { translation: en } },
    lng: locale,
    fallbackLng: "en",
    interpolation: { escapeValue: false },
  });
  return i18n;
}

export default i18n;
