import { IconSymbol } from '@/components/ui/icon-symbol';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { Magnetometer } from 'expo-sensors';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Animated, Dimensions, ScrollView, Text, TouchableOpacity, useColorScheme, View } from 'react-native';

const { width } = Dimensions.get('window');
const COMPASS_SIZE = width * 0.7;

export default function KiblatScreen() {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const [heading, setHeading] = useState(0);
  const [qiblaDirection, setQiblaDirection] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [calibrating, setCalibrating] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const rotation = new Animated.Value(0);
  const headingStableCount = useRef(0);
  const lastHeading = useRef(0);
  const calibrationTimer = useRef<NodeJS.Timeout | any>('');

  useEffect(() => {
    requestLocationPermission();
    return () => {
      Magnetometer.removeAllListeners();
      if (calibrationTimer.current) {
        clearTimeout(calibrationTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    if (heading !== null && heading !== 0) {
      Animated.spring(rotation, {
        toValue: -heading,
        useNativeDriver: true,
        tension: 10,
        friction: 8,
      }).start();
    }
  }, [heading]);

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError(t('kiblat.permissionDenied'));
        setLoading(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const userLocation = {
        lat: location.coords.latitude,
        lng: location.coords.longitude,
      };
      setLocation(userLocation);

      const qibla = calculateQiblaDirection(
        userLocation.lat,
        userLocation.lng
      );
      setQiblaDirection(qibla);

      await startCompass();
      setLoading(false);
    } catch (err) {
      setError(t('kiblat.locationError'));
      setLoading(false);
    }
  };

  const calculateQiblaDirection = (lat: number, lng: number): number => {
    const kaabaLat = 21.4225;
    const kaabaLng = 39.8262;

    const latRad = (lat * Math.PI) / 180;
    const lngRad = (lng * Math.PI) / 180;
    const kaabaLatRad = (kaabaLat * Math.PI) / 180;
    const kaabaLngRad = (kaabaLng * Math.PI) / 180;

    const dLng = kaabaLngRad - lngRad;

    const y = Math.sin(dLng) * Math.cos(kaabaLatRad);
    const x =
      Math.cos(latRad) * Math.sin(kaabaLatRad) -
      Math.sin(latRad) * Math.cos(kaabaLatRad) * Math.cos(dLng);

    let bearing = Math.atan2(y, x);
    bearing = (bearing * 180) / Math.PI;
    bearing = (bearing + 360) % 360;

    return bearing;
  };

  const startCompass = async () => {
    return new Promise<void>((resolve) => {
      Magnetometer.setUpdateInterval(100);
      
      Magnetometer.addListener((data) => {
        const { x, y } = data;
        let angle = Math.atan2(y, x) * (180 / Math.PI);
        angle = (angle + 360) % 360;

        const headingDiff = Math.abs(angle - lastHeading.current);
        
        if (headingDiff < 5) {
          headingStableCount.current += 1;
        } else {
          headingStableCount.current = 0;
        }

        if (headingStableCount.current >= 5 && calibrating) {
          setCalibrating(false);
        }

        lastHeading.current = angle;
        setHeading(angle);
      });

      calibrationTimer.current = setTimeout(() => {
        setCalibrating(false);
        resolve();
      }, 3000);
    });
  };

  const getQiblaAngle = (): number => {
    if (qiblaDirection === null) return 0;
    return qiblaDirection - heading;
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
        <View className="px-4 pt-16 pb-4 bg-teal-600 dark:bg-teal-700">
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
        
        <View className="flex-1 items-center justify-center px-6">
          <IconSymbol size={64} name="error" color="#DC2626" />
          <Text className="text-red-600 dark:text-red-400 text-center mt-4 text-lg font-bold">{error}</Text>
          <Text className="text-gray-500 dark:text-gray-400 text-center mt-2">
            {t('kiblat.errorDescription')}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white dark:bg-gray-900">
      <View className="px-4 pt-16 pb-4 bg-teal-600 dark:bg-teal-700">
        <View className="flex-row items-center mb-4">
          <TouchableOpacity onPress={() => router.back()} className="mr-3">
            <IconSymbol size={24} name="arrow-back" color="#FFFFFF" />
          </TouchableOpacity>
          <Text className="text-2xl font-bold text-white flex-1">
            {t('kiblat.title')}
          </Text>
        </View>
        <Text className="text-teal-50 text-sm">
          {t('kiblat.description')}
        </Text>
      </View>

      <ScrollView 
        className="flex-1"
        contentContainerStyle={{ padding: 16, alignItems: 'center' }}
        showsVerticalScrollIndicator={false}
      >
        {calibrating && (
          <View className="w-full mb-4 bg-amber-50 dark:bg-amber-950 rounded-2xl p-4 border border-amber-200 dark:border-amber-800">
            <View className="flex-row items-center">
              <ActivityIndicator size="small" color="#D97706" />
              <Text className="text-amber-800 dark:text-amber-200 ml-3 font-medium">
                {t('kiblat.calibrating')}
              </Text>
            </View>
          </View>
        )}

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

        <View className="relative items-center justify-center mb-6" style={{ width: COMPASS_SIZE, height: COMPASS_SIZE }}>
          <View className="absolute w-full h-full bg-white dark:bg-gray-800 rounded-full shadow-lg border-4 border-gray-100 dark:border-gray-700" />
          
          <Animated.View
            style={{
              width: COMPASS_SIZE - 20,
              height: COMPASS_SIZE - 20,
              transform: [{ rotate: rotation.interpolate({
                inputRange: [0, 360],
                outputRange: ['0deg', '360deg'],
              })}],
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

              <View className="absolute top-1/2 -mt-3 left-2">
                <View className="bg-gray-400 dark:bg-gray-600 rounded-full justify-center items-center h-8 w-8">
                  <Text className="text-white font-bold text-xs">W</Text>
                </View>
              </View>

              <View className="absolute top-1/2 -mt-3 right-2">
                <View className="bg-gray-400 dark:bg-gray-600 rounded-full justify-center items-center h-8 w-8">
                  <Text className="text-white font-bold text-xs">E</Text>
                </View>
              </View>
            </View>
          </Animated.View>

          <Animated.View
            style={{
              position: 'absolute',
              transform: [
                { rotate: `${getQiblaAngle()}deg` },
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
          </Animated.View>

          <View className="absolute bg-white dark:bg-gray-700 w-3 h-3 rounded-full border-2 border-teal-600" />
        </View>

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
    </View>
  );
}