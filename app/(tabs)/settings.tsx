import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useLanguage } from '@/hooks/use-language';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Switch, Text, TouchableOpacity, View } from 'react-native';

export default function SettingsScreen() {
  const { t } = useTranslation();
  const { changeLanguage, currentLanguage, availableLanguages } = useLanguage();
  const { colorScheme, toggleColorScheme } = useColorScheme();

  const isDark = colorScheme === 'dark';
  // const colors = Colors[colorScheme ?? 'light'];

  return (
    <ScrollView className="flex-1 bg-white dark:bg-gray-900">
      {/* Header */}
      <View className="px-4 pt-16 pb-6">
        <Text className="text-3xl font-bold text-gray-900 dark:text-white">
          {t('settings.title')}
        </Text>
        <Text className="text-base text-gray-600 dark:text-gray-400 mt-2">
          {t('settings.description')}
        </Text>
      </View>

      {/* Settings Sections */}
      <View className="px-4 pb-6">
        {/* Appearance Section */}
        <View className="mb-6">
          <Text className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase mb-3">
            {t('settings.appearance')}
          </Text>
          
          <View className="bg-gray-50 dark:bg-gray-800 rounded-2xl overflow-hidden">
            {/* Dark Mode Toggle */}
            <View className="flex-row items-center justify-between px-4 py-4 border-b border-gray-200 dark:border-gray-700">
              <View className="flex-row items-center flex-1">
                <View className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full items-center justify-center mr-3">
                  <IconSymbol 
                    size={20} 
                    name={isDark ? "dark-mode" : "light-mode"} 
                    color={Colors[colorScheme ?? 'light'].icon} 
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-base font-medium text-gray-900 dark:text-white">
                    {t('settings.darkMode')}
                  </Text>
                  <Text className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                    {isDark ? t('settings.darkModeOn') : t('settings.darkModeOff')}
                  </Text>
                </View>
              </View>
              <Switch
                value={isDark}
                onValueChange={toggleColorScheme}
                trackColor={{ false: '#D1D5DB', true: Colors[colorScheme ?? 'light'].tint }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>
        </View>

        {/* Language Section */}
        <View className="mb-6">
          <Text className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase mb-3">
            {t('settings.language')}
          </Text>
          
          <View className="bg-gray-50 dark:bg-gray-800 rounded-2xl overflow-hidden">
            {availableLanguages.map((lang, index) => {
              const isSelected = currentLanguage === lang.code;
              const isLast = index === availableLanguages.length - 1;
              
              return (
                <TouchableOpacity
                  key={lang.code}
                  onPress={() => changeLanguage(lang.code)}
                  className={`flex-row items-center justify-between px-4 py-4 ${
                    !isLast ? 'border-b border-gray-200 dark:border-gray-700' : ''
                  }`}
                  activeOpacity={0.7}
                >
                  <View className="flex-row items-center flex-1">
                    <View className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full items-center justify-center mr-3">
                      <Text className="text-lg">
                        {lang.code === 'en' ? '🇬🇧' : '🇮🇩'}
                      </Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-base font-medium text-gray-900 dark:text-white">
                        {lang.nativeName}
                      </Text>
                      <Text className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                        {lang.name}
                      </Text>
                    </View>
                  </View>
                  {isSelected && (
                    <IconSymbol 
                      size={24} 
                      name="check-circle" 
                      color={Colors[colorScheme ?? 'light'].tint} 
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* About Section */}
        <View className="mb-6">
          <Text className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase mb-3">
            {t('settings.about')}
          </Text>
          
          <View className="bg-gray-50 dark:bg-gray-800 rounded-2xl overflow-hidden">
            <View className="px-4 py-4 items-center">
              <Text className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Barakah Furqan
              </Text>
              <Text className="text-sm text-gray-600 dark:text-gray-400">
                {t('settings.version')} 1.0.0
              </Text>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}