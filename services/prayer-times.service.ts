import AsyncStorage from '@react-native-async-storage/async-storage';

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

const STORAGE_KEY = '@prayer_times';
const CACHE_DURATION = 24 * 60 * 60 * 1000;

class PrayerTimesService {
  private async fetchPrayerTimes(latitude: number, longitude: number, method: number = 20): Promise<PrayerTimesResponse> {
    const today = new Date();
    const day = today.getDate();
    const month = today.getMonth() + 1;
    const year = today.getFullYear();

    const url = `https://api.aladhan.com/v1/timings/${day}-${month}-${year}?latitude=${latitude}&longitude=${longitude}&method=${method}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed to fetch prayer times');
    }

    return response.json();
  }

  async getPrayerTimes(latitude: number, longitude: number): Promise<PrayerTimes> {
    try {
      const cached = await this.getCachedPrayerTimes();
      const today = new Date().toDateString();

      if (cached && cached.date === today) {
        return cached;
      }

      const response = await this.fetchPrayerTimes(latitude, longitude);
      const data = response.data;

      // console.log('Fetched prayer times from API:', data);

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

      await this.cachePrayerTimes(prayerTimes);
      return prayerTimes;
    } catch (error) {
      console.error('Error fetching prayer times:', error);
      const cached = await this.getCachedPrayerTimes();
      if (cached) {
        return cached;
      }
      throw error;
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
    const now = new Date();
    const prayers = this.getPrayerList(times);

    for (const prayer of prayers) {
      const [hours, minutes] = prayer.time.split(':').map(Number);
      const prayerTime = new Date();
      prayerTime.setHours(hours, minutes, 0, 0);

      if (prayerTime > now) {
        const diff = prayerTime.getTime() - now.getTime();
        const hoursUntil = Math.floor(diff / (1000 * 60 * 60));
        const minutesUntil = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        
        return {
          name: prayer.name,
          time: prayer.time,
          timeUntil: hoursUntil > 0 ? `${hoursUntil}j ${minutesUntil}m` : `${minutesUntil}m`,
        };
      }
    }

    const fajr = prayers[0];
    return {
      name: fajr.name,
      time: fajr.time,
      timeUntil: 'Besok',
    };
  }

  private async cachePrayerTimes(times: PrayerTimes): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(times));
    } catch (error) {
      console.error('Error caching prayer times:', error);
    }
  }

  private async getCachedPrayerTimes(): Promise<PrayerTimes | null> {
    try {
      const cached = await AsyncStorage.getItem(STORAGE_KEY);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error('Error reading cached prayer times:', error);
      return null;
    }
  }
}

export const prayerTimesService = new PrayerTimesService();