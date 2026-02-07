import { useColorScheme } from '@/hooks/use-color-scheme';
import { Ayah, quranService, SurahDetail, Tafsir, Translation } from '@/services/quran.service';
import { Audio } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ALargeSmall, ArrowUp, BookText, ChevronLeft, Languages, ListOrdered, Pause, Play, Square, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, Modal, NativeScrollEvent, NativeSyntheticEvent, Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SurahDetailScreen() {
  const { t, i18n } = useTranslation();
  const { id } = useLocalSearchParams();
  const { colorScheme } = useColorScheme();
  const flatListRef = useRef<FlatList>(null);
  const isAutoPlayingRef = useRef(false);
  const isScrollingRef = useRef(false);
  
  const [surah, setSurah] = useState<SurahDetail | null>(null);
  const [translations, setTranslations] = useState<Translation[]>([]);
  const [tafsirs, setTafsirs] = useState<Tafsir[]>([]);
  const [hasTranslation, setHasTranslation] = useState(true);
  const [loading, setLoading] = useState(true);
  const [sound, setSound] = useState<Audio.Sound>();
  const [playingAyah, setPlayingAyah] = useState<number | null>(null);
  const [selectedTafsir, setSelectedTafsir] = useState<{ ayah: number; text: string } | null>(null);
  const [showTranslation, setShowTranslation] = useState(true);
  const [fontSize, setFontSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [showAyahPicker, setShowAyahPicker] = useState(false);

  useFocusEffect(
    useCallback(() => {
      return () => {
        if (sound) {
          sound.unloadAsync();
        }
      };
    }, [sound])
  );

  useEffect(() => {
    if (id) {
      loadSurah(Number(id));
    }
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [id, i18n.language]);

  const loadSurah = async (surahNumber: number) => {
    try {
      setLoading(true);
      const data = await quranService.getSurahWithMultipleEditions(surahNumber, i18n.language);
      setSurah(data.surah);
      setTranslations(data.translation);
      setTafsirs(data.tafsir);
      setHasTranslation(data.hasTranslation);
      
      if (!data.hasTranslation) {
        setShowTranslation(false);
      }
    } catch (error) {
      console.error('Failed to load surah:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const progress = (contentOffset.y / (contentSize.height - layoutMeasurement.height)) * 100;
    setScrollProgress(Math.max(0, Math.min(100, progress)));
  };

  const scrollToAyah = (ayahNumber: number) => {
    if (isScrollingRef.current) return;
    
    const index = surah?.ayahs.findIndex((a) => a.numberInSurah === ayahNumber);
    if (index !== undefined && index >= 0 && flatListRef.current) {
      isScrollingRef.current = true;
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({
          index,
          animated: true,
          viewPosition: 0.2,
        });
        setTimeout(() => {
          isScrollingRef.current = false;
        }, 1000);
      }, 100);
    }
  };

  const handleAyahSelection = (ayahNumber: number) => {
    setShowAyahPicker(false);
    setTimeout(() => {
      scrollToAyah(ayahNumber);
    }, 300);
  };

  const playNextAyah = async (currentAyahNumber: number) => {
    if (!surah || !isAutoPlayingRef.current) return;

    const currentIndex = surah.ayahs.findIndex((a) => a.numberInSurah === currentAyahNumber);
    const nextAyah = surah.ayahs[currentIndex + 1];

    if (nextAyah) {
      await playAudio(nextAyah.numberInSurah, true);
    } else {
      setIsAutoPlaying(false);
      isAutoPlayingRef.current = false;
      setPlayingAyah(null);
    }
  };

  const playAudio = async (ayahNumber: number, isAuto: boolean = false) => {
    try {
      if (sound) {
        await sound.unloadAsync();
      }

      if (playingAyah === ayahNumber && !isAuto) {
        setPlayingAyah(null);
        setIsAutoPlaying(false);
        isAutoPlayingRef.current = false;
        return;
      }

      const ayah = surah?.ayahs.find((a) => a.numberInSurah === ayahNumber);
      if (!ayah?.audio) return;

      if (!isAuto) {
        setIsAutoPlaying(true);
        isAutoPlayingRef.current = true;
      }

      if (!isScrollingRef.current) {
        scrollToAyah(ayahNumber);
      }

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: ayah.audio },
        { shouldPlay: true }
      );

      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          if (isAutoPlayingRef.current) {
            playNextAyah(ayahNumber);
          } else {
            setPlayingAyah(null);
          }
        }
      });

      setSound(newSound);
      setPlayingAyah(ayahNumber);
    } catch (error) {
      console.error('Error playing audio:', error);
      setIsAutoPlaying(false);
      isAutoPlayingRef.current = false;
    }
  };

  const stopAudio = async () => {
    if (sound) {
      await sound.unloadAsync();
    }
    setPlayingAyah(null);
    setIsAutoPlaying(false);
    isAutoPlayingRef.current = false;
  };

  const scrollToTop = () => {
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  };

  const cycleFontSize = () => {
    setFontSize((prev) => {
      if (prev === 'small') return 'medium';
      if (prev === 'medium') return 'large';
      return 'small';
    });
  };

  const showTafsir = (ayahNumber: number) => {
    const tafsir = tafsirs.find((t) => t.numberInSurah === ayahNumber);
    if (tafsir) {
      setSelectedTafsir({ ayah: ayahNumber, text: tafsir.text });
    }
  };

  const getFontSize = () => {
    switch (fontSize) {
      case 'small':
        return { arabic: 20, translation: 14 };
      case 'medium':
        return { arabic: 24, translation: 16 };
      case 'large':
        return { arabic: 28, translation: 18 };
    }
  };

  const insets = useSafeAreaInsets();

  const renderHeader = () => {
    if (!surah) return null;

    const showBasmalah = surah.number !== 1 && surah.number !== 9;
    const sizes = getFontSize();

    return (
      <View className="mb-4">
        <LinearGradient
          colors={colorScheme === 'dark' ? ['#047857', '#0f766e'] : ['#059669', '#0d9488']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ borderRadius: 24, padding: 24, alignItems: 'center' }}
        >
          <Text className="text-4xl text-white mb-3">{surah.name}</Text>
          <Text className="text-xl font-bold text-white mb-2">
            {surah.englishName}
          </Text>
          <Text className="text-emerald-50 text-center mb-3">
            {surah.englishNameTranslation}
          </Text>
          <View className="flex-row gap-x-4">
            <View style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)', borderRadius: 9999, paddingHorizontal: 16, paddingVertical: 4 }}>
              <Text className="text-white text-sm">
                {surah.revelationType}
              </Text>
            </View>
            <View style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)', borderRadius: 9999, paddingHorizontal: 16, paddingVertical: 4 }}>
              <Text className="text-white text-sm">
                {surah.numberOfAyahs} {t('quran.verses')}
              </Text>
            </View>
          </View>
        </LinearGradient>

        {showBasmalah && (
          <View className="mt-4 rounded-2xl px-4">
            <Text className="text-center text-gray-900 dark:text-white font-bold" style={{ fontSize: sizes.arabic }}>
              بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
            </Text>
          </View>
        )}
      </View>
    );
  };

  const renderVerse = ({ item }: { item: Ayah }) => {
    const translation = translations.find((t) => t.numberInSurah === item.numberInSurah);
    const hasTafsir = tafsirs.some((t) => t.numberInSurah === item.numberInSurah);
    const isPlaying = playingAyah === item.numberInSurah;
    const sizes = getFontSize();

    const removeBasmalah = item.numberInSurah === 1 && surah && surah.number !== 1 && surah.number !== 9;
    const verseText = removeBasmalah ? quranService.filterBasmalah(item.text) : item.text;

    return (
      <View className={`mb-4 ${isPlaying ? 'bg-emerald-50 dark:bg-emerald-950' : ''} !rounded-xl !overflow-hidden p-2`}>
        <View className="flex-row items-center mb-3">
          <View className="w-8 h-8 bg-emerald-600 dark:bg-emerald-700 rounded-full items-center justify-center">
            <Text className="text-white font-bold text-xs">{item.numberInSurah}</Text>
          </View>
          <View className="flex-1 h-px bg-gray-200 dark:bg-gray-700 ml-3" />
          <TouchableOpacity
            onPress={() => playAudio(item.numberInSurah)}
            className="ml-3 w-10 h-10 bg-emerald-100 dark:bg-emerald-900 rounded-full items-center justify-center"
          >
            {isPlaying ? <Pause size={20} color="#059669" /> : <Play size={20} color="#059669" />}
          </TouchableOpacity>
          {hasTafsir && (
            <TouchableOpacity
              onPress={() => showTafsir(item.numberInSurah)}
              className="ml-2 w-10 h-10 bg-teal-100 dark:bg-teal-900 rounded-full items-center justify-center"
            >
              <BookText size={20} color="#0d9488" />
            </TouchableOpacity>
          )}
        </View>

        <Text 
          className="text-right text-gray-900 dark:text-white mb-4 leading-loose font-bold"
          style={{ fontSize: sizes.arabic }}
        >
          {verseText}
        </Text>

        {hasTranslation && showTranslation && translation && (
          <View className="bg-emerald-50 dark:bg-gray-800 rounded-2xl p-4">
            <Text 
              className="text-gray-900 dark:text-white leading-6"
              style={{ fontSize: sizes.translation }}
            >
              {translation.text}
            </Text>
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View className="flex-1 bg-white dark:bg-gray-900 items-center justify-center">
        <ActivityIndicator size="large" color="#059669" />
        <Text className="text-gray-600 dark:text-gray-400 mt-4">{t('common.loading')}</Text>
      </View>
    );
  }

  if (!surah) {
    return (
      <View className="flex-1 bg-white dark:bg-gray-900 items-center justify-center">
        <Text className="text-gray-600 dark:text-gray-400">{t('quran.notFound')}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-emerald-600 dark:bg-emerald-700" edges={["top", "bottom"]}>
      <View className="p-4 bg-emerald-600 dark:bg-emerald-700">
        <View className="flex-row items-center">
          <TouchableOpacity onPress={() => router.back()} className="mr-3">
            <ChevronLeft size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-xl font-bold text-white">
              {surah.englishName}
            </Text>
            <Text className="text-emerald-50 text-sm">
              {surah.englishNameTranslation}
            </Text>
          </View>
        </View>
      </View>

      <View className='bg-white dark:bg-gray-900 flex-1'>
        <FlatList
          ref={flatListRef}
          data={surah.ayahs}
          renderItem={renderVerse}
          keyExtractor={(item) => item.number.toString()}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={{ padding: 16, paddingTop: 16, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={10}
          removeClippedSubviews={false}
          onScrollToIndexFailed={(info) => {
            const wait = new Promise(resolve => setTimeout(resolve, 500));
            wait.then(() => {
              flatListRef.current?.scrollToIndex({ 
                index: info.index, 
                animated: true,
                viewPosition: 0.2 
              });
            });
          }}
        />
      </View>

      <View className="absolute left-0 right-0 px-4 pb-4" style={{ bottom: Platform.select({ android: insets.bottom, ios: 0 }) }}>
        <View className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <View className="h-1 bg-gray-200 dark:bg-gray-700">
            <View 
              className="h-full bg-emerald-600"
              style={{ width: `${scrollProgress}%` }}
            />
          </View>
          
          <View className="flex-row items-center justify-around p-4">
            <TouchableOpacity
              onPress={() => setShowAyahPicker(true)}
              className="items-center"
            >
              <View className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-full items-center justify-center">
                <ListOrdered size={24} color="#6B7280" />
              </View>
              <Text className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                {t('quran.goToAyah')}
              </Text>
            </TouchableOpacity>

            {hasTranslation && (
              <TouchableOpacity
                onPress={() => setShowTranslation(!showTranslation)}
                className="items-center"
              >
                <View className={`w-12 h-12 rounded-full items-center justify-center ${showTranslation ? 'bg-emerald-100 dark:bg-emerald-900' : 'bg-gray-100 dark:bg-gray-700'}`}>
                  <Languages 
                    size={24}
                    color={showTranslation ? '#059669' : '#6B7280'}
                  />
                </View>
                <Text className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  {t('quran.translation')}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={cycleFontSize}
              className="items-center"
            >
              <View className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-full items-center justify-center">
                <ALargeSmall size={24} color="#6B7280" />
              </View>
              <Text className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                {fontSize === 'small' ? t('quran.small') : fontSize === 'medium' ? t('quran.medium') : t('quran.large')}
              </Text>
            </TouchableOpacity>

            {isAutoPlaying && (
              <TouchableOpacity
                onPress={stopAudio}
                className="items-center"
              >
                <View className="w-12 h-12 bg-red-100 dark:bg-red-900 rounded-full items-center justify-center">
                  <Square size={24} color="#DC2626" />
                </View>
                <Text className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  {t('quran.stop')}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={scrollToTop}
              className="items-center"
            >
              <View className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-full items-center justify-center">
                <ArrowUp size={24} color="#6B7280" />
              </View>
              <Text className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                {t('quran.toTop')}
              </Text>
            </TouchableOpacity>
          </View>

          {isAutoPlaying && playingAyah && (
            <View className="px-4 pb-3 pt-1 border-t border-gray-200 dark:border-gray-700">
              <Text className="text-center text-sm text-gray-600 dark:text-gray-400">
                {t('quran.playing')} {playingAyah} / {surah.numberOfAyahs}
              </Text>
            </View>
          )}
        </View>
      </View>

      <Modal
        visible={showAyahPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAyahPicker(false)}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white dark:bg-gray-900 rounded-t-3xl" style={{ maxHeight: '70%', marginBottom: insets.bottom }}>
            <View className="p-4 border-b border-gray-200 dark:border-gray-700">
              <View className="flex-row items-center justify-between">
                <Text className="text-xl font-bold text-gray-900 dark:text-white">
                  {t('quran.selectAyah')}
                </Text>
                <TouchableOpacity onPress={() => setShowAyahPicker(false)}>
                  <X size={24} color={colorScheme === 'dark' ? '#FFFFFF' : '#000000'} />
                </TouchableOpacity>
              </View>
            </View>
            <ScrollView className="p-4">
              <View className="flex-row flex-wrap gap-2 pb-6">
                {Array.from({ length: surah.numberOfAyahs }, (_, i) => i + 1).map((num) => (
                  <TouchableOpacity
                    key={num}
                    onPress={() => handleAyahSelection(num)}
                    className="bg-emerald-100 dark:bg-emerald-900 rounded-xl p-4 items-center justify-center"
                    style={{ width: '18%' }}
                  >
                    <Text className="text-emerald-900 dark:text-emerald-100 font-bold text-base">
                      {num}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={selectedTafsir !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedTafsir(null)}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white dark:bg-gray-900 rounded-t-3xl" style={{ maxHeight: '75%', marginBottom: insets.bottom }}>
            <View className="p-4 border-b border-gray-200 dark:border-gray-700">
              <View className="flex-row items-center justify-between">
                <Text className="text-xl font-bold text-gray-900 dark:text-white">
                  {t('quran.tafsir')} - {t('quran.verse')} {selectedTafsir?.ayah}
                </Text>
                <TouchableOpacity onPress={() => setSelectedTafsir(null)}>
                  <X size={24} color={colorScheme === 'dark' ? '#FFFFFF' : '#000000'} />
                </TouchableOpacity>
              </View>
            </View>
            <ScrollView className="p-4">
              <Text className="text-base text-gray-700 dark:text-gray-300 leading-7">
                {selectedTafsir?.text}
              </Text>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}