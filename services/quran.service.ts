import { storage } from './storage.service';

const QURAN_API_BASE = 'https://api.alquran.cloud/v1';
const CACHE_KEY_PREFIX = 'quran_';
const DOWNLOAD_STATUS_KEY = 'download_status';
const DOWNLOAD_PROGRESS_KEY = 'download_progress';

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

export interface DownloadStatus {
  isComplete: boolean;
  totalSurahs: number;
  downloadedSurahs: number;
  lastDownloadDate?: string;
  languages: string[];
}

export interface DownloadProgress {
  current: number;
  total: number;
  currentSurah?: string;
  isDownloading: boolean;
}

class QuranService {
  private downloadInProgress = false;

  private getEditions(language: string): { translation: string; tafsir: string; hasTranslation: boolean } {
    const editionMap: { [key: string]: { translation: string; tafsir: string; hasTranslation: boolean } } = {
      id: { 
        translation: 'id.indonesian', 
        tafsir: 'id.jalalayn',
        hasTranslation: true
      },
      en: { 
        translation: 'en.sahih', 
        tafsir: 'en.sahih',
        hasTranslation: true
      },
      ms: { 
        translation: 'ms.basmeih', 
        tafsir: 'ms.basmeih',
        hasTranslation: true
      },
      ur: { 
        translation: 'ur.ahmedali', 
        tafsir: 'ur.ahmedali',
        hasTranslation: true
      },
      tr: { 
        translation: 'tr.ates', 
        tafsir: 'tr.ates',
        hasTranslation: true
      },
      ar: { 
        translation: '', 
        tafsir: 'ar.jalalayn',
        hasTranslation: false
      },
      bn: { 
        translation: 'bn.bengali', 
        tafsir: 'bn.bengali',
        hasTranslation: true
      },
      fa: { 
        translation: 'fa.ayati', 
        tafsir: 'fa.ayati',
        hasTranslation: true
      },
      hi: {
        translation: 'hi.hindi',
        tafsir: 'hi.hindi',
        hasTranslation: true
      },
      fr: {
        translation: 'fr.hamidullah',
        tafsir: 'fr.hamidullah',
        hasTranslation: true
      },
      ru: {
        translation: 'ru.kuliev',
        tafsir: 'ru.kuliev',
        hasTranslation: true
      },
      ha: {
        translation: 'ha.gumi',
        tafsir: 'ha.gumi',
        hasTranslation: true
      },
      so: {
        translation: 'so.abduh',
        tafsir: 'so.abduh',
        hasTranslation: true
      },
    };

    return editionMap[language] || editionMap['en'];
  }

