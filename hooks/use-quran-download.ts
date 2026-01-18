import { DownloadProgress, DownloadStatus, quranService } from '@/services/quran.service';
import { useEffect, useState } from 'react';

export function useQuranDownload() {
  const [downloadStatus, setDownloadStatus] = useState<DownloadStatus | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = () => {
    // No more await - methods are now synchronous
    const status = quranService.getDownloadStatus();
    const progress = quranService.getDownloadProgress();
    setDownloadStatus(status);
    setDownloadProgress(progress);
    setIsDownloading(progress?.isDownloading ?? false);
  };

  const startDownload = async (languages: string[]) => {
    setIsDownloading(true);
    try {
      await quranService.downloadAllSurahsForLanguages(languages, (progress) => {
        setDownloadProgress(progress);
      });
      loadStatus(); // No await needed
    } catch (error) {
      console.error('Download failed:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  const clearCache = () => {
    // No more await - clearCache is now synchronous
    quranService.clearCache();
    loadStatus(); // No await needed
  };

  return {
    downloadStatus,
    downloadProgress,
    isDownloading,
    startDownload,
    clearCache,
    refresh: loadStatus,
  };
}