const QURAN_API_BASE = 'https://api.alquran.cloud/v1';

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

export interface MultiEditionResponse {
  number: number;
  name: string;
  englishName: string;
  englishNameTranslation: string;
  revelationType: string;
  numberOfAyahs: number;
  ayahs: Array<{
    number: number;
    numberInSurah: number;
    text: string;
  }>;
}

class QuranService {
  async getAllSurah(): Promise<Surah[]> {
    try {
      const response = await fetch(`${QURAN_API_BASE}/surah`);
      const data = await response.json();
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

  async getSurahWithMultipleEditions(surahNumber: number, language: string = 'id'): Promise<{
    surah: SurahDetail;
    translation: Translation[];
    tafsir: Tafsir[];
  }> {
    try {
      const translationEdition = language === 'id' ? 'id.indonesian' : 'en.sahih';
      const tafsirEdition = language === 'id' ? 'id.jalalayn' : 'en.maududi';

      const response = await fetch(
        `${QURAN_API_BASE}/surah/${surahNumber}/editions/ar.alafasy,${translationEdition},${tafsirEdition}`
      );
      const data = await response.json();

      if (!data.data || data.data.length < 3) {
        throw new Error('Incomplete data received');
      }

      const [surahData, translationData, tafsirData] = data.data;

      return {
        surah: surahData,
        translation: translationData.ayahs,
        tafsir: tafsirData.ayahs,
      };
    } catch (error) {
      console.error('Error fetching surah with editions:', error);
      throw error;
    }
  }
}

export const quranService = new QuranService();