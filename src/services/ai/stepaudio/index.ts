import { convertBlobToWav } from './audioConverter';

export interface ASRRequest {
  audioData: string; // Base64 encoded audio
  type: 'ogg' | 'mp3' | 'wav' | 'pcm';
  rate?: number;
  bits?: number;
  channel?: number;
  language?: string;
}

export interface TTSRequest {
  text: string;
  voice?: string;
  instruction?: string;
  format?: 'mp3' | 'wav';
}

export interface ASRCallbacks {
  onChunk?: (text: string) => void;
  onError?: (err: string) => void;
  onDone?: (fullText: string) => void;
}

/**
 * 将 Blob 转换为 Base64 编码的 String (去掉了 Data URL 前缀)
 */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export const stepAudioService = {
  /**
   * 语音识别 (ASR) - 使用 stepaudio-2.5-asr 流式识别接口
   * @param params 识别参数
   * @param callbacks 回调函数
   */
  async speechToText(params: ASRRequest, callbacks?: ASRCallbacks): Promise<string> {
    const url = '/api/stepaudio/audio/asr/sse';
    const body = {
      audio: {
        data: params.audioData,
        input: {
          transcription: {
            model: 'stepaudio-2.5-asr',
            language: params.language || 'zh',
            enable_itn: true,
            enable_timestamp: false
          },
          format: {
            type: params.type,
            ...(params.type === 'pcm' ? {
              codec: 'pcm_s16le',
              rate: params.rate || 16000,
              bits: params.bits || 16,
              channel: params.channel || 1
            } : {
              rate: params.rate,
              bits: params.bits,
              channel: params.channel
            })
          }
        }
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errText = await response.text();
      const errMsg = `StepAudio ASR failed (${response.status}): ${errText}`;
      if (callbacks?.onError) callbacks.onError(errMsg);
      throw new Error(errMsg);
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let fullText = '';
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        
        // 保存最后一个未完结的行到 buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          const cleanLine = line.trim();
          if (!cleanLine) continue;

          // SSE format: "data: { ... }"
          if (cleanLine.startsWith('data:')) {
            const jsonStr = cleanLine.slice(5).trim();
            if (!jsonStr) continue;

            try {
              const parsed = JSON.parse(jsonStr);
              if (parsed.type === 'transcript.text.delta' && parsed.delta) {
                fullText += parsed.delta;
                if (callbacks?.onChunk) callbacks.onChunk(parsed.delta);
              } else if (parsed.type === 'transcript.text.done') {
                if (parsed.text) {
                  fullText = parsed.text;
                }
              } else if (parsed.type === 'error') {
                throw new Error(parsed.message || 'ASR stream error');
              }
            } catch (e) {
              console.error('Failed to parse ASR SSE chunk:', e);
            }
          }
        }
      }

      if (callbacks?.onDone) callbacks.onDone(fullText);
      return fullText;
    } catch (err) {
      const errMsg = (err as Error).message;
      if (callbacks?.onError) callbacks.onError(errMsg);
      throw err;
    }
  },

  /**
   * 辅助方法：直接将录音 Blob 识别为文字
   * @param rawBlob 录制得到的音量 Blob (比如 webm)
   * @param language 识别语言，默认 'zh'
   */
  async transcribeBlob(rawBlob: Blob, language = 'zh', callbacks?: ASRCallbacks): Promise<string> {
    try {
      // 1. 转换为 16000Hz WAV
      const wavBlob = await convertBlobToWav(rawBlob);
      // 2. 转为 Base64
      const base64Data = await blobToBase64(wavBlob);
      // 3. 调用 ASR 接口
      return await this.speechToText({
        audioData: base64Data,
        type: 'wav',
        language
      }, callbacks);
    } catch (error) {
      console.error('Transcribe blob failed:', error);
      throw error;
    }
  },

  /**
   * 语音合成 (TTS) - 使用 stepaudio-2.5-tts 接口
   * @param params 合成参数
   * @returns 返回音频 Blob
   */
  async textToSpeech(params: TTSRequest): Promise<Blob> {
    const url = '/api/stepaudio/audio/speech';
    const body = {
      model: 'stepaudio-2.5-tts',
      input: params.text,
      voice: params.voice || 'cixingnansheng',
      instruction: params.instruction || '语气温柔，语速偏慢',
      response_format: params.format || 'mp3'
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`StepAudio TTS failed (${response.status}): ${errText}`);
    }

    return await response.blob();
  }
};
