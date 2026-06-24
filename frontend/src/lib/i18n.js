import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

// Load only default language initially for faster initial load
import en from "@/locales/en/translation.json";

export const SUPPORTED_LANG_CODES = ["en", "es", "fr", "de", "ar", "zh", "pt", "ja", "rw", "sw"];

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
    },
    fallbackLng: "en",
    supportedLngs: SUPPORTED_LANG_CODES,
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "iqon_lang",
      caches: ["localStorage"],
    },
  });

export default i18n;
