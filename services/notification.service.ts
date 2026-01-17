import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import * as Notifications from 'expo-notifications';
import { PrayerTimes } from './prayer-times.service';

const NOTIFICATION_ENABLED_KEY = '@notification_enabled';
const ADHAN_ENABLED_KEY = '@adhan_enabled';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

class NotificationService {
  private sound: Audio.Sound | null = null;

  async requestPermissions(): Promise<boolean> {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    return finalStatus === 'granted';
  }

  async scheduleAllPrayerNotifications(prayerTimes: PrayerTimes): Promise<void> {
    await this.cancelAllNotifications();

    const isEnabled = await this.isNotificationEnabled();
    if (!isEnabled) return;

    const prayers = [
      { name: 'Subuh', time: prayerTimes.fajr, id: 'fajr' },
      { name: 'Dzuhur', time: prayerTimes.dhuhr, id: 'dhuhr' },
      { name: 'Ashar', time: prayerTimes.asr, id: 'asr' },
      { name: 'Maghrib', time: prayerTimes.maghrib, id: 'maghrib' },
      { name: 'Isya', time: prayerTimes.isha, id: 'isha' },
    ];

    for (const prayer of prayers) {
      await this.schedulePrayerNotification(prayer.name, prayer.time, prayer.id);
    }
  }

  private async schedulePrayerNotification(
    prayerName: string,
    prayerTime: string,
    identifier: string
  ): Promise<void> {
    try {
      const [hours, minutes] = prayerTime.split(':').map(Number);

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: `Waktu ${prayerName}`,
          body: `Saatnya menunaikan shalat ${prayerName}`,
          data: { prayerName, identifier },
          sound: false,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: hours,
          minute: minutes,
        },
        identifier,
      });

      // console.log(`Scheduled ${prayerName} notification at ${prayerTime} with ID: ${notificationId}`);
    } catch (error) {
      console.error(`Failed to schedule ${prayerName} notification:`, error);
    }
  }

  async testNotification(): Promise<void> {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Test Notifikasi',
          body: 'Notifikasi berfungsi dengan baik! ✅',
          data: { test: true },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: 2,
        },
      });
      console.log('Test notification scheduled in 2 seconds');
    } catch (error) {
      console.error('Failed to schedule test notification:', error);
      throw error;
    }
  }

  async getScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
    const notifications = await Notifications.getAllScheduledNotificationsAsync();
    // console.log('Scheduled notifications:', notifications.length);
    notifications.forEach(notif => {
      console.log(`- ${notif.identifier}:`, notif.trigger);
    });
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