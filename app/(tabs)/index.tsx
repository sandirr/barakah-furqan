import { IconSymbol } from '@/components/ui/icon-symbol';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Image, ScrollView, Text, TouchableOpacity, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HomeScreen() {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();

  const menuItems = [
    {
      id: 'quran',
      title: t('home.quran'),
      icon: 'book',
      color: 'bg-emerald-500',
      darkColor: 'dark:bg-emerald-600',
      route: '/quran',
    },
    {
      id: 'kiblat',
      title: t('home.kiblat'),
      icon: 'explore',
      color: 'bg-teal-500',
      darkColor: 'dark:bg-teal-600',
      route: '/kiblat',
    },
    {
      id: 'shalat',
      title: t('home.shalat'),
      icon: 'schedule',
      color: 'bg-green-500',
      darkColor: 'dark:bg-green-600',
      route: '/shalat',
    },
  ];

  const handleMenuPress = (route: string) => {
    router.push(route as any);
  };

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-900" edges={["top"]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16 }}
      >
        <View className="items-center mb-8">
          {/* <View className="w-20 h-20 bg-emerald-600 dark:bg-emerald-700 rounded-full items-center justify-center mb-4 shadow-lg">
            <IconSymbol size={40} name="book" color="#FFFFFF" />
          </View> */}
          <Image source={require("@/assets/images/icon-barakah.png")} className='h-20 w-20 rounded-full mb-4' />
          <Text className="text-3xl font-bold text-gray-900 dark:text-white">
            Barakah Furqan
          </Text>
        </View>

        <View className="bg-emerald-600 dark:bg-emerald-700 rounded-3xl p-6 mb-8 shadow-lg">
          <Text className="text-white text-2xl font-bold mb-2">
            {t('home.greeting')}
          </Text>
          <Text className="text-emerald-50 text-base">
            {t('home.description')}
          </Text>
        </View>

        <View className="gap-y-4">
          {menuItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              onPress={() => handleMenuPress(item.route)}
              activeOpacity={0.7}
              className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-md border border-gray-100 dark:border-gray-700"
            >
              <View className="flex-row items-center">
                <View className={`w-14 h-14 ${item.color} ${item.darkColor} rounded-2xl items-center justify-center mr-4 shadow-sm`}>
                  <IconSymbol size={28} name={item.icon} color="#FFFFFF" />
                </View>
                <View className="flex-1">
                  <Text className="text-xl font-bold text-gray-900 dark:text-white">
                    {item.title}
                  </Text>
                  <Text className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {t(`home.${item.id}Description`)}
                  </Text>
                </View>
                <IconSymbol size={24} name="chevron-right" color="#9CA3AF" />
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <LinearGradient
          colors={colorScheme === 'dark' ? ['#1f2937', '#374151'] : ['#d1fae5', '#ccfbf1']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ borderRadius: 16, padding: 24, marginTop: 32 }}
        >
          <View className="flex-row items-center mb-3">
            <IconSymbol size={24} name="info" color="#059669" />
            <Text className="text-lg font-semibold text-gray-900 dark:text-white ml-2">
              {t('home.dailyReminder')}
            </Text>
          </View>
          <Text className="text-gray-700 dark:text-gray-300 leading-6">
            {t('home.dailyReminderText')}
          </Text>
        </LinearGradient>
      </ScrollView>
    </SafeAreaView>
  );
}