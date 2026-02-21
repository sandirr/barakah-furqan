import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useLanguage } from '@/hooks/use-language';
import { useRouter } from 'expo-router';
import { ChevronRight, FileText, Globe, Heart, Info, Mail, Moon, Sun } from 'lucide-react-native';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Platform, ScrollView, Switch, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SettingsScreen() {
  const { t } = useTranslation();
  const { currentLanguageInfo } = useLanguage();
  const { colorScheme, toggleColorScheme } = useColorScheme();
  const router = useRouter();

  const isDark = colorScheme === 'dark';
  const languageLabel = currentLanguageInfo?.nativeName ?? t('settings.language');

  const openStoreForFeedback = () => {
    if (Platform.OS === 'android') {
      const packageName = 'com.barakah.furqan';
      Linking.openURL(`market://details?id=${packageName}`).catch(() => {
        Linking.openURL(`https://play.google.com/store/apps/details?id=${packageName}`);
      });
    } else {
      Linking.openURL('mailto:dgirsandi@gmail.com');
    }
  };

  return (
    <SafeAreaView className='flex-1 bg-white dark:bg-gray-900' edges={["top"]}>
      <ScrollView className="flex-1">
        <View className="p-4">
          <Text className="text-3xl font-bold text-gray-900 dark:text-white">
            {t('settings.title')}
          </Text>
          <Text className="text-base text-gray-600 dark:text-gray-400 mt-2">
            {t('settings.description')}
          </Text>
        </View>

        <View className="px-4 pb-6">
          <View className="mb-6">
            <Text className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase mb-3">
              {t('settings.preference')}
            </Text>
            
            <View className="bg-gray-50 dark:bg-gray-800 rounded-2xl overflow-hidden">
              <View className="flex-row items-center justify-between px-4 py-4 border-b border-gray-200 dark:border-gray-700">
                <View className="flex-row items-center flex-1">
                  <View className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full items-center justify-center mr-3">
                    {isDark ? (
                      <Moon size={20} color={Colors[colorScheme ?? 'light'].icon} />
                    ) : (
                      <Sun size={20} color={Colors[colorScheme ?? 'light'].icon} />
                    )}
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

              <TouchableOpacity
                onPress={() => router.push('/language-modal')}
                className="flex-row items-center justify-between px-4 py-4"
                activeOpacity={0.7}
              >
                <View className="flex-row items-center flex-1">
                  <View className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full items-center justify-center mr-3">
                    <Globe size={20} color={Colors[colorScheme ?? 'light'].icon} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-base font-medium text-gray-900 dark:text-white">
                      {t('settings.language')}
                    </Text>
                    <Text className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                      {languageLabel}
                    </Text>
                  </View>
                </View>
                <ChevronRight size={20} color={Colors[colorScheme ?? 'light'].icon} />
              </TouchableOpacity>
            </View>
          </View>

          <View className="mb-6">
            <Text className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase mb-3">
              {t('settings.support')}
            </Text>
            
            <View className="bg-gray-50 dark:bg-gray-800 rounded-2xl overflow-hidden">
              <TouchableOpacity
                onPress={() => router.push('/donation')}
                className="flex-row items-center justify-between px-4 py-4 border-b border-gray-200 dark:border-gray-700"
                activeOpacity={0.7}
              >
                <View className="flex-row items-center flex-1">
                  <View className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full items-center justify-center mr-3">
                    <Heart size={20} color={Colors[colorScheme ?? 'light'].icon} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-base font-medium text-gray-900 dark:text-white">
                      {t('settings.donation')}
                    </Text>
                    <Text className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                      {t('settings.donationSubtitle')}
                    </Text>
                  </View>
                </View>
                <ChevronRight size={20} color={Colors[colorScheme ?? 'light'].icon} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={openStoreForFeedback}
                className="flex-row items-center justify-between px-4 py-4"
                activeOpacity={0.7}
              >
                <View className="flex-row items-center flex-1">
                  <View className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full items-center justify-center mr-3">
                    <Mail size={20} color={Colors[colorScheme ?? 'light'].icon} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-base font-medium text-gray-900 dark:text-white">
                      {t('settings.feedback')}
                    </Text>
                    <Text className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                      {t('settings.feedbackSubtitle')}
                    </Text>
                  </View>
                </View>
                <ChevronRight size={20} color={Colors[colorScheme ?? 'light'].icon} />
              </TouchableOpacity>
            </View>
          </View>

          <View className="mb-6">
            <Text className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase mb-3">
              {t('settings.information')}
            </Text>
            
            <View className="bg-gray-50 dark:bg-gray-800 rounded-2xl overflow-hidden">
              <TouchableOpacity
                onPress={() => router.push('/about')}
                className="flex-row items-center justify-between px-4 py-4 border-b border-gray-200 dark:border-gray-700"
                activeOpacity={0.7}
              >
                <View className="flex-row items-center flex-1">
                  <View className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full items-center justify-center mr-3">
                    <Info size={20} color={Colors[colorScheme ?? 'light'].icon} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-base font-medium text-gray-900 dark:text-white">
                      {t('settings.about')}
                    </Text>
                    <Text className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                      {t('settings.aboutSubtitle')}
                    </Text>
                  </View>
                </View>
                <ChevronRight size={20} color={Colors[colorScheme ?? 'light'].icon} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => router.push('/privacy-policy')}
                className="flex-row items-center justify-between px-4 py-4"
                activeOpacity={0.7}
              >
                <View className="flex-row items-center flex-1">
                  <View className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full items-center justify-center mr-3">
                    <FileText size={20} color={Colors[colorScheme ?? 'light'].icon} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-base font-medium text-gray-900 dark:text-white">
                      {t('settings.privacyPolicy')}
                    </Text>
                    <Text className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                      {t('settings.privacyPolicySubtitle')}
                    </Text>
                  </View>
                </View>
                <ChevronRight size={20} color={Colors[colorScheme ?? 'light'].icon} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
