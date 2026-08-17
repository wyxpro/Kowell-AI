import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, MicOff, PhoneOff, Video, VideoOff } from 'lucide-react';
import { toast } from 'sonner';
import { stepAudioService } from '@/services/ai';
import { stepfunService } from '@/services/ai/stepfun';

// 老师头像 — 使用真实智能辅导形象
const TEACHER_AVATAR = 'https://img1.baidu.com/it/u=2930906500,654780520&fm=253&fmt=auto&app=138&f=PNG?w=500&h=529';
const TEACHER_NAME = '您的 AI 智学助教';
const TEACHER_NUM = '小智老师';

type CallPhase = 'idle' | 'ringing' | 'connected';
type VoiceStatus = 'idle' | 'ai-speaking' | 'user-listening' | 'ai-thinking';

interface VoiceCallModalProps {
  open: boolean;
  onClose: () => void;
}

export default function VoiceCallModal({ open, onClose }: VoiceCallModalProps) {
  const [phase, setPhase] = useState<CallPhase>('idle');
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>('idle');
  const [muted, setMuted] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [subtitles, setSubtitles] = useState('');
  const [audioVolume, setAudioVolume] = useState(0);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ringTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // 语音会话状态
  const conversationHistory = useRef<Array<{ role: 'user' | 'assistant' | 'system'; content: string }>>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const activeStreamRef = useRef<MediaStream | null>(null);
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);
  const ttsUrlRef = useRef<string | null>(null);
  const ttsFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionIdRef = useRef(0);
  const requestAbortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  const isCurrentSession = useCallback((sessionId: number) => (
    mountedRef.current && open && sessionId === sessionIdRef.current
  ), [open]);

  const invalidateSession = useCallback(() => {
    sessionIdRef.current += 1;
    requestAbortRef.current?.abort();
    requestAbortRef.current = null;
  }, []);

  const awaitWithAbort = useCallback(<T,>(promise: Promise<T>, signal: AbortSignal): Promise<T> => (
    new Promise<T>((resolve, reject) => {
      const abort = () => reject(new DOMException('Aborted', 'AbortError'));
      if (signal.aborted) {
        abort();
        return;
      }
      signal.addEventListener('abort', abort, { once: true });
      promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
    })
  ), []);

  // 停止全部媒体资源
  const stopAllMedia = useCallback(() => {
    // 停止摄像头
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;

    // 停止麦克风
    if (activeStreamRef.current) {
      activeStreamRef.current.getTracks().forEach(t => t.stop());
      activeStreamRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {
        // ignore
      }
    }
    
    // 停止播放 TTS，并清除事件、延迟回调和临时 URL。
    if (ttsFallbackTimerRef.current) {
      clearTimeout(ttsFallbackTimerRef.current);
      ttsFallbackTimerRef.current = null;
    }
    if (ttsAudioRef.current) {
      ttsAudioRef.current.onended = null;
      ttsAudioRef.current.onerror = null;
      ttsAudioRef.current.pause();
      ttsAudioRef.current.src = '';
      ttsAudioRef.current = null;
    }
    if (ttsUrlRef.current) {
      URL.revokeObjectURL(ttsUrlRef.current);
      ttsUrlRef.current = null;
    }

    // 关闭 Web Audio API
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch (e) {
        // ignore
      }
      audioContextRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    analyserRef.current = null;
    setAudioVolume(0);
  }, []);

  // 语音合成播放逻辑
  const playTTS = useCallback(async (text: string, sessionId = sessionIdRef.current) => {
    if (!isCurrentSession(sessionId)) return;
    const controller = new AbortController();
    requestAbortRef.current?.abort();
    requestAbortRef.current = controller;

    const resumeListeningLater = () => {
      if (ttsFallbackTimerRef.current) clearTimeout(ttsFallbackTimerRef.current);
      ttsFallbackTimerRef.current = setTimeout(() => {
        if (isCurrentSession(sessionId)) startListening(sessionId);
      }, 3000);
    };

    try {
      setVoiceStatus('ai-speaking');
      setSubtitles(text);

      const audioBlob = await awaitWithAbort(stepAudioService.textToSpeech({
        text,
        voice: 'cixingnansheng',
        instruction: '语气温柔，语速适中',
      }), controller.signal);

      if (controller.signal.aborted || !isCurrentSession(sessionId)) return;
      const url = URL.createObjectURL(audioBlob);
      if (ttsAudioRef.current) {
        ttsAudioRef.current.onended = null;
        ttsAudioRef.current.onerror = null;
        ttsAudioRef.current.pause();
      }
      if (ttsUrlRef.current) URL.revokeObjectURL(ttsUrlRef.current);

      const audio = new Audio(url);
      ttsAudioRef.current = audio;
      ttsUrlRef.current = url;

      audio.onended = () => {
        if (ttsAudioRef.current === audio) ttsAudioRef.current = null;
        if (ttsUrlRef.current === url) {
          URL.revokeObjectURL(url);
          ttsUrlRef.current = null;
        }
        if (isCurrentSession(sessionId)) startListening(sessionId);
      };

      audio.onerror = () => {
        if (ttsAudioRef.current === audio) ttsAudioRef.current = null;
        if (ttsUrlRef.current === url) {
          URL.revokeObjectURL(url);
          ttsUrlRef.current = null;
        }
        if (isCurrentSession(sessionId)) resumeListeningLater();
      };

      await audio.play();
    } catch (err) {
      if ((err as Error).name !== 'AbortError' && isCurrentSession(sessionId)) {
        resumeListeningLater();
      }
    }
  }, [isCurrentSession]);

  // 开始录制学生声音并分析音量 (VAD 逻辑)
  const startListening = useCallback(async (sessionId = sessionIdRef.current) => {
    if (!isCurrentSession(sessionId)) return;
    // 确保清理以前的录音
    if (activeStreamRef.current) {
      activeStreamRef.current.getTracks().forEach(t => t.stop());
      activeStreamRef.current = null;
    }
    if (audioContextRef.current) {
      try { audioContextRef.current.close(); } catch (e) {}
      audioContextRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (!isCurrentSession(sessionId)) return;
    setVoiceStatus('user-listening');
    setAudioVolume(0);

    if (muted) {
      setSubtitles('🎙️ 您当前处于静音状态');
      return;
    }

    setSubtitles('');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!isCurrentSession(sessionId)) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      activeStreamRef.current = stream;

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = () => {
        if (!isCurrentSession(sessionId)) return;
        const rawBlob = new Blob(chunks, { type: 'audio/webm' });
        // 开启 ASR -> LLM -> TTS 处理流
        void processUserSpeech(rawBlob, sessionId);
      };

      recorder.start();

      // 设置 Web Audio 分析器以获得音量大小并检测沉默 (VAD)
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const audioCtx = new AudioCtx();
        audioContextRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        analyserRef.current = analyser;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        let lastVoiceTime = Date.now();

        const checkVAD = () => {
          if (!isCurrentSession(sessionId) || !analyserRef.current || recorder.state === 'inactive') return;

          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const average = sum / dataArray.length;
          setAudioVolume(average);

          // 判定是否有说话声 (音量阈值设为 8)
          if (average > 8) {
            lastVoiceTime = Date.now();
          } else {
            // 如果连续沉默超过 3.5 秒，自动截断发送
            if (Date.now() - lastVoiceTime > 3500) {
              if (recorder.state === 'recording') {
                recorder.stop();
                return;
              }
            }
          }
          animationFrameRef.current = requestAnimationFrame(checkVAD);
        };
        animationFrameRef.current = requestAnimationFrame(checkVAD);
      }

    } catch {
      if (isCurrentSession(sessionId)) setSubtitles('❌ 无法访问麦克风');
    }
  }, [isCurrentSession, muted]);

  // 处理学生录音
  const processUserSpeech = useCallback(async (audioBlob: Blob, sessionId = sessionIdRef.current) => {
    if (!isCurrentSession(sessionId)) return;
    const controller = new AbortController();
    requestAbortRef.current?.abort();
    requestAbortRef.current = controller;
    setVoiceStatus('ai-thinking');
    setAudioVolume(0);

    try {
      // 1. 调用 StepAudio-2.5-ASR 语音转写
      const text = await awaitWithAbort(
        stepAudioService.transcribeBlob(audioBlob),
        controller.signal,
      );
      if (controller.signal.aborted || !isCurrentSession(sessionId)) return;
      if (!text || !text.trim()) {
        await playTTS('同学，我刚才没有听清楚，请您再说一遍。', sessionId);
        return;
      }

      // 保存记录
      conversationHistory.current.push({ role: 'user', content: text });

      // 2. 调用 StepFun 模型回复
      const systemPrompt = {
        role: 'system' as const,
        content: '你是一位耐心的AI学业助教。你正在和学生进行实时语音通话。请用极其简短、亲切、口语化的中文口头回答。绝对不能包含任何Markdown符号（如加粗、标题、列表等），字数严格控制在3句话、70字以内。不要包含任何思考过程或标签。'
      };

      // 保留最近 3 轮对话，防历史过多
      const recentHistory = conversationHistory.current.slice(-6);
      const messages = [systemPrompt, ...recentHistory];

      const reply = await stepfunService.chat(messages, { signal: controller.signal });
      if (controller.signal.aborted || !isCurrentSession(sessionId)) return;
      conversationHistory.current.push({ role: 'assistant', content: reply });

      // 3. 播放 AI TTS 回复
      await playTTS(reply, sessionId);

    } catch (err) {
      if ((err as Error).name !== 'AbortError' && isCurrentSession(sessionId)) {
        await playTTS('网络好似有点开小差，请您再试一次。', sessionId);
      }
    }
  }, [awaitWithAbort, isCurrentSession, playTTS]);

  // 手动点击 "说完了，发送"
  const handleFinishSpeaking = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  // 打开时初始化
  useEffect(() => {
    if (open) {
      mountedRef.current = true;
      const sessionId = sessionIdRef.current + 1;
      sessionIdRef.current = sessionId;
      requestAbortRef.current?.abort();
      requestAbortRef.current = null;
      setPhase('connected');
      setElapsed(0);
      setMuted(false);
      setCamOn(false);
      setSubtitles('');
      setVoiceStatus('idle');
      conversationHistory.current = [];

      // 通话连接成功，播报欢迎词
      void playTTS('同学你好！我是小智老师。今天有什么学业难题需要我解答吗？', sessionId);
    } else {
      invalidateSession();
      setPhase('idle');
      setVoiceStatus('idle');
      clearTimers();
      stopAllMedia();
    }
    return () => {
      invalidateSession();
      clearTimers();
      stopAllMedia();
    };
  }, [open, invalidateSession, playTTS, stopAllMedia]);

  useEffect(() => () => {
    mountedRef.current = false;
    invalidateSession();
    clearTimers();
    stopAllMedia();
  }, [invalidateSession, stopAllMedia]);

  // 计时器
  useEffect(() => {
    if (phase === 'connected') {
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [phase]);

  // 监听静音变更
  useEffect(() => {
    if (phase !== 'connected') return;

    if (muted) {
      // 停止当前的录音
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      setVoiceStatus('user-listening');
      setSubtitles('🎙️ 您当前处于静音状态');
    } else {
      // 恢复录音
      if (voiceStatus === 'user-listening') {
        startListening();
      }
    }
  }, [muted, phase, startListening, voiceStatus]);

  // 摄像头开关
  useEffect(() => {
    if (camOn) {
      const sessionId = sessionIdRef.current;
      navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'user' }, audio: false })
        .then(stream => {
          if (!isCurrentSession(sessionId) || !camOn) {
            stream.getTracks().forEach(track => track.stop());
            return;
          }
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(() => {});
          }
        })
        .catch(() => {
          if (isCurrentSession(sessionId)) setCamOn(false);
        });
    } else {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      if (videoRef.current) videoRef.current.srcObject = null;
    }
  }, [camOn, isCurrentSession]);

  const clearTimers = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (ringTimeoutRef.current) { clearTimeout(ringTimeoutRef.current); ringTimeoutRef.current = null; }
  };

  const handleHangup = () => {
    // Invalidate before stopping the recorder so its onstop handler cannot upload.
    invalidateSession();
    clearTimers();
    stopAllMedia();
    onClose();
  };

  const formatTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  if (!open) return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center"
        >
          {/* 背景蒙层 */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleHangup} />

          <motion.div
            initial={{ scale: 0.92, opacity: 0, y: 24 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 24 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className="relative w-[340px] md:w-[380px] rounded-3xl overflow-hidden shadow-2xl"
            style={{ background: 'linear-gradient(180deg, #1a2035 0%, #0d1220 100%)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* ── 拨号中界面 ── */}
            <AnimatePresence mode="wait">
              {phase === 'ringing' && (
                <motion.div
                  key="ringing"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center px-8 py-12 gap-6"
                >
                  <div className="relative">
                    {[1, 2, 3].map(i => (
                      <motion.div
                        key={i}
                        className="absolute inset-0 rounded-2xl border border-sky-400/30"
                        animate={{ scale: [1, 1.18 + i * 0.1], opacity: [0.6, 0] }}
                        transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.5, ease: 'easeOut' }}
                      />
                    ))}
                    <img
                      src={TEACHER_AVATAR}
                      alt="老师头像"
                      className="w-28 h-28 rounded-2xl object-cover relative z-10 ring-2 ring-sky-400/40"
                    />
                  </div>
                  <div className="text-center">
                    <p className="text-white text-2xl font-semibold tracking-wide">{TEACHER_NUM}</p>
                    <p className="text-sky-300/70 text-sm mt-1">{TEACHER_NAME}</p>
                    <motion.p
                      className="text-white/50 text-xs mt-2"
                      animate={{ opacity: [0.4, 1, 0.4] }}
                      transition={{ duration: 1.4, repeat: Infinity }}
                    >
                      正在呼叫...
                    </motion.p>
                  </div>
                  <div className="mt-4 flex flex-col items-center gap-1">
                    <button
                      type="button"
                      onClick={handleHangup}
                      className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 active:scale-95 transition-all flex items-center justify-center shadow-lg shadow-red-500/30"
                    >
                      <PhoneOff className="w-7 h-7 text-white" />
                    </button>
                    <span className="text-white/50 text-xs mt-1">挂断</span>
                  </div>
                </motion.div>
              )}

              {/* ── 通话中界面 ── */}
              {phase === 'connected' && (
                <motion.div
                  key="connected"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="relative"
                >
                  {/* 对方全屏画面 */}
                  <div className="relative w-full h-[480px] md:h-[520px] overflow-hidden">
                    <img
                      src={TEACHER_AVATAR}
                      alt="老师画面"
                      className="w-full h-full object-cover object-top"
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/70" />

                    {/* 右上角：自己摄像头小画面 */}
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.3 }}
                      className="absolute top-4 right-4 w-20 h-24 rounded-xl overflow-hidden ring-2 ring-white/40 shadow-lg bg-zinc-800"
                    >
                      {camOn ? (
                        <video
                          ref={videoRef}
                          autoPlay
                          playsInline
                          muted
                          className="w-full h-full object-cover scale-x-[-1]"
                        />
                      ) : (
                        <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
                          <VideoOff className="w-5 h-5 text-white/30" />
                        </div>
                      )}
                    </motion.div>

                    {/* 通话时长 */}
                    <div className="absolute top-4 left-4">
                      <span className="text-white/80 text-sm font-mono bg-black/30 rounded-full px-3 py-1 backdrop-blur-sm">
                        {formatTime(elapsed)}
                      </span>
                    </div>

                    {/* 🎙️ 实时语音字幕 & 状态面板 */}
                    <div className="absolute top-32 left-4 right-4 bg-black/60 backdrop-blur-md rounded-2xl p-4 border border-white/10 text-white flex flex-col gap-2 max-h-[160px] overflow-y-auto">
                      {voiceStatus === 'ai-speaking' && (
                        <div className="flex gap-2 items-start">
                          <div className="w-5 h-5 rounded-full bg-sky-500 flex items-center justify-center text-[10px] shrink-0 font-bold">助</div>
                          <p className="text-xs text-sky-200 leading-relaxed font-medium">{subtitles}</p>
                        </div>
                      )}
                      {voiceStatus === 'user-listening' && (
                        <div className="flex flex-col gap-1.5 w-full">
                          <div className="flex gap-2 items-start">
                            <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-[10px] shrink-0 font-bold">你</div>
                            <p className="text-xs text-emerald-200 leading-relaxed font-medium">
                              {subtitles || <span className="text-white/40 italic">助教正在聆听您的提问... 请直接说话</span>}
                            </p>
                          </div>
                          {/* 实时音量波形动画 */}
                          {!muted && (
                            <div className="flex items-center gap-0.5 justify-start pl-7 mt-1 h-3">
                              {[1, 2, 3, 4, 5, 6, 7, 8].map((idx) => {
                                const scale = 0.5 + (audioVolume / 255) * 2.5 * (Math.sin(idx * 0.8 + Date.now() * 0.05) * 0.5 + 0.5);
                                return (
                                  <div
                                    key={idx}
                                    className="w-[3px] bg-emerald-400 rounded-full transition-all duration-75"
                                    style={{
                                      height: `${Math.max(3, 12 * scale)}px`,
                                    }}
                                  />
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                      {voiceStatus === 'ai-thinking' && (
                        <div className="flex gap-2 items-center">
                          <div className="w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center text-[10px] shrink-0 font-bold">助</div>
                          <p className="text-xs text-amber-200 animate-pulse font-medium">正在识别并分析回答，请稍候...</p>
                        </div>
                      )}
                    </div>

                    {/* 我已说完 悬浮提交按钮 */}
                    {voiceStatus === 'user-listening' && !muted && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="absolute bottom-28 left-1/2 -translate-x-1/2"
                      >
                        <button
                          onClick={handleFinishSpeaking}
                          className="px-4 py-2 rounded-full bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white text-xs font-semibold shadow-lg shadow-emerald-500/30 flex items-center gap-1.5 transition-all"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                          说完了，发送
                        </button>
                      </motion.div>
                    )}

                    {/* 底部控制栏：静音 + 摄像头 + 挂断 （3个按钮）*/}
                    <div className="absolute bottom-0 left-0 right-0 px-8 pb-7 pt-8">
                      <div className="flex items-end justify-around">
                        {/* 静音 */}
                        <CtrlBtn
                          icon={muted ? MicOff : Mic}
                          label={muted ? '取消静音' : '静音'}
                          active={muted}
                          onClick={() => setMuted(v => !v)}
                        />
                        {/* 挂断 — 红色中央大按钮 */}
                        <div className="flex flex-col items-center gap-1">
                          <button
                            type="button"
                            onClick={handleHangup}
                            className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 active:scale-95 transition-all flex items-center justify-center shadow-xl shadow-red-500/40"
                          >
                            <PhoneOff className="w-7 h-7 text-white" />
                          </button>
                          <span className="text-white/60 text-xs">挂断</span>
                        </div>
                        {/* 摄像头 */}
                        <CtrlBtn
                          icon={camOn ? Video : VideoOff}
                          label={camOn ? '关摄像头' : '开摄像头'}
                          active={!camOn}
                          onClick={() => setCamOn(v => !v)}
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── 控制按钮子组件 ──────────────────────────────────────────────
function CtrlBtn({ icon: Icon, label, active, onClick }: {
  icon: React.ElementType;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={onClick}
        className={`w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-90 ${
          active ? 'bg-white/20 ring-1 ring-white/30' : 'bg-black/40 hover:bg-black/60'
        }`}
      >
        <Icon className={`w-5 h-5 ${active ? 'text-white' : 'text-white/80'}`} />
      </button>
      <span className="text-white/50 text-[10px] whitespace-nowrap">{label}</span>
    </div>
  );
}
