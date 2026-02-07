import { notificationService } from '@/services/notification.service';
import { PrayerTimes, prayerTimesService } from '@/services/prayer-times.service';
import NetInfo from '@react-native-community/netinfo';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import {
  ArrowLeft,
  Bell,
  Building2,
  CircleCheck,
  Clock,
  LocateFixed,
  MapPin,
  Moon,
  RefreshCw,
  Sun,
  SunDim,
  Sunrise,
  Sunset,
  TriangleAlert,
  Volume2,
  X,
  type LucideIcon
} from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Linking,
  RefreshControl,
  ScrollView,
  Switch,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ShalatScreen() {
  const { t } = useTranslation();
  const [prayerTimes, setPrayerTimes] = useState<PrayerTimes | null>(null);
  const [nextPrayer, setNextPrayer] = useState<{ name: string; time: string; timeUntil: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notificationEnabled, setNotificationEnabled] = useState(true);
  const [adhanEnabled, setAdhanEnabled] = useState(true);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationName, setLocationName] = useState<string>('');
  const [scheduledCount, setScheduledCount] = useState(0);
  const [isUsingCache, setIsUsingCache] = useState(false);
  
  const [hasLocationPermission, setHasLocationPermission] = useState(false);
  const [hasInternet, setHasInternet] = useState(false);
  const [checkingRequirements, setCheckingRequirements] = useState(true);

  useEffect(() => {
    initializeScreen();

    const interval = setInterval(() => {
      if (prayerTimes) {
        updateNextPrayer(prayerTimes);
      }
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data as { identifier?: string };
      if (data?.identifier) {
        notificationService.playAdhan();
      }
    });

    const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as { identifier?: string };
      if (data?.identifier) {
        notificationService.playAdhan();
      }
    });

    return () => {
      receivedSubscription.remove();
      responseSubscription.remove();
    };
  }, []);

  useEffect(() => {
    if (notificationEnabled && prayerTimes) {
      checkScheduledNotifications();
    }
  }, [notificationEnabled, prayerTimes]);

  const initializeScreen = async () => {
    await loadCacheFirst();
    await checkRequirements();
  };

  const loadCacheFirst = async () => {
    try {
      const cached = await prayerTimesService.getCachedPrayerTimes();
      if (cached) {
        setPrayerTimes(cached);
        await updateNextPrayer(cached);
        setIsUsingCache(true);
      }
    } catch (err) {
      console.error('Cache load error:', err);
    }
  };

  const checkRequirements = async () => {
    setCheckingRequirements(true);
    
    const netInfo = await NetInfo.fetch();
    const internetAvailable = netInfo.isConnected && netInfo.isInternetReachable !== false;
    setHasInternet(internetAvailable as boolean);

    const { status } = await Location.getForegroundPermissionsAsync();
    const locationGranted = status === 'granted';
    setHasLocationPermission(locationGranted);

    setCheckingRequirements(false);

    if (locationGranted && internetAvailable) {
      await loadSettings();
      await requestNotificationPermission();
      await loadPrayerTimes();
    } else {
      setLoading(false);
    }
  };

  const requestNotificationPermission = async () => {
    try {
      await notificationService.requestPermissions();
    } catch (err) {
      console.error('Notification permission error:', err);
    }
  };

  const loadSettings = async () => {
    try {
      const notifEnabled = await notificationService.isNotificationEnabled();
      const azanEnabled = await notificationService.isAdhanEnabled();
      setNotificationEnabled(notifEnabled);
      setAdhanEnabled(azanEnabled);
    } catch (err) {
      console.error('Load settings error:', err);
    }
  };

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      const granted = status === 'granted';
      setHasLocationPermission(granted);
      
      if (granted) {
        await checkRequirements();
      } else {
        Alert.alert(
          t('shalat.locationPermissionRequired'),
          t('shalat.locationPermissionRequiredDesc'),
          [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('shalat.openSettings'), onPress: () => Linking.openSettings() }
          ]
        );
      }
    } catch (err) {
      console.error('Location permission error:', err);
    }
  };

  const loadPrayerTimes = async () => {
    try {
      setError(null);
      setLoading(true);

      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        throw new Error(t('shalat.noInternet'));
      }

      const locationResult = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 5000,
      });

      const userLocation = {
        lat: locationResult.coords.latitude,
        lng: locationResult.coords.longitude,
      };
      setLocation(userLocation);

      const times = await prayerTimesService.getPrayerTimes(
        userLocation.lat,
        userLocation.lng
      );
      
      setPrayerTimes(times);
      await updateNextPrayer(times);
      setIsUsingCache(false);

      tryReverseGeocode(userLocation).catch(() => {});

      if (notificationEnabled) {
        await notificationService.scheduleAllPrayerNotifications(times);
        await checkScheduledNotifications();
      }

    } catch (err: any) {
      console.error('Load error:', err);
      setError(err.message || t('shalat.loadError'));
      
      if (!isUsingCache) {
        const cached = await prayerTimesService.getCachedPrayerTimes();
        if (cached) {
          setPrayerTimes(cached);
          await updateNextPrayer(cached);
          setIsUsingCache(true);
          Alert.alert(
            t('shalat.usingCache'),
            t('shalat.usingCacheDesc')
          );
        }
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const tryReverseGeocode = async (userLocation: { lat: number; lng: number }) => {
    try {
      const geocode = await Location.reverseGeocodeAsync({
        latitude: userLocation.lat,
        longitude: userLocation.lng,
      });

      if (geocode && geocode.length > 0) {
        const address = geocode[0];
        const cityName = address.city || address.subregion || address.region || '';
        if (cityName) {
          setLocationName(cityName);
        }
      }
    } catch (err) {
      console.error('Geocoding error:', err);
    }
  };

  const updateNextPrayer = async (times: PrayerTimes) => {
    try {
      const next = await prayerTimesService.getNextPrayer(times);
      setNextPrayer(next);
    } catch (err) {
      console.error('Update next prayer error:', err);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    setError(null);
    
    try {
      const locationResult = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 5000,
      });

      const userLocation = {
        lat: locationResult.coords.latitude,
        lng: locationResult.coords.longitude,
      };
      setLocation(userLocation);

      const times = await prayerTimesService.getPrayerTimes(
        userLocation.lat,
        userLocation.lng,
        true
      );
      
      setPrayerTimes(times);
      await updateNextPrayer(times);
      setIsUsingCache(false);

      if (notificationEnabled) {
        await notificationService.scheduleAllPrayerNotifications(times);
        await checkScheduledNotifications();
      }

    } catch (err: any) {
      console.error('Refresh error:', err);
      setError(err.message || t('shalat.loadError'));
    } finally {
      setRefreshing(false);
    }
  };

  const toggleNotification = async (value: boolean) => {
    try {
      setNotificationEnabled(value);
      await notificationService.setNotificationEnabled(value);
      
      if (value && prayerTimes) {
        await notificationService.scheduleAllPrayerNotifications(prayerTimes);
        await checkScheduledNotifications();
      } else {
        await notificationService.cancelAllNotifications();
        setScheduledCount(0);
      }
    } catch (err) {
      console.error('Toggle notification error:', err);
    }
  };

  const toggleAdhan = async (value: boolean) => {
    try {
      setAdhanEnabled(value);
      await notificationService.setAdhanEnabled(value);
    } catch (err) {
      console.error('Toggle adhan error:', err);
    }
  };

  const testAdhan = async () => {
    try {
      await notificationService.playAdhan();
    } catch (err) {
      Alert.alert(t('common.error'), t('shalat.adhanError'));
    }
  };

  const testNotification = async () => {
    try {
      await notificationService.testNotification();
      Alert.alert(t('shalat.testNotification'), t('shalat.testNotificationDesc'));
    } catch (error) {
      Alert.alert(t('common.error'), t('shalat.notificationError'));
    }
  };

  const checkScheduledNotifications = async () => {
    try {
      const notifications = await notificationService.getScheduledNotifications();
      setScheduledCount(notifications.length);
    } catch (err) {
      console.error('Check notifications error:', err);
    }
  };

  const getPrayerIcon = (name: string): LucideIcon => {
    const icons: Record<string, LucideIcon> = {
      Fajr: Sunrise,
      Dhuhr: Sun,
      Asr: SunDim,
      Maghrib: Sunset,
      Isha: Moon,
    };

    return icons[name] || Clock;
  };

  if (checkingRequirements) {
    return (
      <SafeAreaView className="flex-1 bg-white dark:bg-gray-900">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#059669" />
          <Text className="text-gray-600 dark:text-gray-400 mt-4">
            {t('shalat.checking')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }
  
  if (loading && !prayerTimes) {
    return (
      <SafeAreaView className="flex-1 bg-white dark:bg-gray-900">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#059669" />
          <Text className="text-gray-600 dark:text-gray-400 mt-4">{t('common.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!hasLocationPermission || !hasInternet) {
    return (
      <SafeAreaView className="flex-1 bg-green-600 dark:bg-green-700">
        <View className="p-4 bg-green-600 dark:bg-green-700">
          <View className="flex-row items-center">
            <TouchableOpacity onPress={() => router.back()} className="mr-3">
              <ArrowLeft size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text className="text-2xl font-bold text-white flex-1">
              {t('shalat.title')}
            </Text>
          </View>
        </View>
        
        <View className="flex-1 items-center justify-center px-6 bg-white dark:bg-gray-900">
          <TriangleAlert size={64} color="#f59e0b" />
          <Text className="text-gray-900 dark:text-white text-center mt-4 text-xl font-bold">
            {t('shalat.requirementsNotMet')}
          </Text>
          
          <View className="w-full mt-4 gap-y-4">
            <View className={`p-4 rounded-xl mb-4 ${hasLocationPermission ? 'bg-green-50 dark:bg-green-950' : 'bg-red-50 dark:bg-red-950'}`}>
              <View className="flex-row items-center mb-2">
                {hasLocationPermission ? (
                  <CircleCheck size={24} color="#16a34a" />
                ) : (
                  <X size={24} color="#dc2626" />
                )}
                <Text className={`ml-2 font-semibold ${hasLocationPermission ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                  {t('shalat.locationPermission')}
                </Text>
              </View>
              <Text className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                {t('shalat.locationPermissionDesc')}
              </Text>
              {!hasLocationPermission && (
                <TouchableOpacity
                  onPress={requestLocationPermission}
                  className="bg-red-600 py-2 px-4 rounded-lg"
                >
                  <Text className="text-white font-semibold text-center">
                    {t('shalat.enableLocation')}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            <View className={`p-4 rounded-xl ${hasInternet ? 'bg-green-50 dark:bg-green-950' : 'bg-red-50 dark:bg-red-950'}`}>
              <View className="flex-row items-center mb-2">
                {hasInternet ? (
                  <CircleCheck size={24} color="#16a34a" />
                ) : (
                  <X size={24} color="#dc2626" />
                )}
                <Text className={`ml-2 font-semibold ${hasInternet ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                  {t('shalat.internetConnection')}
                </Text>
              </View>
              <Text className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                {t('shalat.internetConnectionDesc')}
              </Text>
              {!hasInternet && (
                <TouchableOpacity
                  onPress={() => Linking.openSettings()}
                  className="bg-red-600 py-2 px-4 rounded-lg"
                >
                  <Text className="text-white font-semibold text-center">
                    {t('shalat.openSettings')}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          <TouchableOpacity
            onPress={checkRequirements}
            className="mt-8 bg-green-600 py-3 px-8 rounded-xl"
          >
            <Text className="text-white font-semibold text-center">
              {t('shalat.checkAgain')}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-green-600 dark:bg-green-700">
      <View className="p-4 bg-green-600 dark:bg-green-700">
        <View className="flex-row items-center mb-2">
          <TouchableOpacity onPress={() => router.back()} className="mr-3">
            <ArrowLeft size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text className="text-2xl font-bold text-white flex-1">
            {t('shalat.title')}
          </Text>
          <TouchableOpacity
            onPress={onRefresh}
            className="bg-white/20 rounded-full p-2"
            disabled={refreshing}
          >
            {refreshing ? (
              <ActivityIndicator size={21} color="#FFFFFF" />
            ) : (
              <RefreshCw size={20} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </View>
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <Text className="text-green-50 text-sm mb-1">
              {prayerTimes?.hijriDate}
            </Text>
            {location && (
              <View className="flex-row items-center">
                <MapPin size={14} color="#d1fae5" />
                <Text className="text-green-100 text-xs ml-1">
                  {locationName || `${location.lat.toFixed(4)}°, ${location.lng.toFixed(4)}°`}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>

      <ScrollView
        className="flex-1 bg-white dark:bg-gray-900"
        contentContainerStyle={{ padding: 16 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#059669']} />
        }
      >
        {error && !isUsingCache && (
          <View className="bg-red-50 dark:bg-red-950 rounded-xl p-4 mb-4">
            <Text className="text-red-700 dark:text-red-300 text-sm">
              ⚠️ {error}
            </Text>
          </View>
        )}

        {nextPrayer && (
          <View className="bg-green-600 dark:bg-green-700 rounded-3xl p-6 mb-4 shadow-lg">
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

        <View className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 mb-4">
          <View className="p-4 border-b border-gray-100 dark:border-gray-700">
            <Text className="text-lg font-bold text-gray-900 dark:text-white">
              {t('shalat.todaySchedule')}
            </Text>
          </View>
          
          {prayerTimes && prayerTimesService.getPrayerList(prayerTimes).map((prayer, index) => {
            const PrayerIcon = getPrayerIcon(prayer.name);

            return (
              <View
                key={prayer.name}
                className={`flex-row items-center p-4 ${
                  index !== 4 ? 'border-b border-gray-100 dark:border-gray-700' : ''
                } ${nextPrayer?.name === prayer.name ? 'bg-green-50 dark:bg-green-950' : ''}`}
              >
                <View className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-xl items-center justify-center mr-4">
                  <PrayerIcon size={24} color="#059669" />
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
            );
          })}
        </View>

        {location && (
          <View className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 mb-4">
            <View className="p-4 border-b border-gray-100 dark:border-gray-700">
              <Text className="text-lg font-bold text-gray-900 dark:text-white">
                {t('shalat.location')}
              </Text>
            </View>
            <View className="p-4">
              {locationName && (
                <View className="flex-row items-center mb-3">
                  <View className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-full items-center justify-center mr-3">
                    <Building2 size={20} color="#2563eb" />
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
                  <LocateFixed size={20} color="#059669" />
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

        <View className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 mb-4">
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
                  ✓ {scheduledCount} {t('shalat.scheduledNotifications')}
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

        {adhanEnabled && __DEV__ && (
          <TouchableOpacity
            onPress={testAdhan}
            className="bg-green-100 dark:bg-green-900 rounded-2xl p-4 flex-row items-center justify-center mb-3"
          >
            <Volume2 size={24} color="#059669" />
            <Text className="text-green-700 dark:text-green-300 font-semibold ml-2">
              {t('shalat.testAdhan')}
            </Text>
          </TouchableOpacity>
        )}

        {notificationEnabled && __DEV__ && (
          <TouchableOpacity
            onPress={testNotification}
            className="bg-blue-100 dark:bg-blue-900 rounded-2xl p-4 flex-row items-center justify-center"
          >
            <Bell size={24} color="#2563eb" />
            <Text className="text-blue-700 dark:text-blue-300 font-semibold ml-2">
              {t('shalat.testNotification')}
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
