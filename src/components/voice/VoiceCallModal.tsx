import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, MicOff, PhoneOff, Video, VideoOff, PhoneCall } from 'lucide-react';

// 老师头像 — 使用真实 Unsplash 教师形象
const TEACHER_AVATAR = 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&h=400&fit=crop&auto=format';
const TEACHER_NAME = '智学助教';
const TEACHER_NUM = '10086';

type CallPhase = 'idle' | 'ringing' | 'connected';

interface VoiceCallModalProps {
  open: boolean;
  onClose: () => void;
}

export default function VoiceCallModal({ open, onClose }: VoiceCallModalProps) {
  const [phase, setPhase] = useState<CallPhase>('idle');
  const [muted, setMuted] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ringTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // 打开时重置并开始拨号
  useEffect(() => {
    if (open) {
      setPhase('ringing');
      setElapsed(0);
      setMuted(false);
      setCamOn(false);
      ringTimeoutRef.current = setTimeout(() => setPhase('connected'), 2500);
    } else {
      setPhase('idle');
      clearTimers();
      stopCamera();
    }
    return () => { clearTimers(); stopCamera(); };
  }, [open]);

  // 计时器
  useEffect(() => {
    if (phase === 'connected') {
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    } else {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    }
  }, [phase]);

  // 摄像头开关
  useEffect(() => {
    if (camOn) {
      navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'user' }, audio: false })
        .then(stream => {
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(() => {});
          }
        })
        .catch(() => setCamOn(false));
    } else {
      stopCamera();
    }
  }, [camOn]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  const clearTimers = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (ringTimeoutRef.current) { clearTimeout(ringTimeoutRef.current); ringTimeoutRef.current = null; }
  };

  const handleHangup = () => {
    clearTimers();
    stopCamera();
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
                    <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/60" />

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
                    <div className="absolute top-4 left-1/2 -translate-x-1/2">
                      <span className="text-white/80 text-sm font-mono bg-black/30 rounded-full px-3 py-1 backdrop-blur-sm">
                        {formatTime(elapsed)}
                      </span>
                    </div>

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
