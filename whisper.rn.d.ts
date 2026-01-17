declare module 'whisper.rn' {
  export interface WhisperContext {
    transcribe(
      audioPath: string,
      options?: {
        language?: string;
        maxLen?: number;
        tokenTimestamps?: boolean;
        speedUp?: boolean;
        translate?: boolean;
        offset?: number;
        duration?: number;
        maxContext?: number;
        maxSegmentLength?: number;
        splitOnWord?: boolean;
        bestOf?: number;
        beamSize?: number;
        wordThreshold?: number;
        entropyThreshold?: number;
        logprobThreshold?: number;
        compressionRatioThreshold?: number;
        noSpeechThreshold?: number;
        prompt?: string;
        temperature?: number;
      }
    ): {
      promise: Promise<{ result: string; segments?: any[] }>;
      stop: () => void;
    };
    release(): Promise<void>;
  }

  export interface InitOptions {
    filePath: string;
    isBundleAsset?: boolean;
  }

  export function initWhisper(options: InitOptions): Promise<WhisperContext>;
}