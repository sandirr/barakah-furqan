import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  AudioModule,
  RecordingOptions,
  useAudioRecorder
} from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Linking, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
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

export default function TilawahScreen() {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const params = useLocalSearchParams();
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
  
  const [hasMicPermission, setHasMicPermission] = useState(false);
  const [checkingPermission, setCheckingPermission] = useState(true);

  const recordingTimer = useRef<NodeJS.Timeout | any>(null);
  const modelPath = `${FileSystem.documentDirectory}${MODEL_NAME}`;

  useEffect(() => {
    initializeScreen();
    
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

  useEffect(() => {
    if (params.text && typeof params.text === 'string') {
      setInputText(params.text);
    }
  }, [params.text]);

  const initializeScreen = async () => {
    await checkPermissions();
    await checkModelExists();
  };

  const checkPermissions = async () => {
    setCheckingPermission(true);
    try {
      const { granted } = await AudioModule.getRecordingPermissionsAsync();
      setHasMicPermission(granted);
    } catch (error) {
      console.error('Error checking permissions:', error);
      setHasMicPermission(false);
    } finally {
      setCheckingPermission(false);
    }
  };

  const requestPermissions = async () => {
    try {
      const { granted } = await AudioModule.requestRecordingPermissionsAsync();
      setHasMicPermission(granted);
      
      if (!granted) {
        Alert.alert(
          t('tilawah.permissionRequired'),
          t('tilawah.permissionRequiredDesc'),
          [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('tilawah.openSettings'), onPress: () => Linking.openSettings() }
          ]
        );
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
        Alert.alert(t('tilawah.success'), t('tilawah.featureReady'));
      }
    } catch (error) {
      Alert.alert(t('tilawah.error'), t('tilawah.downloadFailed'));
      console.error('Download error:', error);
    } finally {
      setIsDownloading(false);
      setDownloadProgress(0);
    }
  };

  const deleteModel = async () => {
    Alert.alert(
      t('tilawah.deleteModel'),
      t('tilawah.deleteConfirmation', { size: MODEL_SIZE_MB }),
      [
        { text: t('tilawah.cancel'), style: 'cancel' },
        {
          text: t('tilawah.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await FileSystem.deleteAsync(modelPath);
              setModelDownloaded(false);
              if (whisperContext) {
                await whisperContext.release();
                setWhisperContext(null);
              }
              Alert.alert(t('tilawah.success'), t('tilawah.modelDeleted'));
            } catch (error) {
              Alert.alert(t('tilawah.error'), t('tilawah.deleteFailed'));
            }
          },
        },
      ]
    );
  };

  const initializeWhisper = async () => {
    if (whisperContext) return;
    if (!modelDownloaded) {
      Alert.alert(t('tilawah.error'), t('tilawah.modelNotDownloaded'));
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
        t('tilawah.initializationError'),
        t('tilawah.initializationFailed'),
        [
          { text: t('tilawah.ok') },
          { 
            text: t('tilawah.deleteModel'), 
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
      Alert.alert(t('tilawah.error'), t('tilawah.recordingFailed'));
    }
  };

  const stopCurrentRecording = async (): Promise<string | null | any> => {
    if (recordingTimer.current) {
      clearTimeout(recordingTimer.current);
    }

    if (!audioRecorder.isRecording) return null;

    try {
      const uri = await audioRecorder.stop();
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
    
    if (audioRecorder.isRecording) {
      await stopCurrentRecording();
    }
  };

  const startSession = async () => {
    if (!inputText.trim()) {
      Alert.alert(t('tilawah.error'), t('tilawah.enterTextFirst'));
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
    setSessionComplete(false);
    setScore({ correct: 0, total: 0 });
  };

  const getScorePercentage = (): number => {
    if (score.total === 0) return 0;
    return Math.round((score.correct / score.total) * 100);
  };

  if (checkingPermission || checkingModel) {
    return (
      <View className="flex-1 bg-white dark:bg-gray-900 items-center justify-center">
        <ActivityIndicator size="large" color="#0d9488" />
        <Text className="text-gray-600 dark:text-gray-400 mt-4">{t('tilawah.checking')}</Text>
      </View>
    );
  }

  if (!hasMicPermission) {
    return (
      <SafeAreaView className="flex-1 bg-teal-600 dark:bg-teal-700">
        <View className="p-4 bg-teal-600 dark:bg-teal-700">
          <Text className="text-2xl font-bold text-white">
            {t('tilawah.title')}
          </Text>
        </View>
        
        <View className="flex-1 items-center justify-center px-4 bg-white dark:bg-gray-900">
          <IconSymbol size={64} name="mic-off" color="#dc2626" />
          <Text className="text-gray-900 dark:text-white text-center mt-4 text-xl font-bold">
            {t('tilawah.permissionRequired')}
          </Text>
          
          <View className="w-full mt-6">
            <View className="p-4 rounded-xl bg-red-50 dark:bg-red-950">
              <View className="flex-row items-center mb-2">
                <IconSymbol size={24} name="cancel" color="#dc2626" />
                <Text className="ml-2 font-semibold text-red-700 dark:text-red-300">
                  {t('tilawah.microphonePermission')}
                </Text>
              </View>
              <Text className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                {t('tilawah.microphonePermissionDesc')}
              </Text>
              <TouchableOpacity
                onPress={requestPermissions}
                className="bg-red-600 py-2 px-4 rounded-lg"
              >
                <Text className="text-white font-semibold text-center">
                  {t('tilawah.enableMicrophone')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            onPress={checkPermissions}
            className="mt-8 bg-teal-600 py-3 px-8 rounded-xl"
          >
            <Text className="text-white font-semibold text-center">
              {t('tilawah.checkAgain')}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
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
                {t('tilawah.title')}
              </Text>
              <Text className="text-center text-gray-600 dark:text-gray-400">
                {t('tilawah.description')}
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
                  {t('tilawah.downloadFeature')}
                </Text>
                <Text className="text-teal-50 text-center mb-4">
                  {t('tilawah.featureRequirement')}
                </Text>
                <View className="bg-white/20 rounded-xl p-3 w-full">
                  <Text className="text-white text-center font-semibold">
                    {t('tilawah.size')}: {MODEL_SIZE_MB}MB
                  </Text>
                </View>
              </View>
            </LinearGradient>

            {isDownloading ? (
              <View className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-md border border-gray-100 dark:border-gray-700 mb-6">
                <Text className="text-lg font-bold text-gray-900 dark:text-white mb-4 text-center">
                  {t('tilawah.downloading')}
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
                    {t('tilawah.downloadButton')} ({MODEL_SIZE_MB}MB)
                  </Text>
                </View>
              </TouchableOpacity>
            )}

            <View className="bg-amber-50 dark:bg-amber-950 rounded-2xl p-6 border border-amber-500">
              <View className="flex-row items-center mb-3">
                <IconSymbol size={24} name="info" color="#F59E0B" />
                <Text className="text-lg font-semibold text-gray-900 dark:text-white ml-2">
                  {t('tilawah.note')}
                </Text>
              </View>
              <Text className="text-gray-700 dark:text-gray-300 leading-6">
                {t('tilawah.stableConnection')}{'\n'}
                {t('tilawah.dataUsage')} {MODEL_SIZE_MB}MB {t('tilawah.dataLabel')}{'\n'}
                {t('tilawah.downloadOnce')}{'\n'}
                {t('tilawah.canDelete')}
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
            {t('tilawah.title')}
          </Text>
          <Text className="text-center text-gray-600 dark:text-gray-400">
            {t('tilawah.description')}
          </Text>
        </View>

        {isInitializing && (
          <View className="bg-blue-50 dark:bg-blue-950 rounded-2xl p-6 mb-6">
            <ActivityIndicator size="large" color="#0d9488" />
            <Text className="text-center text-gray-900 dark:text-white mt-4 font-semibold">
              {t('tilawah.loadingModel')}
            </Text>
          </View>
        )}

        <View className="bg-teal-600 dark:bg-teal-700 rounded-3xl p-6 mb-6 shadow-lg">
          <Text className="text-white text-xl font-bold mb-3">
            {t('tilawah.howToUse')}
          </Text>
          <Text className="text-teal-50">
            {t('tilawah.step1')}{'\n'}
            {t('tilawah.step2')}{'\n'}
            {t('tilawah.step3')}
          </Text>
        </View>

        <View className="mb-6">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-lg font-bold text-gray-900 dark:text-white">
              {t('tilawah.quranText')}
            </Text>
            <TouchableOpacity onPress={deleteModel}>
              <Text className="text-red-600 dark:text-red-500 text-sm">
                {t('tilawah.deleteModel')}
              </Text>
            </TouchableOpacity>
          </View>
          <View className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-200 dark:border-gray-700 mb-3">
            <TextInput
              value={inputText}
              onChangeText={setInputText}
              placeholder={t('tilawah.inputPlaceholder')}
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
              {t('tilawah.useSample')}
            </Text>
          </TouchableOpacity>
        </View>

        {words.length > 0 && (
          <View className="mb-6">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-lg font-bold text-gray-900 dark:text-white">
                {t('tilawah.progress')}
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
                  {t('tilawah.sessionComplete')}
                </Text>
                <View className="bg-white/20 rounded-xl p-6 w-full mt-4">
                  <Text className="text-white text-center text-lg mb-2">
                    {t('tilawah.yourScore')}
                  </Text>
                  <Text className="text-white text-center text-5xl font-bold">
                    {getScorePercentage()}%
                  </Text>
                  <Text className="text-teal-50 text-center mt-2">
                    {t('tilawah.correctWords', { correct: score.correct, total: score.total })}
                  </Text>
                </View>
              </View>
            </LinearGradient>
          </View>
        )}

        {!sessionComplete && words.length > 0 && (
          <View className="mb-6">
            <Text className="text-lg font-bold text-gray-900 dark:text-white mb-3">
              {t('tilawah.status')}
            </Text>
            <View className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
              <View className="flex-row items-center mb-3">
                <View className={`w-3 h-3 rounded-full mr-3 ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-gray-400'}`} />
                <Text className="text-gray-900 dark:text-white font-semibold">
                  {isRecording ? t('tilawah.listening') : t('tilawah.ready')}
                </Text>
              </View>
              {isRecording && currentWordIndex < words.length && (
                <View className="mt-3 bg-amber-50 dark:bg-amber-950 rounded-xl p-4">
                  <Text className="text-amber-900 dark:text-amber-100 font-semibold mb-2">
                    {t('tilawah.currentWord', { current: currentWordIndex + 1, total: words.length })}
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
                    {t('tilawah.start')}
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
                  {t('tilawah.stop')}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        </View>

        <LinearGradient
          colors={colorScheme === 'dark' ? ['#1f2937', '#374151'] : ['#d1fae5', '#ccfbf1']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ borderRadius: 16, padding: 24 }}
        >
          <View className="flex-row items-center mb-3">
            <IconSymbol size={24} name="info" color="#059669" />
            <Text className="text-lg font-semibold text-gray-900 dark:text-white ml-2">
              {t('tilawah.tips')}
            </Text>
          </View>
          <Text className="text-gray-700 dark:text-gray-300 leading-6">
            {t('tilawah.tipsDescription')}
          </Text>
        </LinearGradient>
      </ScrollView>
    </SafeAreaView>
  );
}