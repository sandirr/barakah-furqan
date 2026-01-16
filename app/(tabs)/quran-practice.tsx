import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { initWhisper, WhisperContext } from 'whisper.rn';

interface Word {
  text: string;
  highlighted: boolean;
  spoken: boolean;
}

const MODEL_URL = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin';
const MODEL_SIZE_MB = 148;
const MODEL_NAME = 'ggml-base.bin';

export default function QuranPracticeScreen() {
  const { colorScheme } = useColorScheme();
  const [inputText, setInputText] = useState('');
  const [words, setWords] = useState<Word[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [progress, setProgress] = useState(0);
  const [whisperContext, setWhisperContext] = useState<WhisperContext | null>(null);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  
  const [modelDownloaded, setModelDownloaded] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [checkingModel, setCheckingModel] = useState(true);

  const modelPath = `${FileSystem.documentDirectory}${MODEL_NAME}`;

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    setLogs(prev => [...prev.slice(-4), logMessage]);
  };

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
    };
  }, []);

  const checkModelExists = async () => {
    try {
      const fileInfo = await FileSystem.getInfoAsync(modelPath);
      setModelDownloaded(fileInfo.exists);
      if (fileInfo.exists && fileInfo.size) {
        const sizeMB = (fileInfo.size / 1024 / 1024).toFixed(1);
        addLog(`✅ Model sudah ada (${sizeMB}MB)`);
      } else {
        addLog('⚠️ Model belum diunduh');
      }
    } catch (error) {
      addLog(`❌ Error cek model: ${error}`);
    } finally {
      setCheckingModel(false);
    }
  };

  const setupAudio = async () => {
    try {
      addLog('Meminta izin audio...');
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Error', 'Izin mikrofon diperlukan');
        addLog('❌ Izin mikrofon ditolak');
        return;
      }
      addLog('✅ Izin mikrofon diberikan');
      
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      addLog('✅ Audio mode diatur');
    } catch (error) {
      addLog(`❌ Error setup audio: ${error}`);
      console.error('Error setting up audio:', error);
    }
  };

  const downloadModel = async () => {
    setIsDownloading(true);
    setDownloadProgress(0);
    addLog('=== MEMULAI DOWNLOAD MODEL ===');

    try {
      const cacheDir = FileSystem.documentDirectory;
      if (!cacheDir) {
        throw new Error('Document directory tidak tersedia');
      }

      addLog(`Downloading dari: ${MODEL_URL}`);
      addLog(`Menyimpan ke: ${modelPath}`);

      const callback = (downloadProgress: FileSystem.DownloadProgressData) => {
        const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
        const progressPercent = Math.round(progress * 100);
        setDownloadProgress(progressPercent);
        
        if (progressPercent % 10 === 0) {
          const downloadedMB = (downloadProgress.totalBytesWritten / 1024 / 1024).toFixed(1);
          const totalMB = (downloadProgress.totalBytesExpectedToWrite / 1024 / 1024).toFixed(1);
          addLog(`Download: ${downloadedMB}MB / ${totalMB}MB (${progressPercent}%)`);
        }
      };

      const downloadResumable = FileSystem.createDownloadResumable(
        MODEL_URL,
        modelPath,
        {},
        callback
      );

      const result = await downloadResumable.downloadAsync();
      
      if (result && result.uri) {
        addLog('✅ Model berhasil diunduh');
        setModelDownloaded(true);
        Alert.alert('Berhasil', 'Fitur latihan baca Quran siap digunakan!');
      }
    } catch (error) {
      addLog(`❌ Error download: ${error}`);
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
              addLog('✅ Model dihapus');
              Alert.alert('Berhasil', 'Model berhasil dihapus');
            } catch (error) {
              addLog(`❌ Error hapus model: ${error}`);
              Alert.alert('Error', 'Gagal menghapus model');
            }
          },
        },
      ]
    );
  };

  const initializeWhisper = async () => {
    if (whisperContext) {
      addLog('Whisper sudah diinisialisasi');
      return;
    }

    if (!modelDownloaded) {
      Alert.alert('Error', 'Model belum diunduh. Silakan unduh fitur terlebih dahulu.');
      return;
    }

    setIsInitializing(true);
    addLog('Memulai inisialisasi Whisper...');
    addLog(`Model path: ${modelPath}`);
    addLog(`Platform: ${Platform.OS}`);

    try {
      addLog('Loading model...');
      
      const context = await initWhisper({
        filePath: modelPath,
      });
      
      setWhisperContext(context);
      addLog('✅ Whisper berhasil diinisialisasi');
    } catch (error) {
      addLog(`❌ Error inisialisasi Whisper: ${error}`);
      console.error('Error initializing Whisper:', error);
      Alert.alert(
        'Error Inisialisasi',
        'Gagal memuat model AI. Ini bisa terjadi karena:\n\n' +
        '• Memory device tidak cukup\n' +
        '• File model corrupt\n' +
        '• Model tidak kompatibel\n\n' +
        'Coba hapus dan download ulang model.',
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
    addLog('Menggunakan teks contoh Bismillah');
  };

  const startRecording = async () => {
    try {
      addLog('Memulai recording...');
      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(newRecording);
      addLog('✅ Recording dimulai');
      return newRecording;
    } catch (error) {
      addLog(`❌ Error memulai recording: ${error}`);
      console.error('Failed to start recording:', error);
      return null;
    }
  };

  const stopRecording = async (rec: Audio.Recording | null) => {
    if (!rec) {
      addLog('⚠️ Recording null, skip stop');
      return null;
    }

    try {
      addLog('Menghentikan recording...');
      const status = await rec.getStatusAsync();
      
      if (!status.canRecord) {
        addLog('⚠️ Recording sudah berhenti');
        const uri = rec.getURI();
        return uri;
      }

      await rec.stopAndUnloadAsync();
      const uri = rec.getURI();
      addLog(`✅ Recording selesai: ${uri}`);
      return uri;
    } catch (error) {
      addLog(`❌ Error menghentikan recording: ${error}`);
      console.error('Failed to stop recording:', error);
      return null;
    }
  };

  const transcribeAudio = async (audioUri: string) => {
    if (!whisperContext) {
      addLog('❌ Whisper context belum diinisialisasi');
      return;
    }

    try {
      addLog('Memulai transkripsi...');
      
      const startTime = Date.now();
      const { promise } = whisperContext.transcribe(audioUri, {
        language: 'ar',
        maxLen: 1,
        tokenTimestamps: false,
        speedUp: false,
      });

      const { result } = await promise;
      const duration = Date.now() - startTime;

      addLog(`Hasil transkripsi (${duration}ms): "${result}"`);
      setTranscript(result);
      checkWord(result);
    } catch (error) {
      addLog(`❌ Error transkripsi: ${error}`);
      console.error('Transcription error:', error);
    }
  };

  const checkWord = (spokenText: string) => {
    const currentWord = words[currentWordIndex];
    if (!currentWord || currentWord.spoken) {
      addLog('Tidak ada kata untuk dicek atau sudah diucapkan');
      return;
    }

    const normalized = spokenText.trim().replace(/\s+/g, ' ');
    addLog(`Mengecek kata: "${currentWord.text}"`);
    addLog(`Ucapan: "${normalized}"`);

    if (normalized.includes(currentWord.text) || currentWord.text.includes(normalized)) {
      addLog(`✅ Kata cocok! "${currentWord.text}"`);
      const newWords = [...words];
      newWords[currentWordIndex] = { ...currentWord, highlighted: true, spoken: true };
      setWords(newWords);
      
      const nextIndex = currentWordIndex + 1;
      setCurrentWordIndex(nextIndex);
      setProgress(Math.round((nextIndex / words.length) * 100));

      if (nextIndex >= words.length) {
        addLog('🎉 Semua kata selesai!');
        stopListening();
      } else {
        addLog(`Lanjut ke kata berikutnya (${nextIndex + 1}/${words.length})`);
      }
    } else {
      addLog(`❌ Kata tidak cocok. Coba lagi.`);
    }
  };

  const startListening = async () => {
    if (!inputText.trim()) {
      Alert.alert('Error', 'Masukkan teks terlebih dahulu');
      return;
    }

    if (!whisperContext) {
      await initializeWhisper();
      if (!whisperContext) {
        addLog('❌ Gagal inisialisasi Whisper');
        return;
      }
    }

    addLog('=== MEMULAI SESI LATIHAN ===');
    const wordsArray = inputText.trim().split(/\s+/).map(text => ({
      text,
      highlighted: false,
      spoken: false,
    }));

    setWords(wordsArray);
    setCurrentWordIndex(0);
    setProgress(0);
    setTranscript('');
    setIsListening(true);
    addLog(`Total kata: ${wordsArray.length}`);
    addLog(`Kata pertama: "${wordsArray[0].text}"`);

    const rec = await startRecording();
    if (rec) {
      setRecording(rec);
    }
  };

  const processNextWord = async () => {
    if (!recording || !isListening) {
      addLog('❌ Tidak ada recording aktif');
      return;
    }

    addLog('Memproses kata...');
    const audioUri = await stopRecording(recording);
    setRecording(null);
    
    if (audioUri) {
      await transcribeAudio(audioUri);
      
      if (isListening && currentWordIndex < words.length - 1) {
        const newRec = await startRecording();
        if (newRec) {
          setRecording(newRec);
        }
      }
    }
  };

  const stopListening = async () => {
    addLog('=== MENGHENTIKAN SESI ===');
    setIsListening(false);
    
    if (recording) {
      const audioUri = await stopRecording(recording);
      setRecording(null);
      
      if (audioUri) {
        await transcribeAudio(audioUri);
      }
    }
  };

  const resetSession = () => {
    addLog('=== RESET SESI ===');
    if (recording) {
      recording.stopAndUnloadAsync().catch(() => {});
      setRecording(null);
    }
    setIsListening(false);
    setWords([]);
    setCurrentWordIndex(0);
    setProgress(0);
    setTranscript('');
    setInputText('');
    setLogs([]);
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

          <View className="bg-teal-600 dark:bg-teal-700 rounded-3xl p-6 mb-6 shadow-lg">
            <Text className="text-white text-xl font-bold mb-3">
              Fitur AI Model
            </Text>
            <Text className="text-teal-50 leading-6">
              • Akurasi tinggi untuk bahasa Arab{'\n'}
              • Deteksi pelafalan real-time{'\n'}
              • Bekerja tanpa internet setelah diunduh{'\n'}
              • Model: Whisper Base (Optimal untuk mobile)
            </Text>
          </View>

          {isDownloading ? (
            <View className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-md border border-gray-100 dark:border-gray-700 mb-6">
              <Text className="text-lg font-bold text-gray-900 dark:text-white mb-4 text-center">
                Mengunduh Model AI...
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
            <Text className="text-center text-gray-600 dark:text-gray-400 text-sm mt-2">
              Ini mungkin memakan waktu beberapa detik
            </Text>
          </View>
        )}

        <View className="bg-teal-600 dark:bg-teal-700 rounded-3xl p-6 mb-6 shadow-lg">
          <Text className="text-white text-xl font-bold mb-3">
            Cara Menggunakan
          </Text>
          <Text className="text-teal-50">
            1. Ketik atau gunakan teks Quran{'\n'}
            2. Tekan Mulai dan baca kata per kata{'\n'}
            3. Tekan Proses untuk kata berikutnya
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
              editable={!isListening}
            />
          </View>
          <TouchableOpacity
            onPress={useSampleText}
            className="self-end"
            disabled={isListening}
          >
            <Text className={`text-teal-600 dark:text-teal-500 font-semibold ${isListening ? 'opacity-50' : ''}`}>
              Gunakan Contoh (Bismillah)
            </Text>
          </TouchableOpacity>
        </View>

        {words.length > 0 && (
          <View className="mb-6">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-lg font-bold text-gray-900 dark:text-white">
                Kata {currentWordIndex}/{words.length}
              </Text>
              <Text className="text-teal-600 dark:text-teal-500 font-bold">
                {progress}% Selesai
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
                      word.spoken
                        ? 'bg-teal-600 dark:bg-teal-700'
                        : index === currentWordIndex
                        ? 'bg-amber-500 dark:bg-amber-600'
                        : 'bg-gray-100 dark:bg-gray-700'
                    }`}
                  >
                    <Text
                      className={`text-lg font-bold ${
                        word.spoken || index === currentWordIndex
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

        <View className="mb-6">
          <Text className="text-lg font-bold text-gray-900 dark:text-white mb-3">
            Status
          </Text>
          <View className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
            <View className="flex-row items-center mb-3">
              <View className={`w-3 h-3 rounded-full mr-3 ${isListening ? 'bg-green-500' : 'bg-gray-400'}`} />
              <Text className="text-gray-900 dark:text-white font-semibold">
                {isListening ? 'Merekam...' : 'Siap'}
              </Text>
            </View>
            {!isListening && words.length === 0 && (
              <Text className="text-gray-500 dark:text-gray-400">
                Tekan Mulai untuk memulai
              </Text>
            )}
            {words.length > 0 && currentWordIndex < words.length && (
              <View className="mt-3 bg-amber-50 dark:bg-amber-950 rounded-xl p-4">
                <Text className="text-amber-900 dark:text-amber-100 font-semibold mb-2">
                  Kata Selanjutnya
                </Text>
                <Text className="text-3xl font-bold text-amber-600 dark:text-amber-400 text-right">
                  {words[currentWordIndex].text}
                </Text>
              </View>
            )}
          </View>
        </View>

        {transcript && (
          <View className="mb-6">
            <Text className="text-lg font-bold text-gray-900 dark:text-white mb-3">
              Yang Anda Ucapkan
            </Text>
            <View className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
              <Text className="text-gray-900 dark:text-white text-lg text-right">
                {transcript}
              </Text>
            </View>
          </View>
        )}

        {logs.length > 0 && (
          <View className="mb-6">
            <Text className="text-lg font-bold text-gray-900 dark:text-white mb-3">
              Log Debug
            </Text>
            <View className="bg-gray-900 dark:bg-gray-950 rounded-2xl p-4 border border-gray-700">
              {logs.map((log, index) => (
                <Text key={index} className="text-green-400 text-xs font-mono mb-1">
                  {log}
                </Text>
              ))}
            </View>
          </View>
        )}

        <View className="flex-row gap-3 mb-6">
          {!isListening ? (
            <TouchableOpacity
              onPress={startListening}
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
          ) : (
            <>
              <TouchableOpacity
                onPress={processNextWord}
                className="flex-1 bg-blue-600 dark:bg-blue-700 rounded-2xl py-4 shadow-lg"
              >
                <View className="flex-row items-center justify-center">
                  <IconSymbol size={24} name="skip-next" color="#FFFFFF" />
                  <Text className="text-white font-bold text-lg ml-2">
                    Proses
                  </Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={stopListening}
                className="bg-red-600 dark:bg-red-700 rounded-2xl py-4 px-6 shadow-lg"
              >
                <IconSymbol size={24} name="stop" color="#FFFFFF" />
              </TouchableOpacity>
            </>
          )}
          
          <TouchableOpacity
            onPress={resetSession}
            className="bg-gray-600 dark:bg-gray-700 rounded-2xl py-4 px-6 shadow-lg"
          >
            <IconSymbol size={24} name="refresh" color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <View className="bg-teal-50 dark:bg-teal-950 rounded-2xl p-6">
          <View className="flex-row items-center mb-3">
            <IconSymbol size={24} name="info" color="#0d9488" />
            <Text className="text-lg font-semibold text-gray-900 dark:text-white ml-2">
              Tips
            </Text>
          </View>
          <Text className="text-gray-700 dark:text-gray-300 leading-6">
            Baca satu kata dengan jelas, lalu tekan Proses untuk mengecek. Ulangi untuk kata berikutnya.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}