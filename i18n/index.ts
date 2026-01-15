import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import id from './locales/id.json';

const LANGUAGE_KEY = '@barakah_furqan:language';

const resources = {
  en: { translation: en },
  id: { translation: id },
};

// Get device language
const deviceLanguage = Localization.getLocales()[0]?.languageCode || 'en';

// Initialize i18n
const initI18n = async () => {
  let savedLanguage = deviceLanguage;
  
  try {
    const storedLanguage = await AsyncStorage.getItem(LANGUAGE_KEY);
    if (storedLanguage) {
      savedLanguage = storedLanguage;
    }
  } catch (error) {
    console.error('Failed to load language from storage:', error);
  }

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

  // Save language on change
  i18n.on('languageChanged', async (lng) => {
    try {
      await AsyncStorage.setItem(LANGUAGE_KEY, lng);
    } catch (error) {
      console.error('Failed to save language:', error);
    }
  });
};

initI18n();

export default i18n;