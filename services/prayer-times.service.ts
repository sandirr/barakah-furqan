import i18n from '@/i18n';
import AsyncStorage from '@react-native-async-storage/async-storage';
import moment from 'moment';

export interface PrayerTime {
  name: string;
  time: string;
  arabic: string;
}

export interface PrayerTimes {
  date: string;
  hijriDate: string;
  fajr: string;
  sunrise: string;
  dhuhr: string;
  asr: string;
  maghrib: string;
  isha: string;
}

export interface PrayerTimesResponse {
  code: number;
  status: string;
  data: {
    timings: {
      Fajr: string;
      Sunrise: string;
      Dhuhr: string;
      Asr: string;
      Maghrib: string;
      Isha: string;
    };
    date: {
      readable: string;
      hijri: {
        date: string;
        month: {
          en: string;
          ar: string;
        };
        year: string;
      };
    };
  };
}

const STORAGE_KEY = '@barakah_furqan_prayer_times';

class PrayerTimesService {
  private async fetchPrayerTimes(latitude: number, longitude: number, method: number = 20): Promise<PrayerTimesResponse> {
    const dateStr = moment().format('DD-MM-YYYY');
    const url = `https://api.aladhan.com/v1/timings/${dateStr}?latitude=${latitude}&longitude=${longitude}&method=${method}`;
    
    try {
      const fetchPromise = fetch(url, { 
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        }
      });
      
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), 20000);
      });
      
      const response = await Promise.race([fetchPromise, timeoutPromise]) as Response;
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.code !== 200) {
        throw new Error(`API error: ${data.status}`);
      }
      
      if (!data.data || !data.data.timings) {
        throw new Error('Invalid API response');
      }
      
      return data;
    } catch (error: any) {
      if (error.message === 'Request timeout') {
        throw new Error('Koneksi timeout. Coba lagi.');
      }
      
      if (error.message.includes('Network request failed')) {
        throw new Error('Tidak ada koneksi internet.');
      }
      
      throw error;
    }
  }

  async getPrayerTimes(latitude: number, longitude: number, skipCache: boolean = false): Promise<PrayerTimes> {
    const today = moment().format('YYYY-MM-DD');

    try {
      // Check cache first (unless skipCache is true for refresh)
      if (!skipCache) {
        const cached = await this.getCachedPrayerTimes();
        if (cached && cached.date === today) {
          return cached;
        }
      }

      // Fetch from API
      const response = await this.fetchPrayerTimes(latitude, longitude);
      const data = response.data;

      const prayerTimes: PrayerTimes = {
        date: today,
        hijriDate: `${data.date.hijri.date?.substring(0,2)} ${data.date.hijri.month.en} ${data.date.hijri.year} (${data.date.readable})`,
        fajr: this.formatTime(data.timings.Fajr),
        sunrise: this.formatTime(data.timings.Sunrise),
        dhuhr: this.formatTime(data.timings.Dhuhr),
        asr: this.formatTime(data.timings.Asr),
        maghrib: this.formatTime(data.timings.Maghrib),
        isha: this.formatTime(data.timings.Isha),
      };

      // Cache the result
      await this.cachePrayerTimes(prayerTimes);
      
      return prayerTimes;
    } catch (error: any) {
      // Try cache as fallback
      const cached = await this.getCachedPrayerTimes();
      if (cached) {
        return cached;
      }

      // More specific error messages
      if (error.message.includes('timeout')) {
        throw new Error('Koneksi timeout. Coba lagi dalam beberapa saat.');
      }
      
      if (error.message.includes('Network request failed')) {
        throw new Error('Tidak ada koneksi internet. Periksa koneksi Anda.');
      }
      
      if (error.message.includes('HTTP error')) {
        throw new Error('Server error. Coba lagi nanti.');
      }

      throw new Error('Gagal mengambil jadwal shalat.');
    }
  }

  // Fetch silently in background without throwing errors
  async fetchPrayerTimesInBackground(latitude: number, longitude: number): Promise<PrayerTimes | null> {
    try {
      const times = await this.getPrayerTimes(latitude, longitude, true);
      return times;
    } catch (error) {
      console.log('Background fetch failed (non-critical):', error);
      return null;
    }
  }

  async getCachedPrayerTimes(): Promise<PrayerTimes | null> {
    try {
      const cached = await AsyncStorage.getItem(STORAGE_KEY);
      if (!cached) return null;
      
      const parsed = JSON.parse(cached);
      return parsed;
    } catch (error) {
      return null;
    }
  }

  private formatTime(time: string): string {
    return time.split(' ')[0];
  }

  getPrayerList(times: PrayerTimes): PrayerTime[] {
    return [
      { name: 'Fajr', time: times.fajr, arabic: 'الفجر' },
      { name: 'Dhuhr', time: times.dhuhr, arabic: 'الظهر' },
      { name: 'Asr', time: times.asr, arabic: 'العصر' },
      { name: 'Maghrib', time: times.maghrib, arabic: 'المغرب' },
      { name: 'Isha', time: times.isha, arabic: 'العشاء' },
    ];
  }

  async getNextPrayer(times: PrayerTimes): Promise<{ name: string; time: string; timeUntil: string } | null> {
    const now = moment();
    const prayers = this.getPrayerList(times);

    for (const prayer of prayers) {
      const prayerTime = moment(prayer.time, 'HH:mm');
      
      if (prayerTime.isAfter(now)) {
        const duration = moment.duration(prayerTime.diff(now));
        const hours = Math.floor(duration.asHours());
        const minutes = duration.minutes();
        
        const hoursLabel = i18n.t('time.hours');
        const minutesLabel = i18n.t('time.minutes');
        
        return {
          name: prayer.name,
          time: prayer.time,
          timeUntil: hours > 0 
            ? `${hours}${hoursLabel} ${minutes}${minutesLabel}` 
            : `${minutes}${minutesLabel}`,
        };
      }
    }

    // All prayers have passed, next is Fajr tomorrow
    const fajr = prayers[0];
    
    return {
      name: fajr.name,
      time: fajr.time,
      timeUntil: i18n.t('time.tomorrow'),
    };
  }

  private async cachePrayerTimes(times: PrayerTimes): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(times));
    } catch (error) {
      // Silent fail
    }
  }

  async clearCache(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      // Silent fail
    }
  }

  // Test connection method for debugging
  async testConnection(): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      const testLat = 21.4225;
      const testLng = 39.8262;
      const dateStr = moment().format('DD-MM-YYYY');
      
      const url = `https://api.aladhan.com/v1/timings/${dateStr}?latitude=${testLat}&longitude=${testLng}&method=4`;
      
      const fetchPromise = fetch(url, {
        headers: {
          'Accept': 'application/json',
        }
      });
      
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), 10000);
      });
      
      const response = await Promise.race([fetchPromise, timeoutPromise]) as Response;
      
      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          message: `HTTP Error: ${response.status}`,
          details: errorText
        };
      }
      
      const data = await response.json();
      
      return {
        success: true,
        message: 'API connection successful',
        details: data
      };
      
    } catch (error: any) {
      return {
        success: false,
        message: error.message,
        details: {
          name: error.name
        }
      };
    }
  }
}

export const prayerTimesService = new PrayerTimesService();