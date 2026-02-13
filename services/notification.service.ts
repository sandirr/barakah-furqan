import i18n from '@/i18n';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { PrayerTimes } from './prayer-times.service';

const NOTIFICATION_ENABLED_KEY = '@notification_enabled';
const ADHAN_ENABLED_KEY = '@adhan_enabled';
const PRAYER_NOTIFICATION_SETTINGS_KEY = '@prayer_notification_settings';
const SAHUR_NOTIFICATION_ENABLED_KEY = '@sahur_notification_enabled';
const SAHUR_OFFSET_MINUTES_KEY = '@sahur_offset_minutes';

const DEFAULT_PRAYER_SETTINGS: Record<string, boolean> = {
  fajr: true,
  dhuhr: true,
  asr: true,
  maghrib: true,
  isha: true,
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

class NotificationService {
  private sound: Audio.Sound | null = null;

  async requestPermissions(): Promise<boolean> {
    await this.ensureNotificationChannels();
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    return finalStatus === 'granted';
  }

  private async ensureNotificationChannels(): Promise<void> {
    if (Platform.OS !== 'android') return;

    try {
      await Notifications.setNotificationChannelAsync('prayer', {
        name: 'Prayer Notifications',
        importance: Notifications.AndroidImportance.MAX,
        sound: 'adzan.mp3',
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#16a34a',
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });

      await Notifications.setNotificationChannelAsync('sahur', {
        name: 'Sahur Notifications',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
        vibrationPattern: [0, 200, 200, 200],
        lightColor: '#f59e0b',
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
    } catch (error) {
      console.error('Failed to set notification channels:', error);
    }
  }

  async scheduleAllPrayerNotifications(
    prayerTimes: PrayerTimes,
    options?: { includeSahur?: boolean; sahurOffsetMinutes?: number; isRamadanWindow?: boolean }
  ): Promise<void> {
    await this.cancelAllNotifications();

    const settings = await this.getPrayerNotificationSettings();
    const prayers = [
      { key: 'fajr', time: prayerTimes.fajr, id: 'fajr' },
      { key: 'dhuhr', time: prayerTimes.dhuhr, id: 'dhuhr' },
      { key: 'asr', time: prayerTimes.asr, id: 'asr' },
      { key: 'maghrib', time: prayerTimes.maghrib, id: 'maghrib' },
      { key: 'isha', time: prayerTimes.isha, id: 'isha' },
    ];

    for (const prayer of prayers) {
      if (settings[prayer.id]) {
        await this.schedulePrayerNotification(prayer.key, prayer.time, prayer.id);
      }
    }

    if (options?.includeSahur && options.isRamadanWindow) {
      await this.scheduleSahurNotification(
        prayerTimes,
        options.sahurOffsetMinutes ?? 60
      );
    }
  }

  private async schedulePrayerNotification(
    prayerKey: string,
    prayerTime: string,
    identifier: string
  ): Promise<void> {
    const prayerName = i18n.t(`shalat.${prayerKey}`);
    try {
      const [hours, minutes] = prayerTime.split(':').map(Number);

      const content = {
        title: i18n.t('shalat.notificationTitle', { prayer: prayerName }),
        body: i18n.t('shalat.notificationBody', { prayer: prayerName }),
        data: { prayerName, identifier: `prayer_${identifier}`, type: 'prayer' },
        sound: 'adzan.mp3',
        channelId: 'prayer',
      } as Notifications.NotificationContentInput & { channelId: string };

      const notificationId = await Notifications.scheduleNotificationAsync({
        content,
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: hours,
          minute: minutes,
        },
        identifier: `prayer_${identifier}`,
      });

      // console.log(`Scheduled ${prayerName} notification at ${prayerTime} with ID: ${notificationId}`);
    } catch (error) {
      console.error(`Failed to schedule ${prayerName} notification:`, error);
    }
  }

  async scheduleSinglePrayerNotification(prayerTimes: PrayerTimes, id: string): Promise<void> {
    const map: Record<string, { key: string; time: string }> = {
      fajr: { key: 'fajr', time: prayerTimes.fajr },
      dhuhr: { key: 'dhuhr', time: prayerTimes.dhuhr },
      asr: { key: 'asr', time: prayerTimes.asr },
      maghrib: { key: 'maghrib', time: prayerTimes.maghrib },
      isha: { key: 'isha', time: prayerTimes.isha },
    };

    const prayer = map[id];
    if (!prayer) return;
    await this.schedulePrayerNotification(prayer.key, prayer.time, id);
  }

  async cancelPrayerNotification(id: string): Promise<void> {
    try {
      await Notifications.cancelScheduledNotificationAsync(`prayer_${id}`);
    } catch (error) {
      // Ignore if not found
    }
  }

  async scheduleSahurNotification(prayerTimes: PrayerTimes, offsetMinutes: number): Promise<void> {
    try {
      const sahurTime = this.getSahurTime(prayerTimes, offsetMinutes);
      if (!sahurTime) return;

      const [hours, minutes] = sahurTime.split(':').map(Number);

      const content = {
        title: i18n.t('shalat.sahurNotificationTitle'),
        body: i18n.t('shalat.sahurNotificationBody'),
        data: { identifier: 'sahur', type: 'sahur' },
        sound: 'default',
        channelId: 'sahur',
      } as Notifications.NotificationContentInput & { channelId: string };

      await Notifications.scheduleNotificationAsync({
        content,
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: hours,
          minute: minutes,
        },
        identifier: 'sahur',
      });
    } catch (error) {
      console.error('Failed to schedule sahur notification:', error);
    }
  }

  async cancelSahurNotification(): Promise<void> {
    try {
      await Notifications.cancelScheduledNotificationAsync('sahur');
    } catch (error) {
      // Ignore if not found
    }
  }

  getSahurTime(prayerTimes: PrayerTimes, offsetMinutes: number): string | null {
    const [fajrHour, fajrMinute] = prayerTimes.fajr.split(':').map(Number);
    const fajrTotal = fajrHour * 60 + fajrMinute;
    const clampedOffset = Math.min(Math.max(offsetMinutes, 0), fajrTotal);
    const sahurTotal = Math.max(fajrTotal - clampedOffset, 0);
    const hours = Math.floor(sahurTotal / 60);
    const minutes = sahurTotal % 60;

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  async testNotification(): Promise<void> {
    try {
      const content = {
        title: 'Test Notifikasi',
        body: 'Notifikasi berfungsi dengan baik! ✅',
        data: { test: true, identifier: 'prayer_test', type: 'prayer' },
        sound: 'adzan.mp3',
        channelId: 'prayer',
      } as Notifications.NotificationContentInput & { channelId: string };

      await Notifications.scheduleNotificationAsync({
        content,
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: 2,
        },
      });
      // console.log('Test notification scheduled in 2 seconds');
    } catch (error) {
      console.error('Failed to schedule test notification:', error);
      throw error;
    }
  }

  async getScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
    const notifications = await Notifications.getAllScheduledNotificationsAsync();
    // console.log('Scheduled notifications:', notifications.length);
    // notifications.forEach(notif => {
    //   console.log(`- ${notif.identifier}:`, notif.trigger);
    // });
    return notifications;
  }

  async cancelAllNotifications(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
  }

  async playAdhan(): Promise<void> {
    try {
      const isEnabled = await this.isAdhanEnabled();
      if (!isEnabled) return;

      if (this.sound) {
        await this.sound.unloadAsync();
      }

      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
      });

      const { sound } = await Audio.Sound.createAsync(
        require('../assets/adzan.mp3'),
        { shouldPlay: true, volume: 1.0 }
      );

      this.sound = sound;

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync();
        }
      });
    } catch (error) {
      console.error('Error playing adhan:', error);
    }
  }

  async stopAdhan(): Promise<void> {
    if (this.sound) {
      await this.sound.stopAsync();
      await this.sound.unloadAsync();
      this.sound = null;
    }
  }

  async setNotificationEnabled(enabled: boolean): Promise<void> {
    await AsyncStorage.setItem(NOTIFICATION_ENABLED_KEY, JSON.stringify(enabled));
  }

  async isNotificationEnabled(): Promise<boolean> {
    try {
      const value = await AsyncStorage.getItem(NOTIFICATION_ENABLED_KEY);
      return value ? JSON.parse(value) : true;
    } catch {
      return true;
    }
  }

  async getPrayerNotificationSettings(): Promise<Record<string, boolean>> {
    try {
      const value = await AsyncStorage.getItem(PRAYER_NOTIFICATION_SETTINGS_KEY);
      if (!value) return { ...DEFAULT_PRAYER_SETTINGS };
      const parsed = JSON.parse(value);
      return { ...DEFAULT_PRAYER_SETTINGS, ...parsed };
    } catch {
      return { ...DEFAULT_PRAYER_SETTINGS };
    }
  }

  async setPrayerNotificationEnabled(prayerId: string, enabled: boolean): Promise<void> {
    const settings = await this.getPrayerNotificationSettings();
    settings[prayerId] = enabled;
    await AsyncStorage.setItem(PRAYER_NOTIFICATION_SETTINGS_KEY, JSON.stringify(settings));
  }

  async isSahurNotificationEnabled(): Promise<boolean> {
    try {
      const value = await AsyncStorage.getItem(SAHUR_NOTIFICATION_ENABLED_KEY);
      return value ? JSON.parse(value) : true;
    } catch {
      return true;
    }
  }

  async setSahurNotificationEnabled(enabled: boolean): Promise<void> {
    await AsyncStorage.setItem(SAHUR_NOTIFICATION_ENABLED_KEY, JSON.stringify(enabled));
  }

  async getSahurOffsetMinutes(): Promise<number> {
    try {
      const value = await AsyncStorage.getItem(SAHUR_OFFSET_MINUTES_KEY);
      const parsed = value ? Number(JSON.parse(value)) : 60;
      return Number.isFinite(parsed) ? parsed : 60;
    } catch {
      return 60;
    }
  }

  async setSahurOffsetMinutes(minutes: number): Promise<void> {
    await AsyncStorage.setItem(SAHUR_OFFSET_MINUTES_KEY, JSON.stringify(minutes));
  }

  async setAdhanEnabled(enabled: boolean): Promise<void> {
    await AsyncStorage.setItem(ADHAN_ENABLED_KEY, JSON.stringify(enabled));
  }

  async isAdhanEnabled(): Promise<boolean> {
    try {
      const value = await AsyncStorage.getItem(ADHAN_ENABLED_KEY);
      return value ? JSON.parse(value) : true;
    } catch {
      return true;
    }
  }
}

export const notificationService = new NotificationService();