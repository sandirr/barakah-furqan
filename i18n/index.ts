import { settings } from '@/services/storage.service';
import * as Localization from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import ar from './locales/ar.json';
import bn from './locales/bn.json';
import en from './locales/en.json';
import fa from './locales/fa.json';
import fr from './locales/fr.json';
import ha from './locales/ha.json';
import hi from './locales/hi.json';
import id from './locales/id.json';
import ms from './locales/ms.json';
import ru from './locales/ru.json';
import so from './locales/so.json';
import tr from './locales/tr.json';
import ur from './locales/ur.json';

const LANGUAGE_KEY = 'barakah_furqan_app_language';

const resources = {
  en: { translation: en },
  id: { translation: id },
  ms: { translation: ms },
  hi: { translation: hi },
  fr: { translation: fr },
  ru: { translation: ru },
  ha: { translation: ha },
  so: { translation: so },
  ur: { translation: ur },
  ar: { translation: ar },
  tr: { translation: tr },
  bn: { translation: bn },
  fa: { translation: fa },
};

const SUPPORTED_LANGUAGES = ['en', 'id', 'ms', 'hi', 'fr', 'ru', 'ha', 'so', 'ur', 'ar', 'tr', 'bn', 'fa'];

const getDeviceLanguage = (): string => {
  const deviceLang = Localization.getLocales()[0]?.languageCode || 'en';
  
  if (SUPPORTED_LANGUAGES.includes(deviceLang)) {
    return deviceLang;
  }
  
  const baseLang = deviceLang.split('-')[0];
  if (SUPPORTED_LANGUAGES.includes(baseLang)) {
    return baseLang;
  }
  
  return 'en';
};

const initI18n = () => {
  const deviceLanguage = getDeviceLanguage();
  
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

  i18n.on('languageChanged', (lng) => {
    settings.set(LANGUAGE_KEY, lng);
  });
};

initI18n();

export default i18n;