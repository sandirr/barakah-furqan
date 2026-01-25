import { IconSymbol } from '@/components/ui/icon-symbol';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Geolocation from '@react-native-community/geolocation';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  PermissionsAndroid,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  useColorScheme,
  View
} from 'react-native';
import CompassHeading from 'react-native-compass-heading';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');
const COMPASS_SIZE = width * 0.7;
const LOCATION_CACHE_KEY = '@barakah_furqan_last_location';

export default function KiblatScreen() {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const [heading, setHeading] = useState(0);
  const [qiblaDirection, setQiblaDirection] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [calibrating, setCalibrating] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isUsingCache, setIsUsingCache] = useState(false);
  const [updatingLocation, setUpdatingLocation] = useState(false);
  
  const compassRotation = useRef(new Animated.Value(0)).current;
  const headingStableCount = useRef(0);
  const lastHeading = useRef(0);
  const calibrationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const compassStarted = useRef(false); // Track compass state

  useEffect(() => {
    initializeScreen();
    return () => {
      console.log('🛑 Stopping compass...');
      CompassHeading.stop();
      compassStarted.current = false;
      if (calibrationTimer.current) {
        clearTimeout(calibrationTimer.current);
      }
    };
  }, []);

  // Animate compass rotation smoothly
  useEffect(() => {
    Animated.spring(compassRotation, {
      toValue: -heading,
      useNativeDriver: true,
      tension: 10,
      friction: 8,
    }).start();
  }, [heading]);

  const requestLocationPermission = async (): Promise<boolean> => {
    if (Platform.OS === 'ios') {
      return true;
    }

    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (err) {
      console.error('Permission error:', err);
      return false;
    }
  };

  const getCurrentLocation = (): Promise<{ lat: number; lng: number }> => {
    return new Promise((resolve, reject) => {
      Geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          reject(error);
        },
        {
          enableHighAccuracy: true,
          timeout: 20000,
          maximumAge: 10000,
        }
      );
    });
  };

  const initializeScreen = async () => {
    try {
      console.log('🚀 Initializing screen...');
      
      // Step 1: Load cache immediately
      const cachedLocation = await getCachedLocation();
      
      if (cachedLocation) {
        console.log('✓ Using cached location:', cachedLocation);
        setLocation(cachedLocation);
        const qibla = calculateQiblaDirection(cachedLocation.lat, cachedLocation.lng);
        setQiblaDirection(qibla);
        setIsUsingCache(true);
        
        // Start compass immediately with cached data
        await startCompass();
      } else {
        console.log('⚠️ No cached location found');
        setLoading(true);
      }

      // Step 2: Update location in background
      await updateLocationInBackground();

    } catch (err) {
      console.error('❌ Initialize error:', err);
      setError(t('kiblat.locationError'));
      setLoading(false);
    }
  };

  const updateLocationInBackground = async () => {
    try {
      setUpdatingLocation(true);

      // Request permission
      const hasPermission = await requestLocationPermission();
      
      if (!hasPermission) {
        console.log('⛔ Location permission denied');
        setUpdatingLocation(false);
        
        if (!location) {
          setError(t('kiblat.permissionDenied'));
          setLoading(false);
        }
        return;
      }

      // Get current location
      const userLocation = await getCurrentLocation();
      console.log('📍 Current location:', userLocation);
      
      // Check if location changed significantly (more than ~100m)
      const locationChanged = !location || 
        Math.abs(userLocation.lat - location.lat) > 0.001 ||
        Math.abs(userLocation.lng - location.lng) > 0.001;

      if (locationChanged) {
        console.log('✓ Location updated');
        setLocation(userLocation);
        await cacheLocation(userLocation);

        const qibla = calculateQiblaDirection(userLocation.lat, userLocation.lng);
        console.log('🧭 Qibla direction:', qibla);
        setQiblaDirection(qibla);
        setIsUsingCache(false);
      } else {
        console.log('✓ Location unchanged, keeping cache');
      }

      // Start compass if not started yet
      if (loading || !compassStarted.current) {
        await startCompass();
        setLoading(false);
      }

    } catch (err) {
      console.error('❌ Background location update error:', err);
      
      if (!location) {
        setError(t('kiblat.locationError'));
        setLoading(false);
      }
    } finally {
      setUpdatingLocation(false);
    }
  };

  const getCachedLocation = async (): Promise<{ lat: number; lng: number } | null> => {
    try {
      const cached = await AsyncStorage.getItem(LOCATION_CACHE_KEY);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  };

  const cacheLocation = async (location: { lat: number; lng: number }): Promise<void> => {
    try {
      await AsyncStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify(location));
    } catch (error) {
      console.error('Cache save error:', error);
    }
  };

  const calculateQiblaDirection = (lat: number, lng: number): number => {
    const kaabaLat = 21.4225;
    const kaabaLng = 39.8262;

    const PI = Math.PI;
    const latk = (kaabaLat * PI) / 180.0;
    const longk = (kaabaLng * PI) / 180.0;
    const phi = (lat * PI) / 180.0;
    const lambda = (lng * PI) / 180.0;

    let qiblad = (180.0 / PI) * Math.atan2(
      Math.sin(longk - lambda),
      Math.cos(phi) * Math.tan(latk) - Math.sin(phi) * Math.cos(longk - lambda)
    );

    qiblad = (qiblad + 360) % 360;
    return qiblad;
  };

  const startCompass = async () => {
    return new Promise<void>((resolve, reject) => {
      console.log('🧭 Starting compass...');
      
      // Stop compass first if already running
      if (compassStarted.current) {
        console.log('⚠️ Compass already running, stopping first...');
        CompassHeading.stop();
        compassStarted.current = false;
      }

      const degree_update_rate = 3;

      try {
        CompassHeading.start(degree_update_rate, (data: any) => {
          console.log('📡 Compass data received:', data);
          
          if (!data || typeof data !== 'object') {
            console.error('❌ Invalid compass data:', data);
            return;
          }

          const { heading: compassHeading, accuracy } = data;
          
          if (typeof compassHeading !== 'number') {
            console.error('❌ Invalid heading value:', compassHeading);
            return;
          }

          console.log(`🧭 Heading: ${compassHeading.toFixed(2)}°, Accuracy: ${accuracy}`);

          const headingDiff = Math.abs(compassHeading - lastHeading.current);
          
          if (headingDiff < 5) {
            headingStableCount.current += 1;
          } else {
            headingStableCount.current = 0;
          }

          if (headingStableCount.current >= 5 && calibrating) {
            console.log('✓ Compass calibrated');
            setCalibrating(false);
          }

          lastHeading.current = compassHeading;
          setHeading(compassHeading);
        });

        compassStarted.current = true;
        console.log('✓ Compass started successfully');

        calibrationTimer.current = setTimeout(() => {
          console.log('⏱️ Calibration timeout');
          setCalibrating(false);
          resolve();
        }, 3000);

      } catch (err) {
        console.error('❌ Compass start error:', err);
        compassStarted.current = false;
        Alert.alert(
          'Compass Error',
          'Failed to start compass. Please check if your device has a compass sensor.',
          [{ text: 'OK' }]
        );
        reject(err);
      }
    });
  };

  const getDistanceToQibla = (): string => {
    if (!location) return '0';
    
    const kaabaLat = 21.4225;
    const kaabaLng = 39.8262;
    
    const R = 6371;
    const dLat = ((kaabaLat - location.lat) * Math.PI) / 180;
    const dLng = ((kaabaLng - location.lng) * Math.PI) / 180;
    
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((location.lat * Math.PI) / 180) *
        Math.cos((kaabaLat * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    return distance.toFixed(0);
  };

  const refreshLocation = async () => {
    console.log('🔄 Refreshing location...');
    setIsUsingCache(false);
    setUpdatingLocation(true);
    
    // Stop and restart compass
    if (compassStarted.current) {
      CompassHeading.stop();
      compassStarted.current = false;
    }
    
    await updateLocationInBackground();
  };

  if (loading && !location) {
    return (
      <View className="flex-1 bg-white dark:bg-gray-900 items-center justify-center">
        <ActivityIndicator size="large" color="#14B8A6" />
        <Text className="text-gray-600 dark:text-gray-400 mt-4">{t('common.loading')}</Text>
      </View>
    );
  }

  if (error && !location) {
    return (
      <SafeAreaView className="flex-1 bg-teal-600 dark:bg-teal-700">
        <View className="p-4 bg-teal-600 dark:bg-teal-700">
          <View className="flex-row items-center mb-4">
            <TouchableOpacity onPress={() => router.back()} className="mr-3">
              <IconSymbol size={24} name="arrow-back" color="#FFFFFF" />
            </TouchableOpacity>
            <Text className="text-2xl font-bold text-white flex-1">
              {t('kiblat.title')}
            </Text>
          </View>
          <Text className="text-teal-50 text-sm mb-4">
            {t('kiblat.description')}
          </Text>
        </View>
        
        <View className="flex-1 items-center justify-center px-6 bg-white dark:bg-gray-900">
          <IconSymbol size={64} name="error" color="#DC2626" />
          <Text className="text-red-600 dark:text-red-400 text-center mt-4 text-lg font-bold">{error}</Text>
          <Text className="text-gray-500 dark:text-gray-400 text-center mt-2">
            {t('kiblat.errorDescription')}
          </Text>
          <TouchableOpacity
            onPress={initializeScreen}
            className="mt-6 bg-teal-600 py-3 px-8 rounded-xl"
          >
            <Text className="text-white font-semibold">{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-teal-600 dark:bg-teal-700">
      <View className="p-4 bg-teal-600 dark:bg-teal-700">
        <View className="flex-row items-center mb-4">
          <TouchableOpacity onPress={() => router.back()} className="mr-3">
            <IconSymbol size={24} name="arrow-back" color="#FFFFFF" />
          </TouchableOpacity>
          <Text className="text-2xl font-bold text-white flex-1">
            {t('kiblat.title')}
          </Text>
          <TouchableOpacity
            onPress={refreshLocation}
            className="bg-white/20 rounded-full p-2"
            disabled={updatingLocation}
          >
            {updatingLocation ? (
              <ActivityIndicator size={21} color="#FFFFFF" />
            ) : (
              <IconSymbol size={20} name="refresh" color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </View>
        <Text className="text-teal-50 text-sm">
          {t('kiblat.description')}
        </Text>
      </View>

      <ScrollView 
        className="flex-1 bg-white dark:bg-gray-900"
        contentContainerStyle={{ padding: 16, alignItems: 'center' }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={updatingLocation} onRefresh={refreshLocation} colors={['#14B8A6']} />
        }
      >
        {/* Debug info - Remove in production */}
        <View className="w-full mb-4 bg-gray-100 dark:bg-gray-800 rounded-lg p-3">
          <Text className="text-xs text-gray-600 dark:text-gray-400 font-mono">
            Heading: {heading.toFixed(2)}° | Qibla: {qiblaDirection?.toFixed(2)}° | Compass: {compassStarted.current ? '✓' : '✗'}
          </Text>
        </View>

        <View className="w-full mb-6">
          <View className="flex-row gap-3">
            <View className="flex-1 bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
              <View className="flex-row items-center mb-2">
                <View className="w-10 h-10 bg-teal-100 dark:bg-teal-900 rounded-full items-center justify-center mr-3">
                  <IconSymbol size={20} name="navigation" color="#0d9488" />
                </View>
                <View className="flex-1">
                  <Text className="text-2xl font-bold text-gray-900 dark:text-white">
                    {qiblaDirection ? Math.round(qiblaDirection) : 0}°
                  </Text>
                  <Text className="text-xs text-gray-500 dark:text-gray-400">
                    {t('kiblat.fromNorth')}
                  </Text>
                </View>
              </View>
            </View>

            <View className="flex-1 bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
              <View className="flex-row items-center mb-2">
                <View className="w-10 h-10 bg-teal-100 dark:bg-teal-900 rounded-full items-center justify-center mr-3">
                  <IconSymbol size={20} name="place" color="#0d9488" />
                </View>
                <View className="flex-1">
                  <Text className="text-2xl font-bold text-gray-900 dark:text-white">
                    {getDistanceToQibla()}
                  </Text>
                  <Text className="text-xs text-gray-500 dark:text-gray-400">
                    {t('kiblat.distanceKm')}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Compass Container */}
        <View className="relative items-center justify-center mb-6" style={{ width: COMPASS_SIZE, height: COMPASS_SIZE }}>
          <View className="absolute w-full h-full bg-white dark:bg-gray-800 rounded-full shadow-lg border-4 border-gray-100 dark:border-gray-700" />
          
          <Animated.View
            style={{
              width: COMPASS_SIZE - 20,
              height: COMPASS_SIZE - 20,
              transform: [{ 
                rotate: compassRotation.interpolate({
                  inputRange: [-360, 0],
                  outputRange: ['-360deg', '0deg'],
                })
              }],
            }}
            className="absolute items-center justify-center"
          >
            <View className="w-full h-full relative">
              <View className="absolute top-2 left-1/2 -ml-4">
                <View className="bg-red-600 rounded-full justify-center items-center h-8 w-8">
                  <Text className="text-white font-bold text-xs">N</Text>
                </View>
              </View>

              <View className="absolute bottom-2 left-1/2 -ml-4">
                <View className="bg-gray-400 dark:bg-gray-600 rounded-full justify-center items-center h-8 w-8">
                  <Text className="text-white font-bold text-xs">S</Text>
                </View>
              </View>

              <View className="absolute top-1/2 -mt-4 left-2">
                <View className="bg-gray-400 dark:bg-gray-600 rounded-full justify-center items-center h-8 w-8">
                  <Text className="text-white font-bold text-xs">W</Text>
                </View>
              </View>

              <View className="absolute top-1/2 -mt-4 right-2">
                <View className="bg-gray-400 dark:bg-gray-600 rounded-full justify-center items-center h-8 w-8">
                  <Text className="text-white font-bold text-xs">E</Text>
                </View>
              </View>

              {[...Array(36)].map((_, i) => {
                const angle = i * 10;
                const isMainDirection = angle % 90 === 0;
                const radius = (COMPASS_SIZE - 20) / 2 - 45;
                const x = Math.sin((angle * Math.PI) / 180) * radius;
                const y = -Math.cos((angle * Math.PI) / 180) * radius;
                
                if (isMainDirection) return null;
                
                return (
                  <View
                    key={i}
                    style={{
                      position: 'absolute',
                      left: '50%',
                      top: '50%',
                      marginLeft: x - 2,
                      marginTop: y - 2,
                    }}
                  >
                    <View className="w-1 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" />
                  </View>
                );
              })}
            </View>
          </Animated.View>

          {qiblaDirection !== null && (
            <View
              style={{
                position: 'absolute',
                transform: [
                  { rotate: `${qiblaDirection - heading}deg` }
                ],
              }}
            >
              <View className="items-center" style={{ width: 50, marginTop: -(COMPASS_SIZE - 20) / 2 + 40 }}>
                <View className="w-12 h-12 bg-teal-600 dark:bg-teal-700 rounded-full items-center justify-center shadow-lg">
                  <IconSymbol size={24} name="mosque" color="#FFFFFF" />
                </View>
                <View className="w-1 h-12 bg-teal-600 dark:bg-teal-700 mt-1" />
                <View 
                  style={{
                    width: 0,
                    height: 0,
                    backgroundColor: 'transparent',
                    borderStyle: 'solid',
                    borderLeftWidth: 8,
                    borderRightWidth: 8,
                    borderTopWidth: 12,
                    borderLeftColor: 'transparent',
                    borderRightColor: 'transparent',
                    borderTopColor: '#0d9488',
                  }}
                />
              </View>
            </View>
          )}

          <View className="absolute bg-white dark:bg-gray-700 w-3 h-3 rounded-full border-2 border-teal-600" />
        </View>

        {location && (
          <View className="w-full mb-6 bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
            <View className="flex-row items-center mb-2">
              <View className="w-10 h-10 bg-teal-100 dark:bg-teal-900 rounded-full items-center justify-center mr-3">
                <IconSymbol size={20} name="my-location" color="#0d9488" />
              </View>
              <View className="flex-1">
                <Text className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                  {t('shalat.location')}
                </Text>
                <Text className="text-sm font-mono text-gray-900 dark:text-white">
                  {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                </Text>
              </View>
            </View>
          </View>
        )}

        <View className="w-full">
          <LinearGradient
            colors={colorScheme === 'dark' ? ['#1f2937', '#374151'] : ['#d1fae5', '#ccfbf1']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ borderRadius: 16, padding: 24 }}
          >
            <View className="flex-row items-center mb-3">
              <IconSymbol size={24} name="info" color="#059669" />
              <Text className="text-lg font-semibold text-gray-900 dark:text-white ml-2">
                {t('kiblat.howToUse')}
              </Text>
            </View>
            <Text className="text-gray-700 dark:text-gray-300 leading-6">
              {t('kiblat.instruction')}
            </Text>
          </LinearGradient>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}