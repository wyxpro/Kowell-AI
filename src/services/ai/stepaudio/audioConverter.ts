/**
 * 录音数据转换工具
 * 用于将浏览器的任意录音格式 (如 webm/ogg) 转换为 16000Hz、16-bit、单声道的标准 WAV 格式，
 * 从而确保 StepAudio ASR 语音识别的最高正确率与兼容性。
 */

/**
 * 将录制的音频 Blob 转换为标准 WAV Blob
 * @param blob 原始音频 Blob
 */
export async function convertBlobToWav(blob: Blob): Promise<Blob> {
  const arrayBuffer = await blob.arrayBuffer();
  
  // 创建 AudioContext 用于解码
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) {
    throw new Error('当前浏览器不支持 Web Audio API');
  }
  
  const audioContext = new AudioContextClass();
  let audioBuffer: AudioBuffer;
  try {
    audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  } catch (err) {
    console.error('解码音频数据失败:', err);
    audioContext.close();
    throw new Error('音频解码失败，请确保录音格式正确');
  }

  // 目标采样率 16000 Hz, 单声道
  const targetSampleRate = 16000;
  const offlineCtx = new OfflineAudioContext(
    1,
    Math.max(1, Math.ceil(audioBuffer.duration * targetSampleRate)),
    targetSampleRate
  );

  const bufferSource = offlineCtx.createBufferSource();
  bufferSource.buffer = audioBuffer;
  bufferSource.connect(offlineCtx.destination);
  bufferSource.start();

  let resampledBuffer: AudioBuffer;
  try {
    resampledBuffer = await offlineCtx.startRendering();
  } catch (err) {
    console.error('重采样音频失败:', err);
    throw new Error('音频重采样失败');
  } finally {
    audioContext.close();
  }

  // 将重采样后的 AudioBuffer 编码为 WAV 字节流
  const wavBytes = encodeWAV(resampledBuffer);
  return new Blob([wavBytes], { type: 'audio/wav' });
}

/**
 * WAV 编码器逻辑 (PCM 16-bit Mono)
 */
function encodeWAV(audioBuffer: AudioBuffer): ArrayBuffer {
  const channelData = audioBuffer.getChannelData(0); // 单声道数据
  const sampleRate = audioBuffer.sampleRate;
  const buffer = new ArrayBuffer(44 + channelData.length * 2);
  const view = new DataView(buffer);

  /* RIFF 标识符 */
  writeString(view, 0, 'RIFF');
  /* 文件长度 (44字节头部之后的字节数 + 36) */
  view.setUint32(4, 36 + channelData.length * 2, true);
  /* RIFF 类型 */
  writeString(view, 8, 'WAVE');
  /* 格式块标识符 */
  writeString(view, 12, 'fmt ');
  /* 格式块长度 */
  view.setUint32(16, 16, true);
  /* 编码格式 (1 = 线性 PCM) */
  view.setUint16(20, 1, true);
  /* 声道数 (1 = 单声道) */
  view.setUint16(22, 1, true);
  /* 采样率 */
  view.setUint32(24, sampleRate, true);
  /* 传输速率 (采样率 * 播放通道数 * 每个采样位深 / 8) */
  view.setUint32(28, sampleRate * 2, true);
  /* 块对齐 (通道数 * 每个采样位深 / 8) */
  view.setUint16(32, 2, true);
  /* 采样位深 (16-bit) */
  view.setUint16(34, 16, true);
  /* 数据块标识符 */
  writeString(view, 36, 'data');
  /* 数据段长度 (通道数 * 采样点数 * 每个采样位深 / 8) */
  view.setUint32(40, channelData.length * 2, true);

  // 写入 PCM 采样数据
  let offset = 44;
  for (let i = 0; i < channelData.length; i++, offset += 2) {
    let s = Math.max(-1, Math.min(1, channelData[i]));
    // 转换为 16-bit 有符号整数
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }

  return buffer;
}

/**
 * 辅助写入 ASCII 字符串
 */
function writeString(view: DataView, offset: number, string: string): void {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
