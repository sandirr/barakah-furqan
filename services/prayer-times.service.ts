import i18n from '@/i18n';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PrayerTimes as AdhanPrayerTimes, CalculationMethod, Coordinates } from 'adhan';
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

const STORAGE_KEY = '@prayer_times';
const USE_OFFLINE_MODE_KEY = '@use_offline_prayer';

class PrayerTimesService {
  private useOfflineMode: boolean = false;

  constructor() {
    this.loadOfflinePreference();
  }

  private async loadOfflinePreference() {
    try {
      const pref = await AsyncStorage.getItem(USE_OFFLINE_MODE_KEY);
      this.useOfflineMode = pref === 'true';
    } catch (error) {
      console.error('Error loading offline preference:', error);
    }
  }

  async setOfflineMode(enabled: boolean) {
    this.useOfflineMode = enabled;
    await AsyncStorage.setItem(USE_OFFLINE_MODE_KEY, enabled.toString());
  }

  private calculateOfflinePrayerTimes(latitude: number, longitude: number): PrayerTimes {
    const coordinates = new Coordinates(latitude, longitude);
    const date = new Date();
    const params = CalculationMethod.MuslimWorldLeague();
    const prayerTimes = new AdhanPrayerTimes(coordinates, date, params);

    const today = moment().format('YYYY-MM-DD');

    return {
      date: today,
      hijriDate: moment().format('DD MMMM YYYY'),
      fajr: moment(prayerTimes.fajr).format('HH:mm'),
      sunrise: moment(prayerTimes.sunrise).format('HH:mm'),
      dhuhr: moment(prayerTimes.dhuhr).format('HH:mm'),
      asr: moment(prayerTimes.asr).format('HH:mm'),
      maghrib: moment(prayerTimes.maghrib).format('HH:mm'),
      isha: moment(prayerTimes.isha).format('HH:mm'),
    };
  }

  private async fetchPrayerTimes(latitude: number, longitude: number, method: number = 20): Promise<PrayerTimesResponse> {
    const today = new Date();
    const day = today.getDate();
    const month = today.getMonth() + 1;
    const year = today.getFullYear();

    const url = `https://api.aladhan.com/v1/timings/${day}-${month}-${year}?latitude=${latitude}&longitude=${longitude}&method=${method}`;
    
    const response = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!response.ok) {
      throw new Error('Failed to fetch prayer times');
    }

    return response.json();
  }

  async getPrayerTimes(latitude: number, longitude: number): Promise<PrayerTimes> {
    if (this.useOfflineMode) {
      const offlineTimes = this.calculateOfflinePrayerTimes(latitude, longitude);
      await this.cachePrayerTimes(offlineTimes);
      return offlineTimes;
    }

    try {
      const cached = await this.getCachedPrayerTimes();
      const today = moment().format('YYYY-MM-DD');

      if (cached && cached.date === today) {
        this.fetchPrayerTimes(latitude, longitude)
          .then(response => {
            const prayerTimes: PrayerTimes = {
              date: today,
              hijriDate: `${response.data.date.hijri.date?.substring(0,2)} ${response.data.date.hijri.month.en} ${response.data.date.hijri.year} (${response.data.date.readable})`,
              fajr: this.formatTime(response.data.timings.Fajr),
              sunrise: this.formatTime(response.data.timings.Sunrise),
              dhuhr: this.formatTime(response.data.timings.Dhuhr),
              asr: this.formatTime(response.data.timings.Asr),
              maghrib: this.formatTime(response.data.timings.Maghrib),
              isha: this.formatTime(response.data.timings.Isha),
            };
            this.cachePrayerTimes(prayerTimes);
          })
          .catch(() => {});
        return cached;
      }

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

      await this.cachePrayerTimes(prayerTimes);
      return prayerTimes;
    } catch (error) {
      console.error('API failed, falling back to offline calculation:', error);
      
      const cached = await this.getCachedPrayerTimes();
      if (cached) {
        return cached;
      }

      // return this.calculateOfflinePrayerTimes(latitude, longitude);
      throw new Error('No data available');
    }
  }

  async getCachedPrayerTimes(): Promise<PrayerTimes | null> {
    try {
      const cached = await AsyncStorage.getItem(STORAGE_KEY);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error('Error reading cached prayer times:', error);
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
      console.error('Error caching prayer times:', error);
    }
  }
}

export const prayerTimesService = new PrayerTimesService();