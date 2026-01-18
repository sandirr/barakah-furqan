import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  AudioModule,
  RecordingOptions,
  useAudioRecorder
} from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { initWhisper, WhisperContext } from 'whisper.rn';

interface Word {
  text: string;
  status: 'pending' | 'correct' | 'incorrect' | 'current';
}

const MODEL_URL = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin';
const MODEL_SIZE_MB = 148;
const MODEL_NAME = 'ggml-base.bin';
const RECORDING_INTERVAL = 3000;

const recordingOptions: RecordingOptions = {
  isMeteringEnabled: false,
  extension: '.m4a',
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 128000,
  android: {
    extension: '.m4a',
    sampleRate: 16000,
    outputFormat: 'mpeg4',
    audioEncoder: 'aac',
  },
  ios: {
    extension: '.m4a',
    sampleRate: 16000,
    audioQuality: 127,
  },
  web: {
    mimeType: 'audio/webm',
    bitsPerSecond: 128000,
  },
};

export default function QuranPracticeScreen() {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const audioRecorder = useAudioRecorder(recordingOptions);
  
  const [inputText, setInputText] = useState('');
  const [words, setWords] = useState<Word[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [whisperContext, setWhisperContext] = useState<WhisperContext | null>(null);
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
    requestPermissions();
    
    return () => {
      if (audioRecorder?.isRecording) {
        audioRecorder.stop();
      }
      if (whisperContext) {
        whisperContext.release().catch(() => {});
      }
      if (recordingTimer.current) {
        clearTimeout(recordingTimer.current);
      }
    };
  }, []);

  const requestPermissions = async () => {
    try {
      const { granted } = await AudioModule.requestRecordingPermissionsAsync();
      if (!granted) {
        Alert.alert(t('quranPractice.error'), t('quranPractice.micPermissionRequired'));
      }
    } catch (error) {
      console.error('Error requesting permissions:', error);
    }
  };

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
        Alert.alert(t('quranPractice.success'), t('quranPractice.featureReady'));
      }
    } catch (error) {
      Alert.alert(t('quranPractice.error'), t('quranPractice.downloadFailed'));
      console.error('Download error:', error);
    } finally {
      setIsDownloading(false);
      setDownloadProgress(0);
    }
  };

  const deleteModel = async () => {
    Alert.alert(
      t('quranPractice.deleteModel'),
      t('quranPractice.deleteConfirmation', { size: MODEL_SIZE_MB }),
      [
        { text: t('quranPractice.cancel'), style: 'cancel' },
        {
          text: t('quranPractice.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await FileSystem.deleteAsync(modelPath);
              setModelDownloaded(false);
              if (whisperContext) {
                await whisperContext.release();
                setWhisperContext(null);
              }
              Alert.alert(t('quranPractice.success'), t('quranPractice.modelDeleted'));
            } catch (error) {
              Alert.alert(t('quranPractice.error'), t('quranPractice.deleteFailed'));
            }
          },
        },
      ]
    );
  };

  const initializeWhisper = async () => {
    if (whisperContext) return;
    if (!modelDownloaded) {
      Alert.alert(t('quranPractice.error'), t('quranPractice.modelNotDownloaded'));
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
        t('quranPractice.initializationError'),
        t('quranPractice.initializationFailed'),
        [
          { text: t('quranPractice.ok') },
          { 
            text: t('quranPractice.deleteModel'), 
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
      await audioRecorder.record();
      
      recordingTimer.current = setTimeout(() => {
        processCurrentWord();
      }, RECORDING_INTERVAL);
    } catch (error) {
      console.error('Failed to start recording:', error);
      Alert.alert(t('quranPractice.error'), t('quranPractice.recordingFailed'));
    }
  };

  const stopCurrentRecording = async (): Promise<string | null | any> => {
    if (recordingTimer.current) {
      clearTimeout(recordingTimer.current);
    }

    if (!audioRecorder.isRecording) return null;

    try {
      const uri = await audioRecorder.stop();
      return null;
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
    
    if (audioRecorder.isRecording) {
      await stopCurrentRecording();
    }
  };

  const startSession = async () => {
    if (!inputText.trim()) {
      Alert.alert(t('quranPractice.error'), t('quranPractice.enterTextFirst'));
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

    if (audioRecorder.isRecording) {
      await audioRecorder.stop();
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
        <Text className="text-gray-600 dark:text-gray-400 mt-4">{t('quranPractice.checkingFeature')}</Text>
      </View>
    );
  }

  if (!modelDownloaded) {
    return (
      <SafeAreaView className="flex-1 bg-white dark:bg-gray-900" edges={["top"]}>
        <ScrollView>
          <View className="p-4">
            <View className="items-center mb-8">
              <View className="w-20 h-20 bg-teal-600 dark:bg-teal-700 rounded-full items-center justify-center mb-4 shadow-lg">
                <IconSymbol size={40} name="mic" color="#FFFFFF" />
              </View>
              <Text className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                {t('quranPractice.title')}
              </Text>
              <Text className="text-center text-gray-600 dark:text-gray-400">
                {t('quranPractice.description')}
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
                  {t('quranPractice.downloadFeature')}
                </Text>
                <Text className="text-teal-50 text-center mb-4">
                  {t('quranPractice.featureRequirement')}
                </Text>
                <View className="bg-white/20 rounded-xl p-3 w-full">
                  <Text className="text-white text-center font-semibold">
                    {t('quranPractice.size')}: {MODEL_SIZE_MB}MB
                  </Text>
                </View>
              </View>
            </LinearGradient>

            {isDownloading ? (
              <View className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-md border border-gray-100 dark:border-gray-700 mb-6">
                <Text className="text-lg font-bold text-gray-900 dark:text-white mb-4 text-center">
                  {t('quranPractice.downloading')}
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
                    {t('quranPractice.downloadButton')} ({MODEL_SIZE_MB}MB)
                  </Text>
                </View>
              </TouchableOpacity>
            )}

            <View className="bg-amber-50 dark:bg-amber-950 rounded-2xl p-6 border border-amber-500">
              <View className="flex-row items-center mb-3">
                <IconSymbol size={24} name="info" color="#F59E0B" />
                <Text className="text-lg font-semibold text-gray-900 dark:text-white ml-2">
                  {t('quranPractice.note')}
                </Text>
              </View>
              <Text className="text-gray-700 dark:text-gray-300 leading-6">
                {t('quranPractice.stableConnection')}{'\n'}
                {t('quranPractice.dataUsage')} {MODEL_SIZE_MB}MB {t('quranPractice.dataLabel')}{'\n'}
                {t('quranPractice.downloadOnce')}{'\n'}
                {t('quranPractice.canDelete')}
              </Text>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-900" edges={["top"]}>
      <ScrollView className='flex-1' contentContainerStyle={{padding: 16}}>
        <View className="items-center mb-8">
          <View className="w-20 h-20 bg-teal-600 dark:bg-teal-700 rounded-full items-center justify-center mb-4 shadow-lg">
            <IconSymbol size={40} name="mic" color="#FFFFFF" />
          </View>
          <Text className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {t('quranPractice.title')}
          </Text>
          <Text className="text-center text-gray-600 dark:text-gray-400">
            {t('quranPractice.description')}
          </Text>
        </View>

        {isInitializing && (
          <View className="bg-blue-50 dark:bg-blue-950 rounded-2xl p-6 mb-6">
            <ActivityIndicator size="large" color="#0d9488" />
            <Text className="text-center text-gray-900 dark:text-white mt-4 font-semibold">
              {t('quranPractice.loadingModel')}
            </Text>
          </View>
        )}

        <View className="bg-teal-600 dark:bg-teal-700 rounded-3xl p-6 mb-6 shadow-lg">
          <Text className="text-white text-xl font-bold mb-3">
            {t('quranPractice.howToUse')}
          </Text>
          <Text className="text-teal-50">
            {t('quranPractice.step1')}{'\n'}
            {t('quranPractice.step2')}{'\n'}
            {t('quranPractice.step3')}{'\n'}
            {t('quranPractice.step4')}
          </Text>
        </View>

        <View className="mb-6">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-lg font-bold text-gray-900 dark:text-white">
              {t('quranPractice.quranText')}
            </Text>
            <TouchableOpacity onPress={deleteModel}>
              <Text className="text-red-600 dark:text-red-500 text-sm">
                {t('quranPractice.deleteModel')}
              </Text>
            </TouchableOpacity>
          </View>
          <View className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-200 dark:border-gray-700 mb-3">
            <TextInput
              value={inputText}
              onChangeText={setInputText}
              placeholder={t('quranPractice.inputPlaceholder')}
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
              {t('quranPractice.useSample')}
            </Text>
          </TouchableOpacity>
        </View>

        {words.length > 0 && (
          <View className="mb-6">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-lg font-bold text-gray-900 dark:text-white">
                {t('quranPractice.progress')}
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
                  {t('quranPractice.sessionComplete')}
                </Text>
                <View className="bg-white/20 rounded-xl p-6 w-full mt-4">
                  <Text className="text-white text-center text-lg mb-2">
                    {t('quranPractice.yourScore')}
                  </Text>
                  <Text className="text-white text-center text-5xl font-bold">
                    {getScorePercentage()}%
                  </Text>
                  <Text className="text-teal-50 text-center mt-2">
                    {t('quranPractice.correctWords', { correct: score.correct, total: score.total })}
                  </Text>
                </View>
              </View>
            </LinearGradient>
          </View>
        )}

        {!sessionComplete && words.length > 0 && (
          <View className="mb-6">
            <Text className="text-lg font-bold text-gray-900 dark:text-white mb-3">
              {t('quranPractice.status')}
            </Text>
            <View className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
              <View className="flex-row items-center mb-3">
                <View className={`w-3 h-3 rounded-full mr-3 ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-gray-400'}`} />
                <Text className="text-gray-900 dark:text-white font-semibold">
                  {isRecording ? t('quranPractice.listening') : t('quranPractice.ready')}
                </Text>
              </View>
              {isRecording && currentWordIndex < words.length && (
                <View className="mt-3 bg-amber-50 dark:bg-amber-950 rounded-xl p-4">
                  <Text className="text-amber-900 dark:text-amber-100 font-semibold mb-2">
                    {t('quranPractice.currentWord', { current: currentWordIndex + 1, total: words.length })}
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
                    {t('quranPractice.start')}
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
                  {t('quranPractice.stop')}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* <View className="bg-teal-50 dark:bg-teal-950 rounded-2xl p-6">
          <View className="flex-row items-center mb-3">
            <IconSymbol size={24} name="info" color="#0d9488" />
            <Text className="text-lg font-semibold text-gray-900 dark:text-white ml-2">
              {t('quranPractice.tips')}
            </Text>
          </View>
          <Text className="text-gray-700 dark:text-gray-300 leading-6">
            {t('quranPractice.tipsDescription')}
          </Text>
        </View> */}
        <LinearGradient
          colors={colorScheme === 'dark' ? ['#1f2937', '#374151'] : ['#d1fae5', '#ccfbf1']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ borderRadius: 16, padding: 24 }}
        >
          <View className="flex-row items-center mb-3">
            <IconSymbol size={24} name="info" color="#059669" />
            <Text className="text-lg font-semibold text-gray-900 dark:text-white ml-2">
              {t('quranPractice.tips')}
            </Text>
          </View>
          <Text className="text-gray-700 dark:text-gray-300 leading-6">
            {t('quranPractice.tipsDescription')}
          </Text>
        </LinearGradient>
      </ScrollView>
    </SafeAreaView>
  );
}