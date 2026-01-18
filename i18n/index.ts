import { settings } from '@/services/storage.service'; // MMKV
import * as Localization from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import ar from './locales/ar.json';
import en from './locales/en.json';
import id from './locales/id.json';
import ms from './locales/ms.json';
import ur from './locales/ur.json';

const LANGUAGE_KEY = 'barakah_furqan_app_language';

const resources = {
  en: { translation: en },
  id: { translation: id },
  ms: { translation: ms },
  ur: { translation: ur },
  ar: { translation: ar },
};

const SUPPORTED_LANGUAGES = ['en', 'id', 'ms', 'ur', 'ar'];

// Get device language and validate against supported languages
const getDeviceLanguage = (): string => {
  const deviceLang = Localization.getLocales()[0]?.languageCode || 'en';
  
  // Check if device language is supported
  if (SUPPORTED_LANGUAGES.includes(deviceLang)) {
    return deviceLang;
  }
  
  // Fallback logic untuk bahasa serumpun
  const baseLang = deviceLang.split('-')[0];
  if (SUPPORTED_LANGUAGES.includes(baseLang)) {
    return baseLang;
  }
  
  // Default fallback
  return 'en';
};

const initI18n = () => {
  const deviceLanguage = getDeviceLanguage();
  
  // Get saved language from MMKV (synchronous!)
  const storedLanguage = settings.getString(LANGUAGE_KEY);
  const savedLanguage = (storedLanguage && SUPPORTED_LANGUAGES.includes(storedLanguage)) 
    ? storedLanguage 
    : deviceLanguage;

  i18n
    .use(initReactI18next)
    .init({
      resources,
      lng: savedLanguage,
      fallbackLng: 'en',
      compatibilityJSON: 'v4',
      interpolation: {
        escapeValue: false,
      },
      react: {
        useSuspense: false,
      },
    });

  // Save language when changed (synchronous!)
  i18n.on('languageChanged', (lng) => {
    settings.set(LANGUAGE_KEY, lng);
  });
};

initI18n();

export default i18n;