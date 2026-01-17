import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { initWhisper, WhisperContext } from 'whisper.rn';

interface Word {
  text: string;
  status: 'pending' | 'correct' | 'incorrect' | 'current';
}

const MODEL_URL = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin';
const MODEL_SIZE_MB = 148;
const MODEL_NAME = 'ggml-base.bin';
const RECORDING_INTERVAL = 3000; // 3 seconds per word

export default function QuranPracticeScreen() {
  const { colorScheme } = useColorScheme();
  const [inputText, setInputText] = useState('');
  const [words, setWords] = useState<Word[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [whisperContext, setWhisperContext] = useState<WhisperContext | null>(null);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  
  const [modelDownloaded, setModelDownloaded] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [checkingModel, setCheckingModel] = useState(true);

  const recordingTimer = useRef<NodeJS.Timeout | any>(null);
  const modelPath = `${FileSystem.documentDirectory}${MODEL_NAME}`;

  useEffect(() => {
    checkModelExists();
    setupAudio();
    return () => {
      if (recording) {
        recording.stopAndUnloadAsync().catch(() => {});
      }
      if (whisperContext) {
        whisperContext.release().catch(() => {});
      }
      if (recordingTimer.current) {
        clearTimeout(recordingTimer.current);
      }
    };
  }, []);

  const checkModelExists = async () => {
    try {
      const fileInfo = await FileSystem.getInfoAsync(modelPath);
      setModelDownloaded(fileInfo.exists);
    } catch (error) {
      console.error('Error checking model:', error);
    } finally {
      setCheckingModel(false);
    }
  };

  const setupAudio = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Error', 'Izin mikrofon diperlukan');
        return;
      }
      
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
    } catch (error) {
      console.error('Error setting up audio:', error);
    }
  };

  const downloadModel = async () => {
    setIsDownloading(true);
    setDownloadProgress(0);

    try {
      const callback = (downloadProgress: FileSystem.DownloadProgressData) => {
        const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
        setDownloadProgress(Math.round(progress * 100));
      };

      const downloadResumable = FileSystem.createDownloadResumable(
        MODEL_URL,
        modelPath,
        {},
        callback
      );

      const result = await downloadResumable.downloadAsync();
      
      if (result && result.uri) {
        setModelDownloaded(true);
        Alert.alert('Berhasil', 'Fitur latihan baca Quran siap digunakan!');
      }
    } catch (error) {
      Alert.alert('Error', 'Gagal mengunduh model. Coba lagi nanti.');
      console.error('Download error:', error);
    } finally {
      setIsDownloading(false);
      setDownloadProgress(0);
    }
  };

  const deleteModel = async () => {
    Alert.alert(
      'Hapus Model',
      `Ini akan menghapus model AI (${MODEL_SIZE_MB}MB). Anda perlu mengunduh ulang untuk menggunakan fitur ini.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              await FileSystem.deleteAsync(modelPath);
              setModelDownloaded(false);
              if (whisperContext) {
                await whisperContext.release();
                setWhisperContext(null);
              }
              Alert.alert('Berhasil', 'Model berhasil dihapus');
            } catch (error) {
              Alert.alert('Error', 'Gagal menghapus model');
            }
          },
        },
      ]
    );
  };

  const initializeWhisper = async () => {
    if (whisperContext) return;
    if (!modelDownloaded) {
      Alert.alert('Error', 'Model belum diunduh. Silakan unduh fitur terlebih dahulu.');
      return;
    }

    setIsInitializing(true);

    try {
      const context = await initWhisper({
        filePath: modelPath,
      });
      
      setWhisperContext(context);
    } catch (error) {
      console.error('Error initializing Whisper:', error);
      Alert.alert(
        'Error Inisialisasi',
        'Gagal memuat model AI. Coba hapus dan download ulang model.',
        [
          { text: 'OK' },
          { 
            text: 'Hapus Model', 
            onPress: deleteModel,
            style: 'destructive' 
          }
        ]
      );
    } finally {
      setIsInitializing(false);
    }
  };

  const useSampleText = () => {
    const sampleText = 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ';
    setInputText(sampleText);
  };

  const startRecordingForWord = async () => {
    try {
      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.MINIMUM_BALANCE
      );
      setRecording(newRecording);
      
      recordingTimer.current = setTimeout(() => {
        processCurrentWord();
      }, RECORDING_INTERVAL);
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  };

  const stopCurrentRecording = async (): Promise<string | null> => {
    if (recordingTimer.current) {
      clearTimeout(recordingTimer.current);
    }

    if (!recording) return null;

    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
      return uri;
    } catch (error) {
      console.error('Failed to stop recording:', error);
      return null;
    }
  };

  const transcribeAudio = async (audioUri: string): Promise<string> => {
    if (!whisperContext) return '';

    try {
      const { promise } = whisperContext.transcribe(audioUri, {
        language: 'ar',
        maxLen: 1,
        tokenTimestamps: false,
        speedUp: false,
      });

      const { result } = await promise;
      return result.trim();
    } catch (error) {
      console.error('Transcription error:', error);
      return '';
    }
  };

  const checkWordMatch = (spokenText: string, expectedWord: string): boolean => {
    const normalized = spokenText.replace(/\s+/g, ' ').toLowerCase();
    const expected = expectedWord.toLowerCase();
    
    return normalized.includes(expected) || 
           expected.includes(normalized) ||
           normalized === expected;
  };

  const processCurrentWord = async () => {
    const audioUri = await stopCurrentRecording();
    
    if (!audioUri || currentWordIndex >= words.length) {
      completeSession();
      return;
    }

    const transcript = await transcribeAudio(audioUri);
    const currentWord = words[currentWordIndex];
    const isCorrect = checkWordMatch(transcript, currentWord.text);

    const newWords = [...words];
    newWords[currentWordIndex] = {
      ...currentWord,
      status: isCorrect ? 'correct' : 'incorrect',
    };
    setWords(newWords);

    if (isCorrect) {
      setScore(prev => ({ ...prev, correct: prev.correct + 1 }));
    }

    const nextIndex = currentWordIndex + 1;
    setCurrentWordIndex(nextIndex);
    setProgress(Math.round((nextIndex / words.length) * 100));

    if (nextIndex < words.length) {
      const updated = [...newWords];
      updated[nextIndex] = { ...updated[nextIndex], status: 'current' };
      setWords(updated);
      await startRecordingForWord();
    } else {
      completeSession();
    }
  };

  const completeSession = async () => {
    setIsRecording(false);
    setSessionComplete(true);
    
    if (recording) {
      await stopCurrentRecording();
    }
  };

  const startSession = async () => {
    if (!inputText.trim()) {
      Alert.alert('Error', 'Masukkan teks terlebih dahulu');
      return;
    }

    if (!whisperContext) {
      await initializeWhisper();
      if (!whisperContext) return;
    }

    const wordsArray = inputText.trim().split(/\s+/).map((text, index) => ({
      text,
      status: (index === 0 ? 'current' : 'pending') as Word['status'],
    }));

    setWords(wordsArray);
    setCurrentWordIndex(0);
    setProgress(0);
    setSessionComplete(false);
    setScore({ correct: 0, total: wordsArray.length });
    setIsRecording(true);

    await startRecordingForWord();
  };

  const stopSession = async () => {
    if (recordingTimer.current) {
      clearTimeout(recordingTimer.current);
    }

    if (recording) {
      await recording.stopAndUnloadAsync();
      setRecording(null);
    }

    setIsRecording(false);
  };

  const resetSession = () => {
    stopSession();
    setWords([]);
    setCurrentWordIndex(0);
    setProgress(0);
    setInputText('');
    setSessionComplete(false);
    setScore({ correct: 0, total: 0 });
  };

  const getScorePercentage = (): number => {
    if (score.total === 0) return 0;
    return Math.round((score.correct / score.total) * 100);
  };

  if (checkingModel) {
    return (
      <View className="flex-1 bg-white dark:bg-gray-900 items-center justify-center">
        <ActivityIndicator size="large" color="#0d9488" />
        <Text className="text-gray-600 dark:text-gray-400 mt-4">Memeriksa fitur...</Text>
      </View>
    );
  }

  if (!modelDownloaded) {
    return (
      <ScrollView className="flex-1 bg-white dark:bg-gray-900">
        <View className="px-4 pt-16 pb-6">
          <View className="items-center mb-8">
            <View className="w-20 h-20 bg-teal-600 dark:bg-teal-700 rounded-full items-center justify-center mb-4 shadow-lg">
              <IconSymbol size={40} name="mic" color="#FFFFFF" />
            </View>
            <Text className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Latihan Baca Quran
            </Text>
            <Text className="text-center text-gray-600 dark:text-gray-400">
              Latih bacaan Quran dengan bantuan AI
            </Text>
          </View>

          <LinearGradient
            colors={colorScheme === 'dark' ? ['#115e59', '#134e4a'] : ['#0d9488', '#0f766e']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ borderRadius: 24, padding: 24, marginBottom: 24 }}
          >
            <View className="items-center">
              <IconSymbol size={64} name="cloud-download" color="#FFFFFF" />
              <Text className="text-white text-2xl font-bold mt-4 mb-2 text-center">
                Download Fitur
              </Text>
              <Text className="text-teal-50 text-center mb-4">
                Fitur ini memerlukan AI model untuk mengenali bacaan Quran Anda
              </Text>
              <View className="bg-white/20 rounded-xl p-3 w-full">
                <Text className="text-white text-center font-semibold">
                  Ukuran: {MODEL_SIZE_MB}MB
                </Text>
              </View>
            </View>
          </LinearGradient>

          {isDownloading ? (
            <View className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-md border border-gray-100 dark:border-gray-700 mb-6">
              <Text className="text-lg font-bold text-gray-900 dark:text-white mb-4 text-center">
                Mengunduh Patch Fitur...
              </Text>
              <View className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full mb-3 overflow-hidden">
                <View 
                  className="h-full bg-teal-600 dark:bg-teal-500 rounded-full transition-all"
                  style={{ width: `${downloadProgress}%` }}
                />
              </View>
              <Text className="text-center text-teal-600 dark:text-teal-500 font-bold text-lg">
                {downloadProgress}%
              </Text>
              <Text className="text-center text-gray-500 dark:text-gray-400 text-sm mt-2">
                {(MODEL_SIZE_MB * downloadProgress / 100).toFixed(1)}MB / {MODEL_SIZE_MB}MB
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              onPress={downloadModel}
              className="bg-teal-600 dark:bg-teal-700 rounded-2xl py-5 shadow-lg mb-6"
            >
              <View className="flex-row items-center justify-center">
                <IconSymbol size={24} name="cloud-download" color="#FFFFFF" />
                <Text className="text-white font-bold text-lg ml-2">
                  Download Fitur ({MODEL_SIZE_MB}MB)
                </Text>
              </View>
            </TouchableOpacity>
          )}

          <View className="bg-amber-50 dark:bg-amber-950 rounded-2xl p-6 border border-amber-500">
            <View className="flex-row items-center mb-3">
              <IconSymbol size={24} name="info" color="#F59E0B" />
              <Text className="text-lg font-semibold text-gray-900 dark:text-white ml-2">
                Catatan
              </Text>
            </View>
            <Text className="text-gray-700 dark:text-gray-300 leading-6">
              • Pastikan koneksi internet stabil{'\n'}
              • Download menggunakan {MODEL_SIZE_MB}MB data{'\n'}
              • Model hanya diunduh sekali{'\n'}
              • Bisa dihapus kapan saja dari pengaturan
            </Text>
          </View>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView className="flex-1 bg-white dark:bg-gray-900">
      <View className="px-4 pt-16 pb-6">
        <View className="items-center mb-8">
          <View className="w-20 h-20 bg-teal-600 dark:bg-teal-700 rounded-full items-center justify-center mb-4 shadow-lg">
            <IconSymbol size={40} name="mic" color="#FFFFFF" />
          </View>
          <Text className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Latihan Baca Quran
          </Text>
          <Text className="text-center text-gray-600 dark:text-gray-400">
            Latih bacaan Quran dengan bantuan AI
          </Text>
        </View>

        {isInitializing && (
          <View className="bg-blue-50 dark:bg-blue-950 rounded-2xl p-6 mb-6">
            <ActivityIndicator size="large" color="#0d9488" />
            <Text className="text-center text-gray-900 dark:text-white mt-4 font-semibold">
              Memuat AI model...
            </Text>
          </View>
        )}

        <View className="bg-teal-600 dark:bg-teal-700 rounded-3xl p-6 mb-6 shadow-lg">
          <Text className="text-white text-xl font-bold mb-3">
            Cara Menggunakan
          </Text>
          <Text className="text-teal-50">
            1. Ketik atau gunakan teks Quran{'\n'}
            2. Tekan Mulai dan baca kata demi kata{'\n'}
            3. Sistem akan otomatis mendeteksi setiap kata{'\n'}
            4. Hijau = benar, Merah = salah
          </Text>
        </View>

        <View className="mb-6">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-lg font-bold text-gray-900 dark:text-white">
              Teks Quran
            </Text>
            <TouchableOpacity onPress={deleteModel}>
              <Text className="text-red-600 dark:text-red-500 text-sm">
                Hapus Model
              </Text>
            </TouchableOpacity>
          </View>
          <View className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-200 dark:border-gray-700 mb-3">
            <TextInput
              value={inputText}
              onChangeText={setInputText}
              placeholder="Masukkan teks Arab di sini..."
              placeholderTextColor="#9CA3AF"
              multiline
              className="text-gray-900 dark:text-white text-lg min-h-24 text-right"
              editable={!isRecording}
            />
          </View>
          <TouchableOpacity
            onPress={useSampleText}
            className="self-end"
            disabled={isRecording}
          >
            <Text className={`text-teal-600 dark:text-teal-500 font-semibold ${isRecording ? 'opacity-50' : ''}`}>
              Gunakan Contoh (Bismillah)
            </Text>
          </TouchableOpacity>
        </View>

        {words.length > 0 && (
          <View className="mb-6">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-lg font-bold text-gray-900 dark:text-white">
                Progress
              </Text>
              <Text className="text-teal-600 dark:text-teal-500 font-bold">
                {progress}%
              </Text>
            </View>
            
            <View className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full mb-4">
              <View 
                className="h-full bg-teal-600 dark:bg-teal-500 rounded-full"
                style={{ width: `${progress}%` }}
              />
            </View>

            <View className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
              <View className="flex-row flex-wrap gap-2 justify-end">
                {words.map((word, index) => (
                  <View
                    key={index}
                    className={`px-4 py-2 rounded-xl ${
                      word.status === 'correct'
                        ? 'bg-green-600 dark:bg-green-700'
                        : word.status === 'incorrect'
                        ? 'bg-red-600 dark:bg-red-700'
                        : word.status === 'current'
                        ? 'bg-amber-500 dark:bg-amber-600'
                        : 'bg-gray-100 dark:bg-gray-700'
                    }`}
                  >
                    <Text
                      className={`text-lg font-bold ${
                        word.status !== 'pending'
                          ? 'text-white'
                          : 'text-gray-900 dark:text-white'
                      }`}
                    >
                      {word.text}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}

        {sessionComplete && (
          <View className="mb-6">
            <LinearGradient
              colors={colorScheme === 'dark' ? ['#115e59', '#134e4a'] : ['#0d9488', '#0f766e']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ borderRadius: 24, padding: 24 }}
            >
              <View className="items-center">
                <IconSymbol size={64} name="check-circle" color="#FFFFFF" />
                <Text className="text-white text-2xl font-bold mt-4">
                  Sesi Selesai!
                </Text>
                <View className="bg-white/20 rounded-xl p-6 w-full mt-4">
                  <Text className="text-white text-center text-lg mb-2">
                    Skor Anda
                  </Text>
                  <Text className="text-white text-center text-5xl font-bold">
                    {getScorePercentage()}%
                  </Text>
                  <Text className="text-teal-50 text-center mt-2">
                    {score.correct} dari {score.total} kata benar
                  </Text>
                </View>
              </View>
            </LinearGradient>
          </View>
        )}

        {!sessionComplete && words.length > 0 && (
          <View className="mb-6">
            <Text className="text-lg font-bold text-gray-900 dark:text-white mb-3">
              Status
            </Text>
            <View className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
              <View className="flex-row items-center mb-3">
                <View className={`w-3 h-3 rounded-full mr-3 ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-gray-400'}`} />
                <Text className="text-gray-900 dark:text-white font-semibold">
                  {isRecording ? 'Mendengarkan...' : 'Siap'}
                </Text>
              </View>
              {isRecording && currentWordIndex < words.length && (
                <View className="mt-3 bg-amber-50 dark:bg-amber-950 rounded-xl p-4">
                  <Text className="text-amber-900 dark:text-amber-100 font-semibold mb-2">
                    Kata Saat Ini ({currentWordIndex + 1}/{words.length})
                  </Text>
                  <Text className="text-3xl font-bold text-amber-600 dark:text-amber-400 text-right">
                    {words[currentWordIndex].text}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        <View className="flex-row gap-3 mb-6">
          {!isRecording ? (
            <>
              <TouchableOpacity
                onPress={startSession}
                disabled={!inputText.trim() || isInitializing}
                className={`flex-1 rounded-2xl py-4 shadow-lg ${
                  inputText.trim() && !isInitializing
                    ? 'bg-teal-600 dark:bg-teal-700'
                    : 'bg-gray-300 dark:bg-gray-700'
                }`}
              >
                <View className="flex-row items-center justify-center">
                  <IconSymbol size={24} name="play-arrow" color="#FFFFFF" />
                  <Text className="text-white font-bold text-lg ml-2">
                    Mulai
                  </Text>
                </View>
              </TouchableOpacity>
              {words.length > 0 && (
                <TouchableOpacity
                  onPress={resetSession}
                  className="bg-gray-600 dark:bg-gray-700 rounded-2xl py-4 px-6 shadow-lg"
                >
                  <IconSymbol size={24} name="refresh" color="#FFFFFF" />
                </TouchableOpacity>
              )}
            </>
          ) : (
            <TouchableOpacity
              onPress={stopSession}
              className="flex-1 bg-red-600 dark:bg-red-700 rounded-2xl py-4 shadow-lg"
            >
              <View className="flex-row items-center justify-center">
                <IconSymbol size={24} name="stop" color="#FFFFFF" />
                <Text className="text-white font-bold text-lg ml-2">
                  Berhenti
                </Text>
              </View>
            </TouchableOpacity>
          )}
        </View>

        <View className="bg-teal-50 dark:bg-teal-950 rounded-2xl p-6">
          <View className="flex-row items-center mb-3">
            <IconSymbol size={24} name="info" color="#0d9488" />
            <Text className="text-lg font-semibold text-gray-900 dark:text-white ml-2">
              Tips
            </Text>
          </View>
          <Text className="text-gray-700 dark:text-gray-300 leading-6">
            Bacalah kata demi kata dengan jelas. Sistem akan otomatis mendeteksi dan memberikan feedback untuk setiap kata yang Anda ucapkan.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}