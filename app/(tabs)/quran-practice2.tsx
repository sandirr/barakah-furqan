import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';

interface Word {
  text: string;
  highlighted: boolean;
  spoken: boolean;
}

export default function QuranPracticeScreen() {
  const { colorScheme } = useColorScheme();
  const [inputText, setInputText] = useState('');
  const [words, setWords] = useState<Word[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    setLogs(prev => [...prev.slice(-4), logMessage]);
  };

  useSpeechRecognitionEvent('start', () => {
    addLog('🎙️ Mendengarkan...');
  });

  useSpeechRecognitionEvent('end', () => {
    addLog('🎙️ Selesai mendengarkan');
    setIsRecording(false);
  });

  useSpeechRecognitionEvent('result', (event) => {
    const results = event.results;
    if (results && results.length > 0) {
      const lastResult = results[results.length - 1];
      if (lastResult.segments && lastResult.segments.length > 0) {
        const segment = lastResult.segments[0];
        const text = segment.segment;
        addLog(`Mendengar: "${text}"`);
        setTranscript(text);
      }
    }
  });

  useSpeechRecognitionEvent('error', (event) => {
    const errorCode = event.error;
    
    if (errorCode === 'no-speech') {
      addLog('⚠️ Tidak ada suara terdeteksi');
    } else if (errorCode === 'audio-capture') {
      addLog('⚠️ Error audio');
    } else {
      addLog(`❌ Error: ${errorCode}`);
      console.error('Speech error:', event);
    }
    
    setIsRecording(false);
  });

  useEffect(() => {
    checkPermissions();
    return () => {
      if (isRecording) {
        ExpoSpeechRecognitionModule.stop();
      }
    };
  }, []);

  const checkPermissions = async () => {
    try {
      addLog('Mengecek izin...');
      const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      
      if (result.granted) {
        addLog('✅ Izin diberikan');
      } else {
        addLog('❌ Izin ditolak');
        Alert.alert('Izin Diperlukan', 'Aplikasi memerlukan izin microphone dan speech recognition.');
      }
    } catch (error) {
      addLog(`❌ Error cek izin: ${error}`);
    }
  };

  const useSampleText = () => {
    const sampleText = 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ';
    setInputText(sampleText);
    addLog('Menggunakan teks contoh Bismillah');
  };

  const checkWord = (spokenText: string) => {
    const currentWord = words[currentWordIndex];
    if (!currentWord || currentWord.spoken) {
      addLog('Tidak ada kata untuk dicek');
      return;
    }

    const normalized = spokenText.trim().replace(/\s+/g, ' ');
    addLog(`Mengecek: "${currentWord.text}" vs "${normalized}"`);

    if (normalized.includes(currentWord.text) || currentWord.text.includes(normalized)) {
      addLog(`✅ Kata cocok!`);
      const newWords = [...words];
      newWords[currentWordIndex] = { ...currentWord, highlighted: true, spoken: true };
      setWords(newWords);
      
      const nextIndex = currentWordIndex + 1;
      setCurrentWordIndex(nextIndex);
      setProgress(Math.round((nextIndex / words.length) * 100));

      if (nextIndex >= words.length) {
        addLog('🎉 Semua kata selesai!');
        setIsListening(false);
      } else {
        addLog(`Lanjut ke kata ${nextIndex + 1}/${words.length}`);
      }
    } else {
      addLog(`❌ Kata tidak cocok`);
      Alert.alert('Tidak Cocok', 'Kata yang Anda ucapkan tidak cocok. Coba lagi.', [{ text: 'OK' }]);
    }
  };

  const startSession = () => {
    if (!inputText.trim()) {
      Alert.alert('Error', 'Masukkan teks terlebih dahulu');
      return;
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
  };

  const toggleRecording = async () => {
    if (!isListening) {
      Alert.alert('Error', 'Tekan Mulai terlebih dahulu');
      return;
    }

    if (isRecording) {
      // Stop recording dan proses
      try {
        addLog('Menghentikan recording...');
        await ExpoSpeechRecognitionModule.stop();
        
        // Tunggu sebentar untuk hasil final
        setTimeout(() => {
          if (transcript.trim()) {
            checkWord(transcript);
            setTranscript('');
          } else {
            Alert.alert('Tidak Ada Suara', 'Tidak ada suara terdeteksi. Coba lagi.', [{ text: 'OK' }]);
          }
        }, 500);
      } catch (error) {
        addLog(`❌ Error stop: ${error}`);
      }
    } else {
      // Start recording
      try {
        addLog('Memulai recording...');
        setTranscript('');
        await ExpoSpeechRecognitionModule.start({
          lang: 'ar-SA',
          interimResults: true,
          maxAlternatives: 3,
          continuous: true,
          requiresOnDeviceRecognition: false,
          addsPunctuation: false,
          contextualStrings: [],
        });
        setIsRecording(true);
        addLog('✅ Mulai berbicara sekarang!');
      } catch (error) {
        addLog(`❌ Error start: ${error}`);
        Alert.alert('Error', 'Gagal memulai recording');
      }
    }
  };

  const stopSession = async () => {
    addLog('=== MENGHENTIKAN SESI ===');
    setIsListening(false);
    setIsRecording(false);
    
    try {
      await ExpoSpeechRecognitionModule.stop();
    } catch (error) {
      addLog(`❌ Error stop: ${error}`);
    }
  };

  const resetSession = async () => {
    addLog('=== RESET SESI ===');
    await stopSession();
    setWords([]);
    setCurrentWordIndex(0);
    setProgress(0);
    setTranscript('');
    setInputText('');
    setLogs([]);
  };

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
            Latih bacaan Quran dengan speech recognition
          </Text>
        </View>

        <View className="bg-blue-50 dark:bg-blue-950 rounded-3xl p-6 mb-6 border border-blue-500">
          <View className="flex-row items-center mb-3">
            <IconSymbol size={24} name="info" color="#3B82F6" />
            <Text className="text-lg font-semibold text-gray-900 dark:text-white ml-2">
              Cara Pakai
            </Text>
          </View>
          <Text className="text-gray-700 dark:text-gray-300 leading-6">
            1. Ketik teks Arab{'\n'}
            2. Tekan <Text className="font-bold">Mulai</Text>{'\n'}
            3. Tekan tombol <Text className="font-bold text-red-600">Rekam</Text> dan baca kata{'\n'}
            4. Tekan lagi untuk <Text className="font-bold">Proses</Text>{'\n'}
            5. Ulangi untuk kata berikutnya
          </Text>
        </View>

        <View className="mb-6">
          <Text className="text-lg font-bold text-gray-900 dark:text-white mb-3">
            Teks Quran
          </Text>
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
                Kata {currentWordIndex + 1}/{words.length}
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
              <View className={`w-3 h-3 rounded-full mr-3 ${isRecording ? 'bg-red-500' : isListening ? 'bg-green-500' : 'bg-gray-400'}`} />
              <Text className="text-gray-900 dark:text-white font-semibold">
                {isRecording ? 'Merekam...' : isListening ? 'Siap' : 'Idle'}
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

        <View className="gap-3 mb-6">
          {!isListening ? (
            <TouchableOpacity
              onPress={startSession}
              disabled={!inputText.trim()}
              className={`rounded-2xl py-4 shadow-lg ${
                inputText.trim()
                  ? 'bg-teal-600 dark:bg-teal-700'
                  : 'bg-gray-300 dark:bg-gray-700'
              }`}
            >
              <View className="flex-row items-center justify-center">
                <IconSymbol size={24} name="play-arrow" color="#FFFFFF" />
                <Text className="text-white font-bold text-lg ml-2">
                  Mulai Sesi
                </Text>
              </View>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity
                onPress={toggleRecording}
                className={`rounded-2xl py-5 shadow-lg ${
                  isRecording
                    ? 'bg-blue-600 dark:bg-blue-700'
                    : 'bg-red-600 dark:bg-red-700'
                }`}
              >
                <View className="flex-row items-center justify-center">
                  <IconSymbol size={28} name={isRecording ? 'stop-circle' : 'mic'} color="#FFFFFF" />
                  <Text className="text-white font-bold text-xl ml-2">
                    {isRecording ? 'Tekan untuk Proses' : 'Tekan untuk Rekam'}
                  </Text>
                </View>
              </TouchableOpacity>

              <View className="flex-row gap-3">
                <TouchableOpacity
                  onPress={stopSession}
                  className="flex-1 bg-gray-600 dark:bg-gray-700 rounded-2xl py-4 shadow-lg"
                >
                  <View className="flex-row items-center justify-center">
                    <IconSymbol size={24} name="stop" color="#FFFFFF" />
                    <Text className="text-white font-bold text-lg ml-2">
                      Stop
                    </Text>
                  </View>
                </TouchableOpacity>
                
                <TouchableOpacity
                  onPress={resetSession}
                  className="flex-1 bg-gray-600 dark:bg-gray-700 rounded-2xl py-4 shadow-lg"
                >
                  <View className="flex-row items-center justify-center">
                    <IconSymbol size={24} name="refresh" color="#FFFFFF" />
                    <Text className="text-white font-bold text-lg ml-2">
                      Reset
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

        <View className="bg-amber-50 dark:bg-amber-950 rounded-2xl p-6 border border-amber-500">
          <View className="flex-row items-center mb-3">
            <IconSymbol size={24} name="tips-and-updates" color="#F59E0B" />
            <Text className="text-lg font-semibold text-gray-900 dark:text-white ml-2">
              Tips
            </Text>
          </View>
          <Text className="text-gray-700 dark:text-gray-300 leading-6">
            • Tekan tombol rekam SEBELUM berbicara{'\n'}
            • Baca satu kata dengan jelas{'\n'}
            • Tekan lagi untuk memproses{'\n'}
            • Tempat yang tenang memberikan hasil terbaik
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}