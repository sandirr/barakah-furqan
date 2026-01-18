import { createMMKV } from 'react-native-mmkv';

// Create MMKV instances using the new API
export const quranStorage = createMMKV({
  id: 'quran-storage',
  // encryptionKey: 'barakah-quran-secure-key', // Optional encryption
});

export const settingsStorage = createMMKV({
  id: 'settings-storage',
});

// Helper functions for Quran storage
export const storage = {
  // String operations
  set: (key: string, value: string): void => {
    quranStorage.set(key, value);
  },
  
  getString: (key: string): string | undefined => {
    return quranStorage.getString(key);
  },
  
  // Object operations (JSON)
  setObject: <T>(key: string, value: T): void => {
    quranStorage.set(key, JSON.stringify(value));
  },
  
  getObject: <T>(key: string): T | undefined => {
    const value = quranStorage.getString(key);
    return value ? JSON.parse(value) as T : undefined;
  },
  
  // Number operations
  setNumber: (key: string, value: number): void => {
    quranStorage.set(key, value);
  },
  
  getNumber: (key: string): number | undefined => {
    return quranStorage.getNumber(key);
  },
  
  // Boolean operations
  setBoolean: (key: string, value: boolean): void => {
    quranStorage.set(key, value);
  },
  
  getBoolean: (key: string): boolean | undefined => {
    return quranStorage.getBoolean(key);
  },
  
  // Delete
  delete: (key: string): void => {
    quranStorage.remove(key);
  },
  
  // Check existence
  contains: (key: string): boolean => {
    return quranStorage.contains(key);
  },
  
  // Get all keys
  getAllKeys: (): string[] => {
    return quranStorage.getAllKeys();
  },
  
  // Clear all
  clearAll: (): void => {
    quranStorage.clearAll();
  },
  
  // Get storage size (estimated)
  getSize: (): number => {
    const keys = quranStorage.getAllKeys();
    let totalSize = 0;
    
    keys.forEach(key => {
      const value = quranStorage.getString(key);
      if (value) {
        totalSize += value.length * 2; // UTF-16 encoding
      }
    });
    
    return totalSize;
  },
  
  // Get detailed stats
  getStats: (): {
    totalKeys: number;
    totalSize: number;
    sizeInKB: number;
    sizeInMB: number;
  } => {
    const totalKeys = quranStorage.getAllKeys().length;
    const totalSize = storage.getSize();
    
    return {
      totalKeys,
      totalSize,
      sizeInKB: totalSize / 1024,
      sizeInMB: totalSize / 1024 / 1024,
    };
  },
};

// Settings storage helpers
export const settings = {
  set: (key: string, value: string): void => {
    settingsStorage.set(key, value);
  },
  
  getString: (key: string): string | undefined => {
    return settingsStorage.getString(key);
  },
  
  setObject: <T>(key: string, value: T): void => {
    settingsStorage.set(key, JSON.stringify(value));
  },
  
  getObject: <T>(key: string): T | undefined => {
    const value = settingsStorage.getString(key);
    return value ? JSON.parse(value) as T : undefined;
  },
  
  setNumber: (key: string, value: number): void => {
    settingsStorage.set(key, value);
  },
  
  getNumber: (key: string): number | undefined => {
    return settingsStorage.getNumber(key);
  },
  
  setBoolean: (key: string, value: boolean): void => {
    settingsStorage.set(key, value);
  },
  
  getBoolean: (key: string): boolean | undefined => {
    return settingsStorage.getBoolean(key);
  },
  
  delete: (key: string): void => {
    settingsStorage.remove(key);
  },
  
  contains: (key: string): boolean => {
    return settingsStorage.contains(key);
  },
  
  getAllKeys: (): string[] => {
    return settingsStorage.getAllKeys();
  },
  
  clearAll: (): void => {
    settingsStorage.clearAll();
  },
};