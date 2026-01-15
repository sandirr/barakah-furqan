import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme as useNativeWindColorScheme } from 'nativewind';
import { useEffect } from 'react';

const COLOR_SCHEME_KEY = '@barakah_furqan:color_scheme';

export function useColorScheme() {
  const { colorScheme, setColorScheme } = useNativeWindColorScheme();

  useEffect(() => {
    loadColorScheme();
  }, []);

  const loadColorScheme = async () => {
    try {
      const saved = await AsyncStorage.getItem(COLOR_SCHEME_KEY);
      if (saved && (saved === 'light' || saved === 'dark')) {
        setColorScheme(saved as 'light' | 'dark');
      }
    } catch (error) {
      console.error('Failed to load color scheme:', error);
    }
  };

  const toggleColorScheme = async () => {
    const newScheme = colorScheme === 'light' ? 'dark' : 'light';
    setColorScheme(newScheme);
    try {
      await AsyncStorage.setItem(COLOR_SCHEME_KEY, newScheme);
    } catch (error) {
      console.error('Failed to save color scheme:', error);
    }
  };

  const setColorSchemeValue = async (scheme: 'light' | 'dark') => {
    setColorScheme(scheme);
    try {
      await AsyncStorage.setItem(COLOR_SCHEME_KEY, scheme);
    } catch (error) {
      console.error('Failed to save color scheme:', error);
    }
  };

  return {
    colorScheme: colorScheme ?? 'light',
    toggleColorScheme,
    setColorScheme: setColorSchemeValue,
  };
}