import { IconSymbol } from '@/components/ui/icon-symbol';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Book, Clock9, Compass, Info } from "lucide-react-native";
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
      icon: <Book size={28} color="#FFFFFF" />,
      color: 'bg-emerald-500',
      darkColor: 'dark:bg-emerald-600',
      route: '/quran',
    },
    {
      id: 'kiblat',
      title: t('home.kiblat'),
      icon: <Compass size={28} color="#FFFFFF" />,
      color: 'bg-teal-500',
      darkColor: 'dark:bg-teal-600',
      route: '/kiblat',
    },
    {
      id: 'shalat',
      title: t('home.shalat'),
      icon: <Clock9 size={28} color="#FFFFFF" />,
      color: 'bg-green-500',
      darkColor: 'dark:bg-green-600',
      route: '/shalat',
    },
  ];

  const handleMenuPress = (route: string) => {
    router.push(route as any);
  };

  const getDailyReminder = () => {
    const dayOfWeek = new Date().getDay();
    return {
      text: t(`home.dailyReminder${dayOfWeek}`),
      verse: t(`home.dailyReminderVerse${dayOfWeek}`)
    };
  };

  const reminder = getDailyReminder();

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-900" edges={["top"]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16 }}
      >
        <View className="mb-6 flex-row items-center justify-between">
          <Image source={require("@/assets/images/icon-barakah.png")} className='h-20 w-20 rounded-full' />
          <View>
            <Text className="text-2xl font-bold text-gray-900 dark:text-white">
              Barakah Furqan
            </Text>
            <Text className="text-2xl font-bold text-gray-900 dark:text-white text-right">
              هُدًى لِّلْمُتَّقِينَ
            </Text>
          </View>
        </View>

        <View className="bg-emerald-600 dark:bg-emerald-700 rounded-3xl p-4 mb-6 shadow-lg">
          <Text className="text-white text-xl font-bold mb-1 text-center">
            {t('home.greeting')}
          </Text>
          <Text className="text-emerald-50 text-sm text-center">
            {t('home.description')}
          </Text>
        </View>

        <View className="gap-y-4">
          {menuItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              onPress={() => handleMenuPress(item.route)}
              activeOpacity={0.7}
              className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-200 dark:border-gray-700"
            >
              <View className="flex-row items-center">
                <View className={`w-14 h-14 ${item.color} ${item.darkColor} rounded-2xl items-center justify-center mr-4 shadow-sm`}>
                  {item.icon}
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
          style={{ borderRadius: 16, padding: 16, marginTop: 24 }}
        >
          <View className="flex-row items-center mb-2">
            <Info size={24} color="#059669" />
            <Text className="text-lg font-semibold text-gray-900 dark:text-white ml-2">
              {t('home.dailyReminder')}
            </Text>
          </View>
          <Text className="text-gray-700 dark:text-gray-300 leading-6 mb-2 text-sm">
            {reminder.text}
          </Text>
          <Text className="text-emerald-700 dark:text-emerald-400 text-sm italic">
            {reminder.verse}
          </Text>
        </LinearGradient>
      </ScrollView>
    </SafeAreaView>
  );
}