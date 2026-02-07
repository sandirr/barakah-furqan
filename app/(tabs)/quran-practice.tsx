import { useColorScheme } from '@/hooks/use-color-scheme';
import { Audio } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent
} from 'expo-speech-recognition';
import {
  CircleCheck,
  Info,
  Mic,
  MicOff,
  Play,
  RefreshCw,
  Square,
  X,
} from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Tts from 'react-native-tts';

// ========================================
// TYPE DEFINITIONS
// ========================================

interface Word {
  text: string;
  status: 'pending' | 'correct' | 'incorrect' | 'current';
  spokenText?: string;
}

// ========================================
// CONSTANTS
// ========================================

const SPEECH_LANG = 'ar-SA';
const RECOGNITION_TIMEOUT_MS = 15000;
const MAX_RECOGNITION_RETRIES = 1;

// ========================================
// MAIN COMPONENT
// ========================================

export default function TilawahScreen() {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const params = useLocalSearchParams();
  
  // States
  const [inputText, setInputText] = useState('');
  const [words, setWords] = useState<Word[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  
  const [hasMicPermission, setHasMicPermission] = useState(false);
  const [checkingPermission, setCheckingPermission] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [lastHeard, setLastHeard] = useState('');
  const [isMicTestActive, setIsMicTestActive] = useState(false);
  
  // Refs
  const recognitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const micTestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSpeakTypeRef = useRef<'sentence' | null>(null);
  const processingRef = useRef(false);
  const lastTranscriptRef = useRef('');
  const hasFinalResultRef = useRef(false);
  const retryCountRef = useRef(0);
  const wordsRef = useRef<Word[]>([]);
  const sessionActiveRef = useRef(false);

  // ========================================
  // LIFECYCLE
  // ========================================

  useEffect(() => {
    initializeScreen();
    return () => { cleanup(); };
  }, []);

  useEffect(() => {
    if (params.text && typeof params.text === 'string') {
      setInputText(params.text);
    }
  }, [params.text]);

  useEffect(() => {
    wordsRef.current = words;
  }, [words]);

  useSpeechRecognitionEvent('start', () => {
    setIsListening(true);
  });

  useSpeechRecognitionEvent('end', () => {
    setIsListening(false);
    if (sessionActiveRef.current && !processingRef.current) {
      const fallbackTranscript = lastTranscriptRef.current;
      handleTranscript(fallbackTranscript);
    }
  });

  useSpeechRecognitionEvent('result', (event) => {
    const transcript = event.results?.[0]?.transcript?.trim() ?? '';
    if (transcript) {
      lastTranscriptRef.current = transcript;
      setLastHeard(transcript);
    }
    if (!event.isFinal) return;
    hasFinalResultRef.current = true;
    handleTranscript(transcript || lastTranscriptRef.current);
  });

  useSpeechRecognitionEvent('nomatch', () => {
    handleTranscript('');
  });

  useSpeechRecognitionEvent('error', (event) => {
    if (event.error === 'aborted') return;
    handleTranscript('');
  });

  // ========================================
  // INITIALIZATION & CLEANUP
  // ========================================

  const cleanup = async () => {
    try {
      await ExpoSpeechRecognitionModule.abort();
      await Tts.stop();
    } catch (e) {
      console.log('Error stopping recognition:', e);
    }
    
    if (recognitionTimer.current) {
      clearTimeout(recognitionTimer.current);
    }
    if (micTestTimer.current) {
      clearTimeout(micTestTimer.current);
    }
  };

  const initializeScreen = async () => {
    await setupAudio();
    await checkPermissions();
    await setupTts();
  };

  const setupAudio = async () => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
    } catch (error) {
      console.error('Error setting up audio:', error);
    }
  };

  const setupTts = async () => {
    setIsInitializing(true);
    try {
      await Tts.getInitStatus();
      await Tts.setDefaultLanguage(SPEECH_LANG);
      await Tts.setDefaultRate(0.5);
      await Tts.setDefaultPitch(1.0);
    } catch (error) {
      console.error('Error setting up TTS:', error);
    } finally {
      setIsInitializing(false);
    }
  };

  // ========================================
  // PERMISSIONS
  // ========================================

  const checkPermissions = async () => {
    setCheckingPermission(true);
    try {
      const { status } = await ExpoSpeechRecognitionModule.getPermissionsAsync();
      setHasMicPermission(status === 'granted');
    } catch (error) {
      console.error('Error checking permissions:', error);
      setHasMicPermission(false);
    } finally {
      setCheckingPermission(false);
    }
  };

  const requestPermissions = async () => {
    try {
      const { status } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      setHasMicPermission(status === 'granted');
      
      if (status !== 'granted') {
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
  
  const startMicTest = async () => {
    if (sessionActiveRef.current || isRecording) {
      Alert.alert(t('tilawah.micTestTitle'), t('tilawah.micTestStopSession'));
      return;
    }

    if (!hasMicPermission) {
      await requestPermissions();
      if (!hasMicPermission) return;
    }

    setLastHeard('');
    setIsMicTestActive(true);

    try {
      ExpoSpeechRecognitionModule.start({
        lang: SPEECH_LANG,
        interimResults: true,
        continuous: false,
        maxAlternatives: 1,
        iosTaskHint: 'confirmation',
        androidIntentOptions: {
          EXTRA_LANGUAGE_MODEL: 'web_search'
        }
      });
    } catch (error) {
      console.error('Mic test start error:', error);
      setIsMicTestActive(false);
      return;
    }

    if (micTestTimer.current) clearTimeout(micTestTimer.current);
    micTestTimer.current = setTimeout(() => {
      try {
        ExpoSpeechRecognitionModule.stop();
      } catch (error) {
        console.error('Mic test stop error:', error);
      } finally {
        setIsMicTestActive(false);
      }
    }, RECOGNITION_TIMEOUT_MS);
  };

  const stopMicTest = async () => {
    if (micTestTimer.current) clearTimeout(micTestTimer.current);
    try {
      await ExpoSpeechRecognitionModule.stop();
    } catch (error) {
      console.error('Mic test stop error:', error);
    } finally {
      setIsMicTestActive(false);
    }
  };
  
  // ========================================
  // TTS & SPEECH RECOGNITION
  // ========================================

  const speakSentence = async () => {
    if (!sessionActiveRef.current) return;
    const sentence = wordsRef.current.map((word) => word.text).join(' ');
    if (!sentence) return;

    try {
      await Tts.stop();
      pendingSpeakTypeRef.current = 'sentence';
      Tts.speak(sentence);
    } catch (error) {
      console.error('TTS error:', error);
      startRecognitionForSentence();
    }
  };

  const startRecognitionForSentence = async () => {
    if (!sessionActiveRef.current) return;
    processingRef.current = false;
    hasFinalResultRef.current = false;
    lastTranscriptRef.current = '';
    const contextualStrings = wordsRef.current.map((word) => word.text);

    try {
      ExpoSpeechRecognitionModule.start({
        lang: SPEECH_LANG,
        interimResults: true,
        continuous: false,
        maxAlternatives: 1,
        iosTaskHint: 'confirmation',
        contextualStrings,
        androidIntentOptions: {
          EXTRA_LANGUAGE_MODEL: 'web_search'
        }
      });
    } catch (error) {
      console.error('Speech recognition start error:', error);
      handleTranscript('');
      return;
    }

    if (recognitionTimer.current) clearTimeout(recognitionTimer.current);
    recognitionTimer.current = setTimeout(() => {
      try {
        ExpoSpeechRecognitionModule.stop();
      } catch (error) {
        console.error('Speech recognition stop error:', error);
      }
    }, RECOGNITION_TIMEOUT_MS);
  };

  const handleTranscript = (transcript: string) => {
    if (!sessionActiveRef.current) return;
    if (processingRef.current) return;
    processingRef.current = true;

    if (recognitionTimer.current) {
      clearTimeout(recognitionTimer.current);
      recognitionTimer.current = null;
    }

    if (!transcript && retryCountRef.current < MAX_RECOGNITION_RETRIES) {
      retryCountRef.current += 1;
      processingRef.current = false;
      setTimeout(() => startRecognitionForSentence(), 300);
      return;
    }

    scoreTranscript(transcript);
  };

  const normalizeArabicText = (text: string): string => {
    return text
      .replace(/[\u064B-\u065F\u0670]/g, '') // Remove harakat
      .replace(/\u0640/g, '') // Remove tatweel
      .replace(/[إأآٱا]/g, 'ا') // Normalize alif
      .replace(/[يىئ]/g, 'ي') // Normalize yaa
      .replace(/ؤ/g, 'و')
      .replace(/ئ/g, 'ي')
      .replace(/ة/g, 'ه') // Normalize taa marbuta
      .replace(/[^\u0600-\u06FF\s]/g, '') // Remove punctuation/latin
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  };

  const tokenizeArabic = (text: string): string[] => {
    return text
      .split(/\s+/)
      .map((token) => token.trim())
      .filter(Boolean);
  };

  const buildVariants = (word: string): string[] => {
    const variants = new Set<string>();
    const base = normalizeArabicText(word);
    if (!base) return [];
    variants.add(base);

    const prefixes = ['و', 'ف', 'ب', 'ك', 'ل', 'س'];
    const maybeStripAl = (value: string) => {
      if (value.startsWith('ال') && value.length > 2) {
        variants.add(value.slice(2));
      }
    };

    maybeStripAl(base);

    prefixes.forEach((prefix) => {
      if (base.startsWith(prefix) && base.length > 1) {
        const withoutPrefix = base.slice(1);
        variants.add(withoutPrefix);
        maybeStripAl(withoutPrefix);
      }
      if (base.startsWith(prefix + 'ال') && base.length > 3) {
        variants.add(base.slice(3));
      }
    });

    return Array.from(variants);
  };

  const getSimilarityThreshold = (length: number): number => {
    if (length <= 2) return 0.85;
    if (length <= 4) return 0.75;
    if (length <= 6) return 0.7;
    return 0.65;
  };

  const scoreTranscript = (transcript: string) => {
    const expectedWords = wordsRef.current;
    const expectedTokens = expectedWords.map((word) => normalizeArabicText(word.text));
    const spokenTokens = tokenizeArabic(normalizeArabicText(transcript));

    const updatedWords: Word[] = expectedWords.map((word) => ({
      ...word,
      status: 'incorrect',
      spokenText: ''
    }));

    if (!spokenTokens.length || !expectedTokens.length) {
      finalizeScore(updatedWords);
      return;
    }

    const n = expectedTokens.length;
    const m = spokenTokens.length;
    const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));

    const matches = (i: number, j: number) => {
      return checkWordMatch(spokenTokens[j], expectedWords[i].text);
    };

    for (let i = 1; i <= n; i++) {
      for (let j = 1; j <= m; j++) {
        if (matches(i - 1, j - 1)) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }

    const matchedSpoken = new Set<number>();
    const expectedToSpoken: Array<number | null> = Array(n).fill(null);
    let i = n;
    let j = m;

    while (i > 0 && j > 0) {
      if (matches(i - 1, j - 1)) {
        expectedToSpoken[i - 1] = j - 1;
        matchedSpoken.add(j - 1);
        i -= 1;
        j -= 1;
      } else if (dp[i - 1][j] >= dp[i][j - 1]) {
        i -= 1;
      } else {
        j -= 1;
      }
    }

    const unmatchedSpoken = spokenTokens
      .map((token, index) => ({ token, index }))
      .filter(({ index }) => !matchedSpoken.has(index));

    for (let idx = 0; idx < n; idx++) {
      const mappedSpokenIndex = expectedToSpoken[idx];
      if (mappedSpokenIndex !== null) {
        updatedWords[idx] = {
          ...updatedWords[idx],
          status: 'correct',
          spokenText: spokenTokens[mappedSpokenIndex] ?? ''
        };
      } else if (unmatchedSpoken.length > 0) {
        let bestToken = '';
        let bestScore = 0;
        for (const candidate of unmatchedSpoken) {
          const score = calculateSimilarity(
            normalizeArabicText(candidate.token),
            normalizeArabicText(expectedWords[idx].text)
          );
          if (score > bestScore) {
            bestScore = score;
            bestToken = candidate.token;
          }
        }
        updatedWords[idx] = {
          ...updatedWords[idx],
          status: bestScore >= getSimilarityThreshold(expectedTokens[idx].length) ? 'correct' : 'incorrect',
          spokenText: bestToken
        };
      }
    }

    finalizeScore(updatedWords);
  };

  const finalizeScore = (updatedWords: Word[]) => {
    const correct = updatedWords.filter((word) => word.status === 'correct').length;
    setWords(updatedWords);
    setScore({ correct, total: updatedWords.length });
    setProgress(100);
    setIsRecording(false);
    setSessionComplete(true);
    sessionActiveRef.current = false;
  };

  const calculateSimilarity = (str1: string, str2: string): number => {
    const len1 = str1.length;
    const len2 = str2.length;
    
    if (len1 === 0) return len2 === 0 ? 1 : 0;
    if (len2 === 0) return 0;
    
    const matrix: number[][] = [];
    
    for (let i = 0; i <= len1; i++) matrix[i] = [i];
    for (let j = 0; j <= len2; j++) matrix[0][j] = j;
    
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }
    
    const distance = matrix[len1][len2];
    const maxLen = Math.max(len1, len2);
    
    return 1 - (distance / maxLen);
  };

  const checkWordMatch = (spokenText: string, expectedWord: string): boolean => {
    const normalizedSpoken = normalizeArabicText(spokenText);
    const normalizedExpected = normalizeArabicText(expectedWord);

    if (!normalizedExpected) return false;
    if (!normalizedSpoken) return false;

    const expectedVariants = buildVariants(normalizedExpected);
    const spokenTokens = tokenizeArabic(normalizedSpoken);
    const spokenVariants = spokenTokens.flatMap((token) => buildVariants(token));
    const allSpokenCandidates = [normalizedSpoken, ...spokenVariants];

    console.log('🔍 Matching:', {
      spoken: normalizedSpoken,
      expected: normalizedExpected,
      tokens: spokenTokens
    });

    for (const expected of expectedVariants) {
      for (const spoken of allSpokenCandidates) {
        if (!spoken) continue;
        if (spoken === expected) return true;
        if (spoken.includes(expected) || expected.includes(spoken)) return true;
      }
    }

    const threshold = getSimilarityThreshold(normalizedExpected.length);
    let bestSimilarity = 0;

    for (const expected of expectedVariants) {
      for (const spoken of allSpokenCandidates) {
        if (!spoken) continue;
        const similarity = calculateSimilarity(spoken, expected);
        bestSimilarity = Math.max(bestSimilarity, similarity);
      }
    }

    console.log('📊 Similarity:', bestSimilarity, 'threshold:', threshold);
    return bestSimilarity >= threshold;
  };

  // ========================================
  // SESSION MANAGEMENT
  // ========================================

  const completeSession = async () => {
    console.log('🏁 Complete!');
    setIsRecording(false);
    setSessionComplete(true);
    try {
      await ExpoSpeechRecognitionModule.abort();
      await Tts.stop();
    } catch (error) {
      console.log('Error finishing session:', error);
    }
  };

  const startSession = async () => {
    if (!inputText.trim()) {
      Alert.alert(t('common.error'), t('tilawah.enterTextFirst'));
      return;
    }

    const wordsArray = inputText.trim().split(/\s+/).map((text, index) => ({
      text,
      status: 'pending' as Word['status'],
    }));

    setWords(wordsArray);
    setProgress(0);
    setSessionComplete(false);
    setScore({ correct: 0, total: wordsArray.length });
    setIsRecording(true);
    sessionActiveRef.current = true;
    retryCountRef.current = 0;

    setTimeout(() => speakSentence(), 600);
  };

  const stopSession = async () => {
    sessionActiveRef.current = false;
    if (recognitionTimer.current) clearTimeout(recognitionTimer.current);
    try {
      await ExpoSpeechRecognitionModule.abort();
      await Tts.stop();
    } catch (error) {
      console.log('Error stopping session:', error);
    }
    setIsRecording(false);
  };

  const resetSession = () => {
    stopSession();
    setWords([]);
    setProgress(0);
    setSessionComplete(false);
    setScore({ correct: 0, total: 0 });
  };

  const useSampleText = () => {
    setInputText('بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ');
  };

  const getScorePercentage = (): number => {
    if (score.total === 0) return 0;
    return Math.round((score.correct / score.total) * 100);
  };

  // ========================================
  // RENDER
  // ========================================

  useEffect(() => {
    const handleTtsStart = () => setIsSpeaking(true);
    const handleTtsFinish = () => {
      setIsSpeaking(false);
      if (pendingSpeakTypeRef.current === 'sentence') {
        pendingSpeakTypeRef.current = null;
        startRecognitionForSentence();
      }
    };
    const handleTtsCancel = () => setIsSpeaking(false);

    Tts.addEventListener('tts-start', handleTtsStart);
    Tts.addEventListener('tts-finish', handleTtsFinish);
    Tts.addEventListener('tts-cancel', handleTtsCancel);

    return () => {
      Tts.removeEventListener('tts-start', handleTtsStart);
      Tts.removeEventListener('tts-finish', handleTtsFinish);
      Tts.removeEventListener('tts-cancel', handleTtsCancel);
    };
  }, []);

  if (checkingPermission) {
    return (
      <View className="flex-1 bg-white dark:bg-gray-900 items-center justify-center">
        <ActivityIndicator size="large" color="#0d9488" />
        <Text className="text-gray-600 dark:text-gray-400 mt-4">{t('tilawah.checking')}</Text>
      </View>
    );
  }

  if (!hasMicPermission) {
    return (
      <SafeAreaView className="flex-1 bg-teal-600 dark:bg-teal-700" edges={["top"]}>
        <View className="p-4">
          <Text className="text-2xl font-bold text-white">{t('tilawah.title')}</Text>
        </View>
        
        <View className="flex-1 items-center justify-center px-4 bg-white dark:bg-gray-900">
          <MicOff size={64} color="#dc2626" />
          <Text className="text-gray-900 dark:text-white text-center mt-4 text-xl font-bold">
            {t('tilawah.permissionRequired')}
          </Text>
          
          <View className="w-full mt-6 p-4 rounded-xl bg-red-50 dark:bg-red-950">
            <View className="flex-row items-center mb-2">
              <X size={24} color="#dc2626" />
              <Text className="ml-2 font-semibold text-red-700 dark:text-red-300">
                {t('tilawah.microphonePermission')}
              </Text>
            </View>
            <Text className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              {t('tilawah.permissionRequiredDesc')}
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

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-900" edges={["top"]}>
      <ScrollView className='flex-1' contentContainerStyle={{padding: 16}}>
        <View className="items-center mb-8">
          <View className="w-20 h-20 bg-teal-600 dark:bg-teal-700 rounded-full items-center justify-center mb-4">
            <Mic size={40} color="#FFFFFF" />
          </View>
          <Text className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {t('tilawah.title')}
          </Text>
        </View>

        {isInitializing && (
          <View className="bg-blue-50 dark:bg-blue-950 rounded-2xl p-6 mb-6">
            <ActivityIndicator size="large" color="#0d9488" />
            <Text className="text-center text-gray-900 dark:text-white mt-4 font-semibold">
              {t('tilawah.preparingSpeech')}
            </Text>
          </View>
        )}

        <View className="bg-teal-600 dark:bg-teal-700 rounded-3xl p-6 mb-6">
          <Text className="text-white text-xl font-bold mb-3">{t('tilawah.howToUse')}</Text>
          <Text className="text-teal-50">
            {t('tilawah.step1')}{'\n'}
            {t('tilawah.step2')}{'\n'}
            {t('tilawah.step3')}{'\n'}
            {t('tilawah.step4')}
          </Text>
        </View>

        <View className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 mb-6">
          <Text className="text-lg font-bold text-gray-900 dark:text-white mb-2">
            {t('tilawah.micTestTitle')}
          </Text>
          <Text className="text-gray-600 dark:text-gray-400 mb-3">
            {t('tilawah.micTestDesc')}
          </Text>
          <View className="flex-row gap-3 mb-4">
            {!isMicTestActive ? (
              <TouchableOpacity
                onPress={startMicTest}
                className="flex-1 bg-teal-600 dark:bg-teal-700 rounded-xl py-3"
              >
                <Text className="text-white font-semibold text-center">{t('tilawah.micTestStart')}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={stopMicTest}
                className="flex-1 bg-red-600 rounded-xl py-3"
              >
                <Text className="text-white font-semibold text-center">{t('tilawah.micTestStop')}</Text>
              </TouchableOpacity>
            )}
          </View>
          <View className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
            <Text className="text-gray-900 dark:text-white text-base">
              {lastHeard ? lastHeard : t('tilawah.micTestEmpty')}
            </Text>
          </View>
        </View>

        <View className="mb-6">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-lg font-bold text-gray-900 dark:text-white">
              {t('tilawah.quranText')}
            </Text>
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
          <TouchableOpacity onPress={useSampleText} disabled={isRecording}>
            <Text className={`text-teal-600 dark:text-teal-500 font-semibold text-right ${isRecording ? 'opacity-50' : ''}`}>
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
                  <View key={index}>
                    <View
                      className={`px-4 py-2 rounded-xl ${
                        word.status === 'correct'
                          ? 'bg-green-600'
                          : word.status === 'incorrect'
                          ? 'bg-red-600'
                          : word.status === 'current'
                          ? 'bg-amber-500'
                          : 'bg-gray-100 dark:bg-gray-700'
                      }`}
                    >
                      <Text className={`text-lg font-bold ${word.status !== 'pending' ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
                        {word.text}
                      </Text>
                    </View>
                    {word.spokenText && word.status === 'incorrect' && (
                      <Text className="text-xs text-red-600 text-center mt-1">
                        Said: {word.spokenText}
                      </Text>
                    )}
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
                <CircleCheck size={64} color="#FFFFFF" />
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
                  
                  {getScorePercentage() === 100 && (
                    <Text className="text-white text-center mt-4 text-xl">
                      {t('tilawah.perfect')}
                    </Text>
                  )}
                  {getScorePercentage() >= 80 && getScorePercentage() < 100 && (
                    <Text className="text-white text-center mt-4">
                      {t('tilawah.excellent')}
                    </Text>
                  )}
                  {getScorePercentage() < 80 && (
                    <Text className="text-white text-center mt-4">
                      {t('tilawah.keepPracticing')}
                    </Text>
                  )}
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
                <View className={`w-3 h-3 rounded-full mr-3 ${isRecording ? 'bg-red-500' : 'bg-gray-400'}`} />
                <Text className="text-gray-900 dark:text-white font-semibold">
                  {isRecording
                    ? isSpeaking
                      ? `🔊 ${t('tilawah.speaking')}`
                      : isListening
                        ? `🎤 ${t('tilawah.listening')}`
                        : `⏳ ${t('tilawah.preparing')}`
                    : `⏸️ ${t('tilawah.ready')}`}
                </Text>
              </View>
              {isRecording && (
                <View className="mt-3 bg-amber-50 dark:bg-amber-950 rounded-xl p-4">
                  <Text className="text-amber-900 dark:text-amber-100 font-semibold mb-2">
                    {t('tilawah.reciteSentenceTitle')}
                  </Text>
                  <Text className="text-amber-700 dark:text-amber-300 text-sm mt-1 text-center">
                    {t('tilawah.reciteSentenceDesc')}
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
                className={`flex-1 rounded-2xl py-4 ${
                  inputText.trim() && !isInitializing
                    ? 'bg-teal-600 dark:bg-teal-700'
                    : 'bg-gray-300 dark:bg-gray-700'
                }`}
              >
                <View className="flex-row items-center justify-center">
                  <Play size={24} color="#FFFFFF" />
                  <Text className="text-white font-bold text-lg ml-2">
                    {sessionComplete ? t('tilawah.startAgain') : t('tilawah.start')}
                  </Text>
                </View>
              </TouchableOpacity>
              {words.length > 0 && (
                <TouchableOpacity onPress={resetSession} className="bg-gray-600 rounded-2xl py-4 px-6">
                  <RefreshCw size={24} color="#FFFFFF" />
                </TouchableOpacity>
              )}
            </>
          ) : (
            <TouchableOpacity onPress={stopSession} className="flex-1 bg-red-600 rounded-2xl py-4">
              <View className="flex-row items-center justify-center">
                <Square size={24} color="#FFFFFF" />
                <Text className="text-white font-bold text-lg ml-2">{t('tilawah.stop')}</Text>
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
            <Info size={24} color="#059669" />
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