import { IconSymbol } from '@/components/ui/icon-symbol';
import { quranService, Surah } from '@/services/quran.service';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function QuranListScreen() {
  const { t } = useTranslation();
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [filteredSurahs, setFilteredSurahs] = useState<Surah[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadSurahs();
  }, []);

  useEffect(() => {
    filterSurahs();
  }, [searchQuery, surahs]);

  const loadSurahs = async () => {
    try {
      const data = await quranService.getAllSurah();
      setSurahs(data);
      setFilteredSurahs(data);
    } catch (error) {
      console.error('Failed to load surahs:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterSurahs = () => {
    if (!searchQuery.trim()) {
      setFilteredSurahs(surahs);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = surahs.filter((surah) => {
      const matchNumber = surah.number.toString().includes(query);
      const matchName = surah.name.toLowerCase().includes(query);
      const matchEnglishName = surah.englishName.toLowerCase().includes(query);
      const matchTranslation = surah.englishNameTranslation.toLowerCase().includes(query);
      
      return matchNumber || matchName || matchEnglishName || matchTranslation;
    });

    setFilteredSurahs(filtered);
  };

  const handleSurahPress = (surahNumber: number) => {
    router.push(`/quran/${surahNumber}`);
  };

  const clearSearch = () => {
    setSearchQuery('');
  };

  const renderSurah = ({ item }: { item: Surah }) => (
    <TouchableOpacity
      onPress={() => handleSurahPress(item.number)}
      activeOpacity={0.7}
      className="bg-white dark:bg-gray-800 rounded-2xl p-4 mb-3 shadow-sm border border-gray-100 dark:border-gray-700"
    >
      <View className="flex-row items-center">
        <View className="w-12 h-12 bg-emerald-600 dark:bg-emerald-700 rounded-xl items-center justify-center mr-4">
          <Text className="text-white font-bold text-base">{item.number}</Text>
        </View>
        <View className="flex-1">
          <Text className="text-lg font-bold text-gray-900 dark:text-white">
            {item.englishName}
          </Text>
          <View className="flex-row items-center gap-x-2 mt-1">
            <Text className="text-xs text-gray-500 dark:text-gray-400">
              {item.revelationType}
            </Text>
            <Text className="text-xs text-gray-500 dark:text-gray-400">•</Text>
            <Text className="text-xs text-gray-500 dark:text-gray-400">
              {item.numberOfAyahs} {t('quran.verses')}
            </Text>
          </View>
        </View>
        <View className="items-end">
          <Text className="text-2xl text-emerald-600 dark:text-emerald-500 mb-1">
            {item.name}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderEmptyList = () => (
    <View className="items-center justify-center py-12">
      <IconSymbol size={48} name="search-off" color="#9CA3AF" />
      <Text className="text-gray-500 dark:text-gray-400 text-center mt-4">
        {t('quran.noResults')}
      </Text>
      <Text className="text-gray-400 dark:text-gray-500 text-center mt-2 px-8">
        {t('quran.tryDifferentSearch')}
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View className="flex-1 bg-white dark:bg-gray-900 items-center justify-center">
        <ActivityIndicator size="large" color="#059669" />
        <Text className="text-gray-600 dark:text-gray-400 mt-4">{t('common.loading')}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-emerald-600 dark:bg-emerald-700">
      <View className='bg-white dark:bg-gray-900 flex-1'>
        <View className="p-4 bg-emerald-600 dark:bg-emerald-700">
          <View className="flex-row items-center mb-4">
            <TouchableOpacity onPress={() => router.back()} className="mr-3">
              <IconSymbol size={24} name="arrow-back" color="#FFFFFF" />
            </TouchableOpacity>
            <Text className="text-2xl font-bold text-white flex-1">
              {t('quran.title')}
            </Text>
          </View>
          <Text className="text-emerald-50 text-sm mb-4">
            {t('quran.description')}
          </Text>

          <View className="bg-white dark:bg-gray-800 rounded-2xl flex-row items-center px-4 py-1">
            <IconSymbol size={20} name="search" color="#6B7280" />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={t('quran.searchPlaceholder')}
              placeholderTextColor="#9CA3AF"
              className="flex-1 ml-3 text-gray-900 dark:text-white text-base"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={clearSearch}>
                <IconSymbol size={20} name="close" color="#6B7280" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <FlatList
          data={filteredSurahs}
          renderItem={renderSurah}
          keyExtractor={(item) => item.number.toString()}
          contentContainerStyle={{ padding: 16 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={renderEmptyList}
        />
      </View>
    </SafeAreaView>
  );
}