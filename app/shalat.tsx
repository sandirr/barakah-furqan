import { IconSymbol } from '@/components/ui/icon-symbol';
import { notificationService } from '@/services/notification.service';
import { PrayerTimes, prayerTimesService } from '@/services/prayer-times.service';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, RefreshControl, ScrollView, Switch, Text, TouchableOpacity, View } from 'react-native';

export default function ShalatScreen() {
  const { t } = useTranslation();
  const [prayerTimes, setPrayerTimes] = useState<PrayerTimes | null>(null);
  const [nextPrayer, setNextPrayer] = useState<{ name: string; time: string; timeUntil: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notificationEnabled, setNotificationEnabled] = useState(true);
  const [adhanEnabled, setAdhanEnabled] = useState(true);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationName, setLocationName] = useState<string>('');
  const [scheduledCount, setScheduledCount] = useState(0);

  useEffect(() => {
    loadPrayerTimes();
    loadSettings();
    requestNotificationPermission();

    const interval = setInterval(() => {
      if (prayerTimes) {
        updateNextPrayer(prayerTimes);
      }
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (notificationEnabled) {
      checkScheduledNotifications();
    }
  }, [notificationEnabled]);

  const requestNotificationPermission = async () => {
    await notificationService.requestPermissions();
  };

  const loadSettings = async () => {
    const notifEnabled = await notificationService.isNotificationEnabled();
    const azanEnabled = await notificationService.isAdhanEnabled();
    setNotificationEnabled(notifEnabled);
    setAdhanEnabled(azanEnabled);
  };

  const loadPrayerTimes = async () => {
    try {
      setError(null);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError(t('shalat.permissionDenied'));
        setLoading(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const userLocation = {
        lat: location.coords.latitude,
        lng: location.coords.longitude,
      };
      setLocation(userLocation);

      try {
        const geocode = await Location.reverseGeocodeAsync({
          latitude: userLocation.lat,
          longitude: userLocation.lng,
        });
        
        if (geocode && geocode.length > 0) {
          const address = geocode[0];
          const cityName = address.city || address.subregion || address.region || 'Lokasi Tidak Diketahui';
          setLocationName(cityName);
        }
      } catch (geoError) {
        console.log('Geocoding failed:', geoError);
        setLocationName('');
      }

      const times = await prayerTimesService.getPrayerTimes(
        userLocation.lat,
        userLocation.lng
      );
      
      setPrayerTimes(times);
      updateNextPrayer(times);

      if (notificationEnabled) {
        await notificationService.scheduleAllPrayerNotifications(times);
      }
    } catch (err) {
      console.error('Failed to load prayer times:', err);
      setError(t('shalat.loadError'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const updateNextPrayer = async (times: PrayerTimes) => {
    const next = await prayerTimesService.getNextPrayer(times);
    setNextPrayer(next);
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadPrayerTimes();
  };

  const toggleNotification = async (value: boolean) => {
    setNotificationEnabled(value);
    await notificationService.setNotificationEnabled(value);
    
    if (value && prayerTimes) {
      await notificationService.scheduleAllPrayerNotifications(prayerTimes);
      await checkScheduledNotifications();
    } else {
      await notificationService.cancelAllNotifications();
      setScheduledCount(0);
    }
  };

  const toggleAdhan = async (value: boolean) => {
    setAdhanEnabled(value);
    await notificationService.setAdhanEnabled(value);
  };

  const testAdhan = async () => {
    await notificationService.playAdhan();
  };

  const testNotification = async () => {
    try {
      await notificationService.testNotification();
      alert('Notifikasi test akan muncul dalam 2 detik!');
    } catch (error) {
      alert('Gagal mengirim notifikasi test');
      console.error(error);
    }
  };

  const checkScheduledNotifications = async () => {
    const notifications = await notificationService.getScheduledNotifications();
    setScheduledCount(notifications.length);
  };

  const getPrayerIcon = (name: string): any => {
    const icons: { [key: string]: any } = {
      'Fajr': 'nightlight',
      'Dhuhr': 'wb-sunny',
      'Asr': 'wb-twilight',
      'Maghrib': 'nights-stay',
      'Isha': 'dark-mode',
    };
    return icons[name] || 'schedule';
  };

  if (loading) {
    return (
      <View className="flex-1 bg-white dark:bg-gray-900 items-center justify-center">
        <ActivityIndicator size="large" color="#059669" />
        <Text className="text-gray-600 dark:text-gray-400 mt-4">{t('common.loading')}</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 bg-white dark:bg-gray-900">
        <View className="px-4 pt-16 pb-4 bg-green-600 dark:bg-green-700">
          <View className="flex-row items-center mb-4">
            <TouchableOpacity onPress={() => router.back()} className="mr-3">
              <IconSymbol size={24} name="arrow-back" color="#FFFFFF" />
            </TouchableOpacity>
            <Text className="text-2xl font-bold text-white flex-1">
              {t('shalat.title')}
            </Text>
          </View>
        </View>
        
        <View className="flex-1 items-center justify-center px-6">
          <IconSymbol size={64} name="error" color="#DC2626" />
          <Text className="text-red-600 dark:text-red-400 text-center mt-4 text-lg font-bold">
            {error}
          </Text>
          <TouchableOpacity
            onPress={loadPrayerTimes}
            className="mt-6 bg-green-600 px-6 py-3 rounded-xl"
          >
            <Text className="text-white font-semibold">{t('shalat.retry')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white dark:bg-gray-900">
      <View className="px-4 pt-16 pb-4 bg-green-600 dark:bg-green-700">
        <View className="flex-row items-center mb-4">
          <TouchableOpacity onPress={() => router.back()} className="mr-3">
            <IconSymbol size={24} name="arrow-back" color="#FFFFFF" />
          </TouchableOpacity>
          <Text className="text-2xl font-bold text-white flex-1">
            {t('shalat.title')}
          </Text>
        </View>
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <Text className="text-green-50 text-sm mb-1">
              {prayerTimes?.hijriDate}
            </Text>
            {location && (
              <View className="flex-row items-center">
                <IconSymbol size={14} name="location-on" color="#d1fae5" />
                <Text className="text-green-100 text-xs ml-1">
                  {locationName || `${location.lat.toFixed(2)}°, ${location.lng.toFixed(2)}°`}
                </Text>
              </View>
            )}
          </View>
          {location && (
            <TouchableOpacity
              onPress={onRefresh}
              className="bg-white/20 rounded-full p-2"
              disabled={refreshing}
            >
              <IconSymbol size={20} name="refresh" color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#059669']} />
        }
      >
        {nextPrayer && (
          <View className="bg-green-600 dark:bg-green-700 rounded-3xl p-6 mb-6 shadow-lg">
            <Text className="text-green-50 text-sm mb-2">{t('shalat.nextPrayer')}</Text>
            <View className="flex-row items-center justify-between">
              <View className="flex-1">
                <Text className="text-white text-3xl font-bold mb-1">
                  {t(`shalat.${nextPrayer.name.toLowerCase()}`)}
                </Text>
                <Text className="text-white text-xl font-semibold">
                  {nextPrayer.time}
                </Text>
              </View>
              <View className="bg-white/20 rounded-2xl px-4 py-3">
                <Text className="text-white text-lg font-bold">{nextPrayer.timeUntil}</Text>
              </View>
            </View>
          </View>
        )}

        <View className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 mb-6">
          <View className="p-4 border-b border-gray-100 dark:border-gray-700">
            <Text className="text-lg font-bold text-gray-900 dark:text-white">
              {t('shalat.todaySchedule')}
            </Text>
          </View>
          
          {prayerTimes && prayerTimesService.getPrayerList(prayerTimes).map((prayer, index) => (
            <View
              key={prayer.name}
              className={`flex-row items-center p-4 ${
                index !== 4 ? 'border-b border-gray-100 dark:border-gray-700' : ''
              } ${nextPrayer?.name === prayer.name ? 'bg-green-50 dark:bg-green-950' : ''}`}
            >
              <View className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-xl items-center justify-center mr-4">
                <IconSymbol size={24} name={getPrayerIcon(prayer.name)} color="#059669" />
              </View>
              <View className="flex-1">
                <Text className="text-lg font-bold text-gray-900 dark:text-white">
                  {t(`shalat.${prayer.name.toLowerCase()}`)}
                </Text>
                <Text className="text-sm text-gray-500 dark:text-gray-400">{prayer.arabic}</Text>
              </View>
              <Text className="text-xl font-bold text-gray-900 dark:text-white">
                {prayer.time}
              </Text>
            </View>
          ))}
        </View>

        {location && (
          <View className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 mb-6">
            <View className="p-4 border-b border-gray-100 dark:border-gray-700">
              <Text className="text-lg font-bold text-gray-900 dark:text-white">
                {t('shalat.location')}
              </Text>
            </View>
            <View className="p-4">
              {locationName && (
                <View className="flex-row items-center mb-3">
                  <View className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-full items-center justify-center mr-3">
                    <IconSymbol size={20} name="location-city" color="#2563eb" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                      {t('shalat.city')}
                    </Text>
                    <Text className="text-base font-semibold text-gray-900 dark:text-white">
                      {locationName}
                    </Text>
                  </View>
                </View>
              )}
              <View className="flex-row items-center">
                <View className="w-10 h-10 bg-green-100 dark:bg-green-900 rounded-full items-center justify-center mr-3">
                  <IconSymbol size={20} name="my-location" color="#059669" />
                </View>
                <View className="flex-1">
                  <Text className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                    {t('shalat.coordinates')}
                  </Text>
                  <Text className="text-sm font-mono text-gray-900 dark:text-white">
                    {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

        <View className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 mb-6">
          <View className="p-4 border-b border-gray-100 dark:border-gray-700">
            <Text className="text-lg font-bold text-gray-900 dark:text-white">
              {t('shalat.settings')}
            </Text>
          </View>

          <View className="flex-row items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700">
            <View className="flex-1 mr-4">
              <Text className="text-base font-semibold text-gray-900 dark:text-white mb-1">
                {t('shalat.notification')}
              </Text>
              <Text className="text-sm text-gray-500 dark:text-gray-400">
                {t('shalat.notificationDesc')}
              </Text>
              {notificationEnabled && scheduledCount > 0 && (
                <Text className="text-xs text-green-600 dark:text-green-400 mt-1">
                  ✓ {scheduledCount} notifikasi terjadwal
                </Text>
              )}
            </View>
            <Switch
              value={notificationEnabled}
              onValueChange={toggleNotification}
              trackColor={{ false: '#d1d5db', true: '#86efac' }}
              thumbColor={notificationEnabled ? '#16a34a' : '#f3f4f6'}
            />
          </View>

          <View className="flex-row items-center justify-between p-4">
            <View className="flex-1 mr-4">
              <Text className="text-base font-semibold text-gray-900 dark:text-white mb-1">
                {t('shalat.adhan')}
              </Text>
              <Text className="text-sm text-gray-500 dark:text-gray-400">
                {t('shalat.adhanDesc')}
              </Text>
            </View>
            <Switch
              value={adhanEnabled}
              onValueChange={toggleAdhan}
              trackColor={{ false: '#d1d5db', true: '#86efac' }}
              thumbColor={adhanEnabled ? '#16a34a' : '#f3f4f6'}
            />
          </View>
        </View>

        {adhanEnabled && (
          <TouchableOpacity
            onPress={testAdhan}
            className="bg-green-100 dark:bg-green-900 rounded-2xl p-4 flex-row items-center justify-center mb-3"
          >
            <IconSymbol size={24} name="volume-up" color="#059669" />
            <Text className="text-green-700 dark:text-green-300 font-semibold ml-2">
              {t('shalat.testAdhan')}
            </Text>
          </TouchableOpacity>
        )}

        {notificationEnabled && (
          <TouchableOpacity
            onPress={testNotification}
            className="bg-blue-100 dark:bg-blue-900 rounded-2xl p-4 flex-row items-center justify-center"
          >
            <IconSymbol size={24} name="notifications" color="#2563eb" />
            <Text className="text-blue-700 dark:text-blue-300 font-semibold ml-2">
              {t('shalat.testNotification')}
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}