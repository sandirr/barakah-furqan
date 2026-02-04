import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { Colors } from '@/constants/theme';
import { BookIcon, HomeIcon, Settings2 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useColorScheme } from 'react-native';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { t } = useTranslation();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          backgroundColor: colorScheme === 'dark'
            ? '#1F2937'
            : '#FFFFFF'
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: t('navigation.home'),
          tabBarIcon: ({ color }) => <HomeIcon size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="quran-practice"
        options={{
          href: null,
          title: t('navigation.quranPractice'),
          tabBarIcon: ({ color }) => <BookIcon size={24} color={color} />,
        }}
      />
      {/* <Tabs.Screen
        name="read-arab"
        options={{
          href: null,
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="mic" color={color} />,
        }}
      /> */}
      <Tabs.Screen
        name="settings"
        options={{
          title: t('navigation.settings'),
          tabBarIcon: ({ color }) => <Settings2 size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}