  async getAllSurah(): Promise<Surah[]> {
    try {
      const cacheKey = `${CACHE_KEY_PREFIX}surah_list`;
      
      // Check MMKV cache
      const cached = storage.getObject<Surah[]>(cacheKey);
      if (cached) {
        return cached;
      }

      // Fetch from API
      const response = await fetch(`${QURAN_API_BASE}/surah`);
      const data = await response.json();
      
      // Save to MMKV
      storage.setObject(cacheKey, data.data);
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
      
      // Check MMKV cache
      const cached = storage.getObject<{
        surah: SurahDetail;
        translation: Translation[];
        tafsir: Tafsir[];
        hasTranslation: boolean;
      }>(cacheKey);
      
      if (cached) {
        return cached;
      }

      // Fetch from API
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
        result = {
          surah: surahData,
          translation: translationData.ayahs,
          tafsir: tafsirData.ayahs,
          hasTranslation: true,
        };
      }

      // Save to MMKV
      storage.setObject(cacheKey, result);

      return result;
    } catch (error) {
      console.error('Error fetching surah with editions:', error);
      throw error;
    }
  }

  async getAvailableEditions(): Promise<Edition[]> {
    try {
      const cacheKey = `${CACHE_KEY_PREFIX}editions`;
      
      // Check MMKV cache
      const cached = storage.getObject<Edition[]>(cacheKey);
      if (cached) {
        return cached;
      }

      // Fetch from API
      const response = await fetch(`${QURAN_API_BASE}/edition`);
      const data = await response.json();
      
      // Save to MMKV
      storage.setObject(cacheKey, data.data);
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

  // Download semua surah untuk bahasa tertentu
  async downloadAllSurahsForLanguage(
    language: string,
    onProgress?: (progress: DownloadProgress) => void
  ): Promise<void> {
    if (this.downloadInProgress) {
      // console.log('Download already in progress');
      return;
    }

    try {
      this.downloadInProgress = true;
      const surahs = await this.getAllSurah();
      const totalSurahs = surahs.length;

      // Update progress
      this.updateDownloadProgress({
        current: 0,
        total: totalSurahs,
        isDownloading: true,
      });

      for (let i = 0; i < totalSurahs; i++) {
        const surah = surahs[i];
        
        // Check if already cached in MMKV
        const cacheKey = `${CACHE_KEY_PREFIX}surah_${surah.number}_${language}`;
        
        if (!storage.contains(cacheKey)) {
          try {
            await this.getSurahWithMultipleEditions(surah.number, language);
            // console.log(`Downloaded: ${surah.englishName} (${i + 1}/${totalSurahs})`);
          } catch (error) {
            console.error(`Failed to download surah ${surah.number}:`, error);
            // Continue with next surah even if one fails
          }
        }

        const progress: DownloadProgress = {
          current: i + 1,
          total: totalSurahs,
          currentSurah: surah.englishName,
          isDownloading: true,
        };

        this.updateDownloadProgress(progress);
        onProgress?.(progress);

        // Small delay to prevent rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Mark as complete
      this.updateDownloadProgress({
        current: totalSurahs,
        total: totalSurahs,
        isDownloading: false,
      });

      this.markDownloadComplete(language);
      
    } catch (error) {
      console.error('Error downloading all surahs:', error);
      throw error;
    } finally {
      this.downloadInProgress = false;
    }
  }

  // Download multiple languages
  async downloadAllSurahsForLanguages(
    languages: string[],
    onProgress?: (progress: DownloadProgress) => void
  ): Promise<void> {
    for (const language of languages) {
      await this.downloadAllSurahsForLanguage(language, onProgress);
    }
  }

  // Check download status
  getDownloadStatus(): DownloadStatus | null {
    try {
      const status = storage.getObject<DownloadStatus>(DOWNLOAD_STATUS_KEY);
      return status || null;
    } catch (error) {
      console.error('Error getting download status:', error);
      return null;
    }
  }

  // Get current download progress
  getDownloadProgress(): DownloadProgress | null {
    try {
      const progress = storage.getObject<DownloadProgress>(DOWNLOAD_PROGRESS_KEY);
      return progress || null;
    } catch (error) {
      console.error('Error getting download progress:', error);
      return null;
    }
  }

  // Update download progress
  private updateDownloadProgress(progress: DownloadProgress): void {
    try {
      storage.setObject(DOWNLOAD_PROGRESS_KEY, progress);
    } catch (error) {
      console.error('Error updating download progress:', error);
    }
  }

  // Mark download as complete
  private markDownloadComplete(language: string): void {
    try {
      const currentStatus = this.getDownloadStatus();
      const languages = currentStatus?.languages || [];
      
      if (!languages.includes(language)) {
        languages.push(language);
      }

      const status: DownloadStatus = {
        isComplete: true,
        totalSurahs: 114,
        downloadedSurahs: 114,
        lastDownloadDate: new Date().toISOString(),
        languages,
      };

      storage.setObject(DOWNLOAD_STATUS_KEY, status);
    } catch (error) {
      console.error('Error marking download complete:', error);
    }
  }

  // Check if offline data is available
  isOfflineDataAvailable(language: string): boolean {
    try {
      const status = this.getDownloadStatus();
      return status?.languages.includes(language) ?? false;
    } catch (error) {
      return false;
    }
  }

  // Get cache statistics
  getCacheStats(): {
    totalKeys: number;
    quranKeys: number;
    totalSize: number;
    sizeInMB: number;
  } {
    const stats = storage.getStats();
    const allKeys = storage.getAllKeys();
    const quranKeys = allKeys.filter(key => key.startsWith(CACHE_KEY_PREFIX)).length;

    return {
      totalKeys: stats.totalKeys,
      quranKeys,
      totalSize: stats.totalSize,
      sizeInMB: stats.sizeInMB,
    };
  }

  clearCache(): void {
    try {
      const keys = storage.getAllKeys();
      const quranKeys = keys.filter(key => 
        key.startsWith(CACHE_KEY_PREFIX) || 
        key === DOWNLOAD_STATUS_KEY || 
        key === DOWNLOAD_PROGRESS_KEY
      );
      
      quranKeys.forEach(key => storage.delete(key));
      
      console.log('Cache cleared successfully');
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }

  filterBasmalah(ayah: string): string {
    const basmalah = "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ";
    
    const ayahWoBsm = ayah
      .replace(basmalah, '')
      .trim();
    
    return ayahWoBsm;
  }
}

export const quranService = new QuranService();