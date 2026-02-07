import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import {
  ArrowLeft,
  Building2,
  Info,
  Landmark,
  LocateFixed,
  MapPin,
  Navigation2,
  RefreshCw,
  TriangleAlert,
  X
} from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Linking,
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
  const [locationName, setLocationName] = useState<string>('');
  const [isUsingCache, setIsUsingCache] = useState(false);
  const [updatingLocation, setUpdatingLocation] = useState(false);
  
  const compassRotation = useRef(new Animated.Value(0)).current;
  const headingStableCount = useRef(0);
  const lastHeading = useRef(0);
  const calibrationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const compassStarted = useRef(false);

  const [hasLocationPermission, setHasLocationPermission] = useState(false);
  const [checkingRequirements, setCheckingRequirements] = useState(true);

  useEffect(() => {
    initializeScreen();
    return () => {
      CompassHeading.stop();
      compassStarted.current = false;
      if (calibrationTimer.current) {
        clearTimeout(calibrationTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    Animated.spring(compassRotation, {
      toValue: -heading,
      useNativeDriver: true,
      tension: 10,
      friction: 8,
    }).start();
  }, [heading]);

  const initializeScreen = async () => {
    await loadCacheFirst();
    await checkRequirements();
  };

  const loadCacheFirst = async () => {
    try {
      const cached = await getCachedLocation();
      if (cached) {
        setLocation(cached);
        const qibla = calculateQiblaDirection(cached.lat, cached.lng);
        setQiblaDirection(qibla);
        setIsUsingCache(true);
        tryReverseGeocode(cached).catch(() => {});
      }
    } catch (err) {
      console.error('Cache load error:', err);
    }
  };

  const checkRequirements = async () => {
    setCheckingRequirements(true);
    
    const { status } = await Location.getForegroundPermissionsAsync();
    const locationGranted = status === 'granted';
    setHasLocationPermission(locationGranted);

    setCheckingRequirements(false);

    if (locationGranted) {
      await loadLocationAndCompass();
    } else {
      setLoading(false);
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
          t('kiblat.locationPermissionRequired'),
          t('kiblat.locationPermissionRequiredDesc'),
          [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('kiblat.openSettings'), onPress: () => Linking.openSettings() }
          ]
        );
      }
    } catch (err) {
      console.error('Permission error:', err);
    }
  };

  const loadLocationAndCompass = async () => {
    try {
      setError(null);
      setLoading(true);

      const locationResult = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 5000,
      });

      const userLocation = {
        lat: locationResult.coords.latitude,
        lng: locationResult.coords.longitude,
      };

      const locationChanged = !location || 
        Math.abs(userLocation.lat - location.lat) > 0.001 ||
        Math.abs(userLocation.lng - location.lng) > 0.001;

      if (locationChanged) {
        setLocation(userLocation);
        await cacheLocation(userLocation);
        const qibla = calculateQiblaDirection(userLocation.lat, userLocation.lng);
        setQiblaDirection(qibla);
        setIsUsingCache(false);
        tryReverseGeocode(userLocation).catch(() => {});
      }

      if (!compassStarted.current) {
        await startCompass();
      }

    } catch (err: any) {
      console.error('Load error:', err);
      setError(err.message || t('kiblat.locationError'));
      
      if (!isUsingCache) {
        const cached = await getCachedLocation();
        if (cached) {
          setLocation(cached);
          const qibla = calculateQiblaDirection(cached.lat, cached.lng);
          setQiblaDirection(qibla);
          setIsUsingCache(true);
          tryReverseGeocode(cached).catch(() => {});
          await startCompass();
        }
      }
    } finally {
      setLoading(false);
      setUpdatingLocation(false);
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
      if (compassStarted.current) {
        CompassHeading.stop();
        compassStarted.current = false;
      }

      const degree_update_rate = 3;

      try {
        CompassHeading.start(degree_update_rate, (data: any) => {
          if (!data || typeof data !== 'object') {
            return;
          }

          const { heading: compassHeading, accuracy } = data;
          
          if (typeof compassHeading !== 'number') {
            return;
          }

          const headingDiff = Math.abs(compassHeading - lastHeading.current);
          
          if (headingDiff < 5) {
            headingStableCount.current += 1;
          } else {
            headingStableCount.current = 0;
          }

          if (headingStableCount.current >= 5 && calibrating) {
            setCalibrating(false);
          }

          lastHeading.current = compassHeading;
          setHeading(compassHeading);
        });

        compassStarted.current = true;

        calibrationTimer.current = setTimeout(() => {
          setCalibrating(false);
          resolve();
        }, 3000);

      } catch (err) {
        console.error('Compass start error:', err);
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
    setIsUsingCache(false);
    setUpdatingLocation(true);
    
    if (compassStarted.current) {
      CompassHeading.stop();
      compassStarted.current = false;
    }
    
    await loadLocationAndCompass();
  };

  if (checkingRequirements) {
    return (
      <SafeAreaView className="flex-1 bg-white dark:bg-gray-900">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#14B8A6" />
          <Text className="text-gray-600 dark:text-gray-400 mt-4">
            {t('kiblat.checking')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading && !location) {
    return (
      <SafeAreaView className="flex-1 bg-white dark:bg-gray-900">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#14B8A6" />
          <Text className="text-gray-600 dark:text-gray-400 mt-4">{t('common.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!hasLocationPermission) {
    return (
      <SafeAreaView className="flex-1 bg-teal-600 dark:bg-teal-700">
        <View className="p-4 bg-teal-600 dark:bg-teal-700">
          <View className="flex-row items-center">
            <TouchableOpacity onPress={() => router.back()} className="mr-3">
              <ArrowLeft size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text className="text-2xl font-bold text-white flex-1">
              {t('kiblat.title')}
            </Text>
          </View>
        </View>
        
        <View className="flex-1 items-center justify-center px-6 bg-white dark:bg-gray-900">
          <TriangleAlert size={64} color="#f59e0b" />
          <Text className="text-gray-900 dark:text-white text-center mt-4 text-xl font-bold">
            {t('kiblat.requirementsNotMet')}
          </Text>
          
          <View className="w-full mt-4">
            <View className="p-4 rounded-xl bg-red-50 dark:bg-red-950">
              <View className="flex-row items-center mb-2">
                <X size={24} color="#dc2626" />
                <Text className="ml-2 font-semibold text-red-700 dark:text-red-300">
                  {t('kiblat.locationPermission')}
                </Text>
              </View>
              <Text className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                {t('kiblat.locationPermissionDesc')}
              </Text>
              <TouchableOpacity
                onPress={requestLocationPermission}
                className="bg-red-600 py-2 px-4 rounded-lg"
              >
                <Text className="text-white font-semibold text-center">
                  {t('kiblat.enableLocation')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            onPress={checkRequirements}
            className="mt-8 bg-teal-600 py-3 px-8 rounded-xl"
          >
            <Text className="text-white font-semibold text-center">
              {t('kiblat.checkAgain')}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-teal-600 dark:bg-teal-700">
      <View className="p-4 bg-teal-600 dark:bg-teal-700">
        <View className="flex-row items-center mb-2">
          <TouchableOpacity onPress={() => router.back()} className="mr-3">
            <ArrowLeft size={24} color="#FFFFFF" />
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
              <RefreshCw size={20} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </View>
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <Text className="text-teal-50 text-sm mb-1">
              {t('kiblat.description')}
            </Text>
            {location && (
              <View className="flex-row items-center">
                <MapPin size={14} color="#d1fae5" />
                <Text className="text-teal-100 text-xs ml-1">
                  {locationName || `${location.lat.toFixed(4)}°, ${location.lng.toFixed(4)}°`}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>

      <ScrollView 
        className="flex-1 bg-white dark:bg-gray-900"
        contentContainerStyle={{ padding: 16, alignItems: 'center' }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={updatingLocation} onRefresh={refreshLocation} colors={['#14B8A6']} />
        }
      >
        {error && !isUsingCache && (
          <View className="w-full bg-red-50 dark:bg-red-950 rounded-xl p-4 mb-4">
            <Text className="text-red-700 dark:text-red-300 text-sm">
              ⚠️ {error}
            </Text>
          </View>
        )}

        <View className="w-full mb-4">
          <View className="flex-row gap-3">
            <View className="flex-1 bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
              <View className="flex-row items-center">
                <View className="w-10 h-10 bg-teal-100 dark:bg-teal-900 rounded-full items-center justify-center mr-3">
                  <Navigation2 size={20} color="#0d9488" />
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
              <View className="flex-row items-center">
                <View className="w-10 h-10 bg-teal-100 dark:bg-teal-900 rounded-full items-center justify-center mr-3">
                  <MapPin size={20} color="#0d9488" />
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

        <View className="relative items-center justify-center mb-4" style={{ width: COMPASS_SIZE, height: COMPASS_SIZE }}>
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
                  <Landmark size={24} color="#FFFFFF" />
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
          <View className="w-full mb-4 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
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
                <View className="w-10 h-10 bg-teal-100 dark:bg-teal-900 rounded-full items-center justify-center mr-3">
                  <LocateFixed size={20} color="#0d9488" />
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

        <View className="w-full">
          <LinearGradient
            colors={colorScheme === 'dark' ? ['#1f2937', '#374151'] : ['#d1fae5', '#ccfbf1']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ borderRadius: 16, padding: 24 }}
          >
            <View className="flex-row items-center mb-3">
              <Info size={24} color="#059669" />
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
