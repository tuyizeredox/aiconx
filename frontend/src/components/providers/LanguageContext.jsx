import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { aiAPI, authAPI } from "@/api/apiClient";
import { useAuth } from "@/lib/AuthContext";
import i18n, { SUPPORTED_LANG_CODES } from "@/lib/i18n";
export { useTranslation } from "react-i18next";

const RTL_LANGS = ["ar"];

const LANG_META = [
  { code: "en", label: "English", flag: "🇺🇸" },
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "de", label: "Deutsch", flag: "🇩🇪" },
  { code: "ar", label: "العربية", flag: "🇸🇦" },
  { code: "zh", label: "中文", flag: "🇨🇳" },
  { code: "pt", label: "Português", flag: "🇧🇷" },
  { code: "ja", label: "日本語", flag: "🇯🇵" },
  { code: "rw", label: "Kinyarwanda", flag: "🇷🇼" },
  { code: "sw", label: "Kiswahili", flag: "🇰🇪" },
];

export const SUPPORTED_LANGS = LANG_META.filter(l => SUPPORTED_LANG_CODES.includes(l.code));

const LanguageContext = createContext(null);

// In-memory translation cache with size limit
let translationCache = {};
const MAX_CACHE_SIZE = 1000;

function addToCache(key, value) {
  const keys = Object.keys(translationCache);
  if (keys.length >= MAX_CACHE_SIZE) {
    // Delete oldest entry
    delete translationCache[keys[0]];
  }
  translationCache[key] = value;
}

function detectBrowserLang() {
  const lang = navigator.language?.split("-")[0] || "en";
  return SUPPORTED_LANGS.find(l => l.code === lang) ? lang : "en";
}

export function LanguageProvider({ children }) {
  const { user, isAuthenticated } = useAuth();
  const [lang, setLangState] = useState(() => {
    const stored = localStorage.getItem("iqon_lang") || detectBrowserLang();
    if (i18n.language !== stored) {
      i18n.changeLanguage(stored);
    }
    return stored;
  });
  const hasSyncedUserLang = useRef(false);

  useEffect(() => {
    document.documentElement.dir = RTL_LANGS.includes(lang) ? "rtl" : "ltr";
    document.documentElement.lang = lang;
    if (i18n.language !== lang) {
      i18n.changeLanguage(lang);
    }
  }, [lang]);

  useEffect(() => {
    if (!isAuthenticated) {
      hasSyncedUserLang.current = false;
    }
  }, [isAuthenticated]);

  // Sync with user preference from backend once on load/login
  useEffect(() => {
    if (isAuthenticated && user?.preferences?.language && !hasSyncedUserLang.current) {
      if (user.preferences.language !== lang) {
        setLangState(user.preferences.language);
        localStorage.setItem("iqon_lang", user.preferences.language);
        // i18n.changeLanguage is handled by the [lang] effect above
      }
      hasSyncedUserLang.current = true;
    }
  }, [isAuthenticated, user, lang]);

  const setLang = async (code) => {
    if (code === lang) return;
    localStorage.setItem("iqon_lang", code);
    setLangState(code);
    i18n.changeLanguage(code);

    if (isAuthenticated && user && user.preferences?.language !== code) {
      try {
        await authAPI.updateProfile({ 
          preferences: { ...user.preferences, language: code } 
        });
      } catch (error) {
        console.error("Failed to sync language to profile", error);
      }
    }
  };

  const translate = useCallback(async (texts) => {
    if (!texts || texts.length === 0) return texts;
    if (lang === "en") return texts;

    const cacheKey = `${lang}:${JSON.stringify(texts)}`;
    if (translationCache[cacheKey]) return translationCache[cacheKey];

    try {
      const res = await aiAPI.translate({
        texts,
        targetLang: lang,
      });

      const translated = res?.translations || texts;
      addToCache(cacheKey, translated);
      return translated;
    } catch (error) {
      console.error("Translation failed", error);
      return texts;
    }
  }, [lang]);

  const currentLangInfo = SUPPORTED_LANGS.find(l => l.code === lang) || SUPPORTED_LANGS[0];

  return (
    <LanguageContext.Provider value={{ lang, setLang, translate, SUPPORTED_LANGS, currentLangInfo }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang() {
  const ctx = useContext(LanguageContext);
  if (!ctx) return { lang: "en", setLang: () => {}, translate: async (t) => t, SUPPORTED_LANGS, currentLangInfo: SUPPORTED_LANGS[0] };
  return ctx;
}

// Hook to translate a single text field reactively
export function useTranslated(text) {
  const { lang, translate } = useLang();
  const [out, setOut] = useState(text);

  useEffect(() => {
    setOut(text);
    if (!lang || lang === "en" || !text) return;
    translate([text]).then(res => setOut(res?.[0] ?? text));
  }, [text, lang, translate]);

  return out;
}