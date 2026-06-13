import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Settings2, Mic, MicOff, Volume2, VolumeX,
  Smile, Meh, Frown, Zap, X, ChevronDown, ChevronUp,
  User, Palette, Shirt, ImagePlus, Check,
} from 'lucide-react';

// 预设背景
const PRESET_BACKGROUNDS = [
  { id: 'default', label: '默认光晕', url: '', type: 'gradient' as const },
  { id: 'classroom', label: '教室场景', url: 'https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=400&h=600&fit=crop', type: 'image' as const },
  { id: 'library', label: '图书馆', url: 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=400&h=600&fit=crop', type: 'image' as const },
  { id: 'tech', label: '科技空间', url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=400&h=600&fit=crop', type: 'image' as const },
  { id: 'nature', label: '自然绿意', url: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400&h=600&fit=crop', type: 'image' as const },
  { id: 'office', label: '现代办公', url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=400&h=600&fit=crop', type: 'image' as const },
];

// ─── 数字人外观配置类型 ───────────────────────────────────────────
export interface TeacherConfig {
  name: string;
  style: 'academic' | 'casual' | 'tech' | 'elegant';
  skinTone: 'warm' | 'cool' | 'natural';
  hairColor: string;
  outfitColor: string;
  voice: 'gentle' | 'energetic' | 'calm';
  emotion: 'neutral' | 'happy' | 'thinking' | 'encouraging';
}

const DEFAULT_CONFIG: TeacherConfig = {
  name: '小智',
  style: 'academic',
  skinTone: 'warm',
  hairColor: '#2d1b00',
  outfitColor: '#1a3a6b',
  voice: 'gentle',
  emotion: 'neutral',
};

const STYLE_LABELS: Record<string, string> = {
  academic: '学院风', casual: '休闲风', tech: '科技感', elegant: '优雅风',
};
const VOICE_LABELS: Record<string, string> = {
  gentle: '温柔型', energetic: '活力型', calm: '沉稳型',
};
const EMOTION_COLORS: Record<string, string> = {
  neutral: '#6b7280', happy: '#f59e0b', thinking: '#8b5cf6', encouraging: '#10b981',
};
const EMOTION_LABELS: Record<string, string> = {
  neutral: '专注', happy: '开心', thinking: '思考中', encouraging: '加油！',
};

// ─── SVG 数字人渲染 ────────────────────────────────────────────────
function AvatarSVG({ config, speaking, emotion }: {
  config: TeacherConfig;
  speaking: boolean;
  emotion: string;
}) {
  const skinColors = { warm: '#f4c2a1', cool: '#dde8f0', natural: '#e8c49a' };
  const skin = skinColors[config.skinTone];
  const outfit = config.outfitColor;
  const hair = config.hairColor;

  // 表情映射
  const eyeShape = emotion === 'happy' ? 'M32,38 Q36,34 40,38' : emotion === 'thinking' ? 'M32,36 L40,36' : 'M32,37 Q36,33 40,37';
  const mouthShape = emotion === 'happy'
    ? 'M30,52 Q36,58 42,52'
    : emotion === 'encouraging'
      ? 'M30,51 Q36,57 42,51'
      : emotion === 'thinking'
        ? 'M30,53 L42,53'
        : 'M30,52 Q36,56 42,52';

  return (
    <svg viewBox="0 0 72 120" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      {/* 身体/衣服 */}
      <ellipse cx="36" cy="100" rx="22" ry="28" fill={outfit} opacity="0.95" />
      {/* 衬衫领口 */}
      <path d="M24,78 Q36,86 48,78 L50,90 Q36,96 22,90 Z" fill={outfit} />
      {/* 白色衬衣细节 */}
      {config.style === 'academic' && (
        <path d="M34,82 L34,95 M38,82 L38,95" stroke="white" strokeWidth="0.8" opacity="0.6" />
      )}
      {/* 脖子 */}
      <rect x="32" y="68" width="8" height="12" rx="3" fill={skin} />
      {/* 头部 */}
      <ellipse cx="36" cy="46" rx="20" ry="23" fill={skin} />
      {/* 头发 */}
      <ellipse cx="36" cy="28" rx="20" ry="10" fill={hair} />
      <rect x="16" y="28" width="5" height="18" rx="2" fill={hair} />
      <rect x="51" y="28" width="5" height="18" rx="2" fill={hair} />
      {/* 耳朵 */}
      <ellipse cx="16" cy="46" rx="4" ry="5" fill={skin} />
      <ellipse cx="56" cy="46" rx="4" ry="5" fill={skin} />
      {/* 眼睛 */}
      <ellipse cx="30" cy="43" rx="4" ry="4.5" fill="white" />
      <ellipse cx="42" cy="43" rx="4" ry="4.5" fill="white" />
      <ellipse cx="30" cy="43" rx="2.5" ry="3" fill="#2d1b00" />
      <ellipse cx="42" cy="43" rx="2.5" ry="3" fill="#2d1b00" />
      <circle cx="31" cy="42" r="0.8" fill="white" />
      <circle cx="43" cy="42" r="0.8" fill="white" />
      {/* 眉毛 */}
      <path d={eyeShape.replace(/36/g, '30')} stroke="#2d1b00" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <path d={eyeShape} stroke="#2d1b00" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      {/* 嘴巴 */}
      <path d={mouthShape} stroke="#c0665a" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      {/* 说话时嘴巴动效 */}
      {speaking && (
        <ellipse cx="36" cy="54" rx="4" ry={2 + Math.random() * 2} fill="#c0665a" opacity="0.8">
          <animate attributeName="ry" values="1;3;1" dur="0.3s" repeatCount="indefinite" />
        </ellipse>
      )}
      {/* 眼镜（学院风） */}
      {config.style === 'academic' && (
        <g opacity="0.8">
          <circle cx="30" cy="43" r="5.5" stroke="#444" strokeWidth="1" fill="none" />
          <circle cx="42" cy="43" r="5.5" stroke="#444" strokeWidth="1" fill="none" />
          <line x1="35.5" y1="43" x2="36.5" y2="43" stroke="#444" strokeWidth="1" />
          <line x1="16" y1="42" x2="24.5" y2="43" stroke="#444" strokeWidth="0.8" />
          <line x1="47.5" y1="43" x2="56" y2="42" stroke="#444" strokeWidth="0.8" />
        </g>
      )}
      {/* 科技感装饰 */}
      {config.style === 'tech' && (
        <g>
          <path d="M14,42 L20,42" stroke="#00d4ff" strokeWidth="1.5" strokeDasharray="2,1" opacity="0.8" />
          <circle cx="14" cy="42" r="1.5" fill="#00d4ff" opacity="0.8" />
        </g>
      )}
    </svg>
  );
}

// ─── 语音波形动画 ────────────────────────────────────────────────
function SpeechWave({ active }: { active: boolean }) {
  return (
    <div className="flex items-end gap-0.5 h-6">
      {[3, 5, 8, 6, 4, 7, 5, 3].map((h, i) => (
        <motion.div
          key={i}
          className="w-1 rounded-full bg-primary"
          animate={active ? { height: [h, h * 2.5, h], opacity: [0.6, 1, 0.6] } : { height: 2, opacity: 0.3 }}
          transition={{ duration: 0.4, repeat: Infinity, delay: i * 0.05, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}

// ─── 配置面板 ────────────────────────────────────────────────────
function ConfigPanel({ config, onChange, onClose }: {
  config: TeacherConfig;
  onChange: (c: TeacherConfig) => void;
  onClose: () => void;
}) {
  const hairOptions = ['#2d1b00', '#1a1a1a', '#8B4513', '#FFD700', '#4a3728', '#6B3FA0'];
  const outfitOptions = ['#1a3a6b', '#2d6a4f', '#7b2d8b', '#c0392b', '#e67e22', '#2c3e50'];

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="absolute right-0 top-0 w-64 bg-card border border-border rounded-xl shadow-xl z-20 p-4"
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">数字人配置</h3>
        <button type="button" onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
      </div>

      {/* 姓名 */}
      <div className="mb-3">
        <label className="text-xs text-muted-foreground mb-1 block flex items-center gap-1"><User className="w-3 h-3" />老师名称</label>
        <input
          type="text"
          value={config.name}
          onChange={e => onChange({ ...config, name: e.target.value })}
          className="w-full text-xs px-2 py-1.5 rounded-lg border border-border bg-muted focus:outline-none focus:ring-1 focus:ring-primary"
          maxLength={8}
        />
      </div>

      {/* 风格 */}
      <div className="mb-3">
        <label className="text-xs text-muted-foreground mb-1.5 block flex items-center gap-1"><Shirt className="w-3 h-3" />着装风格</label>
        <div className="grid grid-cols-2 gap-1">
          {(Object.keys(STYLE_LABELS) as TeacherConfig['style'][]).map(s => (
            <button key={s} type="button"
              onClick={() => onChange({ ...config, style: s })}
              className={`text-xs py-1 rounded-lg border transition-colors ${config.style === s ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted'}`}>
              {STYLE_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {/* 肤色 */}
      <div className="mb-3">
        <label className="text-xs text-muted-foreground mb-1.5 block">肤色</label>
        <div className="flex gap-2">
          {(['warm', 'cool', 'natural'] as TeacherConfig['skinTone'][]).map(t => {
            const c = { warm: '#f4c2a1', cool: '#dde8f0', natural: '#e8c49a' }[t];
            return (
              <button key={t} type="button"
                onClick={() => onChange({ ...config, skinTone: t })}
                className={`w-7 h-7 rounded-full border-2 transition-all ${config.skinTone === t ? 'border-primary scale-110' : 'border-border'}`}
                style={{ background: c }} title={t} />
            );
          })}
        </div>
      </div>

      {/* 发色 */}
      <div className="mb-3">
        <label className="text-xs text-muted-foreground mb-1.5 block flex items-center gap-1"><Palette className="w-3 h-3" />发色</label>
        <div className="flex flex-wrap gap-1.5">
          {hairOptions.map(c => (
            <button key={c} type="button"
              onClick={() => onChange({ ...config, hairColor: c })}
              className={`w-6 h-6 rounded-full border-2 transition-all ${config.hairColor === c ? 'border-primary scale-110' : 'border-border'}`}
              style={{ background: c }} />
          ))}
        </div>
      </div>

      {/* 服装颜色 */}
      <div className="mb-3">
        <label className="text-xs text-muted-foreground mb-1.5 block">服装颜色</label>
        <div className="flex flex-wrap gap-1.5">
          {outfitOptions.map(c => (
            <button key={c} type="button"
              onClick={() => onChange({ ...config, outfitColor: c })}
              className={`w-6 h-6 rounded-full border-2 transition-all ${config.outfitColor === c ? 'border-primary scale-110' : 'border-border'}`}
              style={{ background: c }} />
          ))}
        </div>
      </div>

      {/* 声音 */}
      <div className="mb-2">
        <label className="text-xs text-muted-foreground mb-1.5 block flex items-center gap-1"><Volume2 className="w-3 h-3" />声音类型</label>
        <div className="grid grid-cols-3 gap-1">
          {(Object.keys(VOICE_LABELS) as TeacherConfig['voice'][]).map(v => (
            <button key={v} type="button"
              onClick={() => onChange({ ...config, voice: v })}
              className={`text-xs py-1 rounded-lg border transition-colors ${config.voice === v ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted'}`}>
              {VOICE_LABELS[v]}
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ─── 主组件：数字人老师 ─────────────────────────────────────────
interface Props {
  /** 最新 AI 消息，用于触发说话动画和表情 */
  lastAIMessage?: string;
  /** 是否正在等待 AI 回复 */
  loading?: boolean;
  /** 折叠状态控制 */
  collapsed?: boolean;
  onToggle?: () => void;
}

export default function DigitalTeacher({ lastAIMessage, loading, collapsed, onToggle }: Props) {
  const [config, setConfig] = useState<TeacherConfig>(DEFAULT_CONFIG);
  const [showConfig, setShowConfig] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [muted, setMuted] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [emotion, setEmotion] = useState<TeacherConfig['emotion']>('neutral');
  const [bubble, setBubble] = useState('');
  const [showBgPicker, setShowBgPicker] = useState(false);
  const [activeBgId, setActiveBgId] = useState('classroom');  // 默认教室场景
  const [customBgUrl, setCustomBgUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const speakTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 根据 AI 消息触发说话 + 表情
  useEffect(() => {
    if (!lastAIMessage) return;
    setSpeaking(true);
    setBubble(lastAIMessage.slice(0, 40) + (lastAIMessage.length > 40 ? '...' : ''));
    // 根据内容判断表情
    if (/[！!棒优秀不错太]/.test(lastAIMessage)) setEmotion('encouraging');
    else if (/[？?思考理解明白]/.test(lastAIMessage)) setEmotion('thinking');
    else if (/[😊✨开心]|很好|做到/.test(lastAIMessage)) setEmotion('happy');
    else setEmotion('neutral');

    if (speakTimer.current) clearTimeout(speakTimer.current);
    speakTimer.current = setTimeout(() => { setSpeaking(false); setBubble(''); }, 4000);
    return () => { if (speakTimer.current) clearTimeout(speakTimer.current); };
  }, [lastAIMessage]);

  // 加载中时显示思考表情
  useEffect(() => {
    if (loading) { setEmotion('thinking'); setSpeaking(false); }
  }, [loading]);

  if (collapsed) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col items-center gap-1"
      >
        <button type="button" onClick={onToggle}
          className="w-12 h-12 rounded-full overflow-hidden border-2 border-primary/30 hover:border-primary transition-colors bg-card shadow-md">
          <AvatarSVG config={config} speaking={speaking} emotion={emotion} />
        </button>
        <span className="text-[10px] text-muted-foreground">{config.name}</span>
        <button type="button" onClick={onToggle} className="text-[10px] text-primary flex items-center gap-0.5">
          展开 <ChevronDown className="w-3 h-3" />
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative flex flex-col h-full"
    >
      {/* 配置面板 */}
      <AnimatePresence>
        {showConfig && (
          <ConfigPanel config={config} onChange={setConfig} onClose={() => setShowConfig(false)} />
        )}
      </AnimatePresence>

      {/* 头部工具栏 */}
      <div className="flex items-center justify-between mb-2 shrink-0">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: EMOTION_COLORS[emotion] }} />
          <span className="text-xs font-semibold">{config.name} 老师</span>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
            {EMOTION_LABELS[emotion]}
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setMicOn(v => !v)}
            className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${micOn ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
            {micOn ? <Mic className="w-3 h-3" /> : <MicOff className="w-3 h-3" />}
          </button>
          <button type="button" onClick={() => setMuted(v => !v)}
            className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${muted ? 'bg-destructive/20 text-destructive' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
            {muted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
          </button>
          <button type="button" onClick={() => setShowConfig(v => !v)}
            className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:bg-muted/80 transition-colors">
            <Settings2 className="w-3 h-3" />
          </button>
          <button type="button" onClick={() => setShowBgPicker(v => !v)}
            className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${showBgPicker ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
            title="切换背景">
            <ImagePlus className="w-3 h-3" />
          </button>
          {onToggle && (
            <button type="button" onClick={onToggle}
              className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:bg-muted/80 transition-colors">
              <ChevronUp className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* 背景选择器 */}
      <AnimatePresence>
        {showBgPicker && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="mb-2 p-2.5 rounded-xl bg-card border border-border shadow-lg shrink-0"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium">选择背景</span>
              <button type="button" onClick={() => setShowBgPicker(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-3 h-3" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-1.5 mb-2">
              {PRESET_BACKGROUNDS.map(bg => {
                const isActive = activeBgId === bg.id;
                return (
                  <button key={bg.id} type="button"
                    onClick={() => { setActiveBgId(bg.id); setCustomBgUrl(''); }}
                    className={`relative rounded-lg overflow-hidden aspect-[3/4] border-2 transition-all ${isActive ? 'border-primary shadow-md' : 'border-border hover:border-muted-foreground'}`}>
                    {bg.type === 'image' ? (
                      <img src={bg.url} alt={bg.label} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full" style={{ background: `radial-gradient(ellipse at 50% 60%, ${config.outfitColor}44 0%, #1e293b 100%)` }} />
                    )}
                    <div className="absolute inset-0 bg-black/20 flex items-end justify-center pb-1">
                      <span className="text-[9px] text-white font-medium">{bg.label}</span>
                    </div>
                    {isActive && (
                      <div className="absolute top-1 right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                        <Check className="w-2.5 h-2.5 text-primary-foreground" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
            {/* 自定义上传 */}
            <div className="border border-dashed border-border rounded-lg p-2 text-center">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 5 * 1024 * 1024) { alert('图片不超过5MB'); return; }
                  const reader = new FileReader();
                  reader.onload = ev => {
                    setCustomBgUrl(ev.target?.result as string);
                    setActiveBgId('custom');
                  };
                  reader.readAsDataURL(file);
                }}
              />
              {customBgUrl ? (
                <div className="flex items-center gap-2">
                  <img src={customBgUrl} alt="自定义背景" className="w-10 h-12 rounded object-cover shrink-0" />
                  <div className="flex-1 text-left">
                    <p className="text-xs font-medium">自定义背景</p>
                    <button type="button" onClick={() => fileInputRef.current?.click()}
                      className="text-[10px] text-primary hover:underline">重新上传</button>
                  </div>
                  {activeBgId === 'custom' && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                </div>
              ) : (
                <button type="button" onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center gap-1 w-full text-muted-foreground hover:text-foreground transition-colors">
                  <ImagePlus className="w-4 h-4" />
                  <span className="text-[10px]">上传自定义背景</span>
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 数字人主体 */}
      <div className="flex-1 flex flex-col items-center justify-center relative min-h-0">
        {/* 背景层 — 动态切换 */}
        <div className="absolute inset-0 rounded-xl overflow-hidden">
          {(() => {
            const bgUrl = activeBgId === 'custom' ? customBgUrl : PRESET_BACKGROUNDS.find(b => b.id === activeBgId)?.url || '';
            if (bgUrl) return (
              <motion.img
                key={activeBgId}
                src={bgUrl}
                alt="背景"
                initial={{ opacity: 0, scale: 1.04 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="w-full h-full object-cover"
              />
            );
            return (
              <>
                <div className="absolute inset-0 rounded-xl"
                  style={{ background: `radial-gradient(ellipse at 50% 60%, ${config.outfitColor}22 0%, transparent 70%)` }} />
                <div className="absolute bottom-0 left-0 right-0 h-24 rounded-b-xl"
                  style={{ background: `linear-gradient(to top, ${config.outfitColor}30, transparent)` }} />
                {[...Array(4)].map((_, i) => (
                  <motion.div key={i}
                    className="absolute w-1 h-1 rounded-full opacity-40"
                    style={{ background: config.outfitColor, left: `${20 + i * 20}%`, top: `${30 + (i % 2) * 20}%` }}
                    animate={{ y: [-4, 4, -4], opacity: [0.2, 0.6, 0.2] }}
                    transition={{ duration: 2 + i * 0.5, repeat: Infinity, delay: i * 0.3 }} />
                ))}
              </>
            );
          })()}
          {/* 图片背景时叠加底部渐变 */}
          {activeBgId !== 'default' && (
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/30" />
          )}
        </div>

        {/* 对话气泡 */}
        <AnimatePresence>
          {bubble && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="absolute top-0 left-0 right-0 z-10"
            >
              <div className="bg-card border border-border rounded-xl px-3 py-2 shadow-md text-xs text-foreground leading-relaxed">
                {bubble}
                <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-card border-b border-r border-border rotate-45" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* SVG 数字人 */}
        <motion.div
          className="relative z-10 w-28 h-44"
          animate={speaking ? { y: [0, -2, 0] } : { y: 0 }}
          transition={{ duration: 0.3, repeat: speaking ? Infinity : 0 }}
        >
          <AvatarSVG config={config} speaking={speaking} emotion={emotion} />
        </motion.div>

        {/* 说话波形 */}
        <div className="flex justify-center mt-1 relative z-10">
          <SpeechWave active={speaking || (loading ?? false)} />
        </div>
      </div>

      {/* 底部表情快捷栏 */}
      <div className="shrink-0 mt-2 flex items-center justify-center gap-2">
        {(['neutral', 'happy', 'thinking', 'encouraging'] as const).map(em => {
          const icons = { neutral: Meh, happy: Smile, thinking: Zap, encouraging: Smile };
          const Icon = icons[em];
          return (
            <button key={em} type="button"
              onClick={() => setEmotion(em)}
              className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${emotion === em ? 'scale-125' : 'opacity-50 hover:opacity-80'}`}
              style={{ color: EMOTION_COLORS[em] }}
              title={EMOTION_LABELS[em]}>
              <Icon className="w-3.5 h-3.5" />
            </button>
          );
        })}
        <span className="text-[10px] text-muted-foreground ml-1">情感</span>
      </div>

      {/* 麦克风提示 */}
      <AnimatePresence>
        {micOn && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute bottom-8 left-0 right-0 flex justify-center"
          >
            <div className="flex items-center gap-1.5 px-3 py-1 bg-primary/10 border border-primary/20 rounded-full text-xs text-primary">
              <Mic className="w-3 h-3 animate-pulse" />
              语音输入中...
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
