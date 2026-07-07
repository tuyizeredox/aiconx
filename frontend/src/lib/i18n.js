import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import en from "@/locales/en/translation.json";
import rw from "@/locales/rw/translation.json";

export const SUPPORTED_LANG_CODES = ["en", "rw"];

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      rw: { translation: rw },
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
