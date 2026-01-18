import AsyncStorage from '@react-native-async-storage/async-storage';

const QURAN_API_BASE = 'https://api.alquran.cloud/v1';
const CACHE_KEY_PREFIX = '@barakah_quran_cache_';

export interface Surah {
  number: number;
  name: string;
  englishName: string;
  englishNameTranslation: string;
  numberOfAyahs: number;
  revelationType: string;
}

export interface Ayah {
  number: number;
  numberInSurah: number;
  text: string;
  juz: number;
  manzil: number;
  page: number;
  ruku: number;
  hizbQuarter: number;
  sajda: boolean | { id: number; recommended: boolean; obligatory: boolean };
  audio?: string;
}

export interface SurahDetail {
  number: number;
  name: string;
  englishName: string;
  englishNameTranslation: string;
  numberOfAyahs: number;
  revelationType: string;
  ayahs: Ayah[];
}

export interface Translation {
  number: number;
  numberInSurah: number;
  text: string;
}

export interface Tafsir {
  number: number;
  numberInSurah: number;
  text: string;
}

export interface Edition {
  identifier: string;
  language: string;
  name: string;
  englishName: string;
  format: string;
  type: string;
}

class QuranService {
  private getEditions(language: string): { translation: string; tafsir: string; hasTranslation: boolean } {
    const editionMap: { [key: string]: { translation: string; tafsir: string; hasTranslation: boolean } } = {
      id: { 
        translation: 'id.indonesian', 
        tafsir: 'id.jalalayn',
        hasTranslation: true
      },
      en: { 
        translation: 'en.sahih', 
        tafsir: 'en.maududi',
        hasTranslation: true
      },
      ms: { 
        translation: 'ms.basmeih', 
        tafsir: 'ms.basmeih',
        hasTranslation: true
      },
      ur: { 
        translation: 'ur.ahmedali', 
        tafsir: 'ur.jalandhry',
        hasTranslation: true
      },
      ar: { 
        translation: '', 
        tafsir: 'ar.jalalayn',
        hasTranslation: false
      },
    };

    return editionMap[language] || editionMap['en'];
  }

  async getAllSurah(): Promise<Surah[]> {
    try {
      const cacheKey = `${CACHE_KEY_PREFIX}surah_list`;
      const cached = await AsyncStorage.getItem(cacheKey);
      
      if (cached) {
        return JSON.parse(cached);
      }

      const response = await fetch(`${QURAN_API_BASE}/surah`);
      const data = await response.json();
      
      await AsyncStorage.setItem(cacheKey, JSON.stringify(data.data));
      return data.data;
    } catch (error) {
      console.error('Error fetching surah list:', error);
      throw error;
    }
  }

  async getSurahDetail(surahNumber: number, edition: string = 'ar.alafasy'): Promise<SurahDetail> {
    try {
      const response = await fetch(`${QURAN_API_BASE}/surah/${surahNumber}/${edition}`);
      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('Error fetching surah detail:', error);
      throw error;
    }
  }

  async getSurahWithMultipleEditions(
    surahNumber: number, 
    language: string = 'id'
  ): Promise<{
    surah: SurahDetail;
    translation: Translation[];
    tafsir: Tafsir[];
    hasTranslation: boolean;
  }> {
    try {
      const editions = this.getEditions(language);
      const cacheKey = `${CACHE_KEY_PREFIX}surah_${surahNumber}_${language}`;
      
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      let editionString: string;
      let expectedDataLength: number;

      if (!editions.hasTranslation) {
        editionString = `ar.alafasy,${editions.tafsir}`;
        expectedDataLength = 2;
      } else {
        editionString = `ar.alafasy,${editions.translation},${editions.tafsir}`;
        expectedDataLength = 3;
      }

      const response = await fetch(
        `${QURAN_API_BASE}/surah/${surahNumber}/editions/${editionString}`
      );
      const data = await response.json();

      if (!data.data || data.data.length < expectedDataLength) {
        throw new Error('Incomplete data received');
      }

      let result;

      if (!editions.hasTranslation) {
        const [surahData, tafsirData] = data.data;
        result = {
          surah: surahData,
          translation: [],
          tafsir: tafsirData.ayahs,
          hasTranslation: false,
        };
      } else {
        const [surahData, translationData, tafsirData] = data.data;

        const filteredAyahs = this.filterBasmalah(surahData.ayahs, surahNumber);
        result = {
          surah: { ...surahData, ayahs: filteredAyahs },
          translation: translationData.ayahs,
          tafsir: tafsirData.ayahs,
          hasTranslation: true,
        };
      }

      await AsyncStorage.setItem(cacheKey, JSON.stringify(result));
      return result;
    } catch (error) {
      console.error('Error fetching surah with editions:', error);
      throw error;
    }
  }

  async getAvailableEditions(): Promise<Edition[]> {
    try {
      const cacheKey = `${CACHE_KEY_PREFIX}editions`;
      const cached = await AsyncStorage.getItem(cacheKey);
      
      if (cached) {
        return JSON.parse(cached);
      }

      const response = await fetch(`${QURAN_API_BASE}/edition`);
      const data = await response.json();
      
      await AsyncStorage.setItem(cacheKey, JSON.stringify(data.data));
      return data.data;
    } catch (error) {
      console.error('Error fetching editions:', error);
      throw error;
    }
  }

  async getEditionsByLanguage(language: string): Promise<Edition[]> {
    try {
      const response = await fetch(`${QURAN_API_BASE}/edition/language/${language}`);
      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('Error fetching editions by language:', error);
      throw error;
    }
  }

  async clearCache(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const quranKeys = keys.filter(key => key.startsWith(CACHE_KEY_PREFIX));
      await AsyncStorage.multiRemove(quranKeys);
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }

  private filterBasmalah(ayahs: any[], surahNumber: number): any[] {
    if (surahNumber === 1 || surahNumber === 9) {
      return ayahs;
    }
    if (ayahs.length > 0) {
      const firstAyah = ayahs[0];
      const basmalah = "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ";
      
      firstAyah.text = firstAyah.text
        .replace(basmalah, '')
        .trim();
    }

    return ayahs;
  }
}

export const quranService = new QuranService();