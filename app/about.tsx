import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { updateService } from '@/services/update.service';
import { useRouter } from 'expo-router';
import { ChevronLeft, RefreshCw } from 'lucide-react-native';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

export default function AboutScreen() {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const router = useRouter();
  const [checking, setChecking] = useState(false);

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
          {t('about.title')}
        </Text>
      </View>

      <ScrollView className="flex-1">
        <View className="px-4 py-6">
          <View className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-5 mb-5">
            <Text className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
              Barakah Furqan
            </Text>
            <Text className="text-sm text-gray-600 dark:text-gray-400">
              {t('settings.version')} 1.0.0
            </Text>
            <Text className="text-base text-gray-700 dark:text-gray-300 mt-4">
              {t('about.description')}
            </Text>
            {Platform.OS !== 'web' && (
              <TouchableOpacity
                onPress={async () => {
                  setChecking(true);
                  try {
                    const updated = await updateService.checkAndPromptUpdate();
                    if (!updated) {
                      Alert.alert(
                        t('about.checkUpdates'),
                        t('about.noUpdateAvailable')
                      );
                    }
                  } catch {
                    Alert.alert(t('common.error'), t('about.updateCheckFailed'));
                  } finally {
                    setChecking(false);
                  }
                }}
                disabled={checking}
                className="flex-row items-center justify-center mt-4 py-3 px-4 rounded-xl bg-green-100 dark:bg-green-900"
              >
                {checking ? (
                  <ActivityIndicator size="small" color="#059669" />
                ) : (
                  <>
                    <RefreshCw size={18} color="#059669" />
                    <Text className="text-green-700 dark:text-green-300 font-semibold ml-2">
                      {t('about.checkUpdates')}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>

          <Text className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase mb-3">
            {t('about.dataTitle')}
          </Text>
          <View className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-5 mb-5">
            <Text className="text-base text-gray-700 dark:text-gray-300 mb-2">
              {t('about.dataIntro')}
            </Text>
            <Text className="text-base text-gray-700 dark:text-gray-300 mb-2">
              • {t('about.dataLocation')}
            </Text>
            <Text className="text-base text-gray-700 dark:text-gray-300 mb-2">
              • {t('about.dataMicrophone')}
            </Text>
            <Text className="text-base text-gray-700 dark:text-gray-300 mb-2">
              • {t('about.dataInternet')}
            </Text>
            <Text className="text-base text-gray-700 dark:text-gray-300">
              • {t('about.dataSpeech')}
            </Text>
          </View>

          <Text className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase mb-3">
            {t('about.notesTitle')}
          </Text>
          <View className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-5">
            <Text className="text-base text-gray-700 dark:text-gray-300">
              {t('about.notes')}
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
