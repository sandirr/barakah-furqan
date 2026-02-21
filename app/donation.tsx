import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useRouter } from 'expo-router';
import { ChevronLeft, ExternalLink } from 'lucide-react-native';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Linking, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const DONATION_URL = 'https://checkout.xendit.co/od/barakah-furqan-donation';

export default function DonationScreen() {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-900" edges={["top", "bottom"]}>
      <View className="flex-row items-center px-4 py-4 border-b border-gray-200 dark:border-gray-800">
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-9 h-9 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 mr-3"
          activeOpacity={0.7}
        >
          <ChevronLeft size={18} color={Colors[colorScheme ?? 'light'].icon} />
        </TouchableOpacity>
        <Text className="text-xl font-semibold text-gray-900 dark:text-white">
          {t('donation.title')}
        </Text>
      </View>

      <ScrollView className="flex-1">
        <View className="px-4 py-6">
          <Text className="text-base text-gray-700 dark:text-gray-300 mb-4">
            {t('donation.description')}
          </Text>

          <TouchableOpacity
            onPress={() => Linking.openURL(DONATION_URL)}
            className="flex-row items-center justify-center bg-green-600 rounded-xl py-3 mb-6"
            activeOpacity={0.85}
          >
            <Text className="text-base font-semibold text-white mr-2">
              {t('donation.openLink')}
            </Text>
            <ExternalLink size={18} color="#FFFFFF" />
          </TouchableOpacity>

          <View className="items-center mb-6">
            <Image
              source={require('@/assets/images/donation-qr.jpg')}
              className="w-56 h-56 rounded-2xl"
              resizeMode="contain"
            />
            <Text className="text-sm text-gray-600 dark:text-gray-400 mt-3 text-center">
              {t('donation.qrHint')}
            </Text>
          </View>

          <View className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-5">
            <Text className="text-base text-gray-700 dark:text-gray-300">
              {t('donation.disclaimer')}
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
