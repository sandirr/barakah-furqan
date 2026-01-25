import { useTranslation } from 'react-i18next';

export type Language = string;

export const LANGUAGES = [
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia', flag: '🇮🇩' },
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧' },
  { code: 'ms', name: 'Malay', nativeName: 'Bahasa Melayu', flag: '🇲🇾' },
  { code: 'ur', name: 'Urdu', nativeName: 'اردو', flag: '🇵🇰' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', flag: '🇹🇷' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', flag: '🇧🇩' },
  { code: 'fa', name: 'Persian', nativeName: 'فارسی', flag: '🇮🇷' },
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