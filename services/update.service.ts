import Constants from 'expo-constants';
import { Platform } from 'react-native';
import SpInAppUpdates, { IAUUpdateKind } from 'sp-react-native-in-app-updates';

const __DEV__ = process.env.NODE_ENV !== 'production';

class UpdateService {
  private inAppUpdates: SpInAppUpdates | null = null;
  private lastCheckTime = 0;
  private readonly CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

  private getInAppUpdates(): SpInAppUpdates | null {
    if (Platform.OS === 'web') return null;
    if (!this.inAppUpdates) {
      this.inAppUpdates = new SpInAppUpdates(__DEV__);
    }
    return this.inAppUpdates;
  }

  private getCurrentVersion(): string {
    return Constants.expoConfig?.version ?? '1.0.0';
  }

  async checkForUpdate(): Promise<{ shouldUpdate: boolean; storeVersion?: string }> {
    if (Platform.OS === 'web') return { shouldUpdate: false };

    const updates = this.getInAppUpdates();
    if (!updates) return { shouldUpdate: false };

    try {
      const curVersion = this.getCurrentVersion();
      const result = await updates.checkNeedsUpdate({ curVersion });

      if (result.shouldUpdate) {
        return { shouldUpdate: true, storeVersion: result.storeVersion };
      }
      return { shouldUpdate: false };
    } catch (error) {
      if (__DEV__) {
        console.log('Update check failed:', error);
      }
      return { shouldUpdate: false };
    }
  }

  async startUpdate(immediate = false): Promise<void> {
    if (Platform.OS === 'web') return;

    const updates = this.getInAppUpdates();
    if (!updates) return;

    try {
      const updateOptions =
        Platform.OS === 'android'
          ? { updateType: immediate ? IAUUpdateKind.IMMEDIATE : IAUUpdateKind.FLEXIBLE }
          : {};
      await updates.startUpdate(updateOptions);
    } catch (error) {
      if (__DEV__) {
        console.error('Start update failed:', error);
      }
      throw error;
    }
  }

  async checkAndPromptUpdate(): Promise<boolean> {
    const now = Date.now();
    if (now - this.lastCheckTime < this.CHECK_INTERVAL_MS) {
      return false;
    }
    this.lastCheckTime = now;

    const { shouldUpdate } = await this.checkForUpdate();
    if (shouldUpdate) {
      await this.startUpdate(false); // Use FLEXIBLE so user can keep using app
      return true;
    }
    return false;
  }
}

export const updateService = new UpdateService();
