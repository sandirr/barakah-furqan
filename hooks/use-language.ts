import { useTranslation } from 'react-i18next';

export type Language = 'en' | 'id';

export const LANGUAGES = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia' },
] as const;

export const useLanguage = () => {
  const { i18n } = useTranslation();
  
  const changeLanguage = async (lng: Language) => {
    await i18n.changeLanguage(lng);
  };
  
  const currentLanguage = i18n.language as Language;
  
  const getCurrentLanguageInfo = () => {
    return LANGUAGES.find(lang => lang.code === currentLanguage);
  };
  
  return {
    changeLanguage,
    currentLanguage,
    currentLanguageInfo: getCurrentLanguageInfo(),
    availableLanguages: LANGUAGES,
  };
};