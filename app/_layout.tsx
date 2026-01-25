import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import moment from 'moment';
import 'moment/locale/ar';
import 'moment/locale/id';
import 'moment/locale/ms';
import 'moment/locale/ur';
import 'react-native-reanimated';
import '../global.css';
import '../i18n';

import { useColorScheme } from '@/hooks/use-color-scheme';
import i18n from '@/i18n';
import { quranService } from '@/services/quran.service';
import { useColorScheme as useSystemColorScheme } from 'nativewind';
import { useEffect } from 'react';

export const unstable_settings = {
  anchor: '(tabs)',
};

const MOMENT_LOCALE_MAP: { [key: string]: string } = {
  id: 'id',
  en: 'en',
  ms: 'ms',
  ur: 'ur',
  ar: 'ar',
};

export default function RootLayout() {
  const { colorScheme } = useColorScheme();
  const { setColorScheme } = useSystemColorScheme();

  useEffect(() => {
    setColorScheme(colorScheme);
  }, [colorScheme]);

  useEffect(() => {
    const updateMomentLocale = () => {
      const currentLanguage = i18n.language || 'en';
      const momentLocale = MOMENT_LOCALE_MAP[currentLanguage] || 'en';
      moment.locale(momentLocale);
    };

    updateMomentLocale();

    i18n.on('languageChanged', updateMomentLocale);

    return () => {
      i18n.off('languageChanged', updateMomentLocale);
    };
  }, []);

  // Auto download Quran data in background
  useEffect(() => {
    const autoDownloadQuran = async () => {
      try {
        // getDownloadStatus is now synchronous
        const status = quranService.getDownloadStatus();
        const currentLanguage = i18n.language || 'id';
        
        // Only download if not already downloaded for current language
        if (!status || !status.languages.includes(currentLanguage)) {
          console.log(`Starting background download for language: ${currentLanguage}`);
          
          // Download in background without blocking UI
          quranService.downloadAllSurahsForLanguage(currentLanguage, (progress) => {
            // console.log(`Download progress: ${progress.current}/${progress.total} - ${progress.currentSurah}`);
          }).catch(error => {
            console.error('Background download failed:', error);
          });
        } else {
          console.log(`Quran data already available for ${currentLanguage}`);
        }
      } catch (error) {
        console.error('Error checking download status:', error);
      }
    };

    // Start download after a short delay to not block app startup
    const timeout = setTimeout(() => {
      autoDownloadQuran();
    }, 2000);

    return () => clearTimeout(timeout);
  }, []);

  // Re-download when language changes
  useEffect(() => {
    const handleLanguageChange = async (newLanguage: string) => {
      // getDownloadStatus is now synchronous
      const status = quranService.getDownloadStatus();
      
      if (!status || !status.languages.includes(newLanguage)) {
        console.log(`Language changed to ${newLanguage}, downloading...`);
        quranService.downloadAllSurahsForLanguage(newLanguage).catch(error => {
          console.error('Language change download failed:', error);
        });
      }
    };

    i18n.on('languageChanged', handleLanguageChange);

    return () => {
      i18n.off('languageChanged', handleLanguageChange);
    };
  }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        <Stack.Screen name="quran/index" options={{ headerShown: false }} />
        <Stack.Screen name="quran/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="kiblat" options={{ headerShown: false }} />
        <Stack.Screen name="shalat" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}