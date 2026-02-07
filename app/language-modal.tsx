import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useLanguage } from '@/hooks/use-language';
import { useRouter } from 'expo-router';
import { ChevronLeft, CircleCheck } from 'lucide-react-native';
import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

export default function LanguageModalScreen() {
  const { t } = useTranslation();
  const { changeLanguage, currentLanguage, availableLanguages } = useLanguage();
  const { colorScheme } = useColorScheme();
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-900" edges={["top"]}>
      <View className="flex-row items-center px-4 py-4 border-b border-gray-200 dark:border-gray-800">
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-9 h-9 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 mr-3"
          activeOpacity={0.7}
        >
          <ChevronLeft size={18} color={Colors[colorScheme ?? 'light'].icon} />
        </TouchableOpacity>
        <Text className="text-xl font-semibold text-gray-900 dark:text-white">
          {t('settings.language')}
        </Text>
      </View>

      <ScrollView className="flex-1">
        <View className="px-4 py-6">
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
                      <Text className="text-xl">
                        {lang.flag}
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
                    <CircleCheck size={22} color={Colors[colorScheme ?? 'light'].tint} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
