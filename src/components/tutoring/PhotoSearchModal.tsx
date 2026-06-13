import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  Camera, Upload, X, Loader2, BookOpen, ChevronRight,
  Star, RefreshCw, CheckCircle2, AlertCircle, Lightbulb,
  RotateCcw, ZoomIn,
} from 'lucide-react';

interface PhotoSearchModalProps {
  open: boolean;
  onClose: () => void;
}

interface AnalysisResult {
  question: string;
  subject: string;
  difficulty: '简单' | '中等' | '困难';
  answer: string;
  steps: { step: number; title: string; content: string }[];
  knowledge: string[];
  tips: string[];
  similar: { title: string; desc: string }[];
}

// 模拟AI解析题目
function mockAnalyze(imageUrl: string): Promise<AnalysisResult> {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve({
        question: '根据图片识别的题目内容',
        subject: '数学',
        difficulty: '中等',
        answer: '该题的最终答案为 **x = 2**',
        steps: [
          { step: 1, title: '审题', content: '仔细阅读题目，明确已知条件和求解目标。' },
          { step: 2, title: '建立方程', content: '根据题意列出相应的方程或不等式。' },
          { step: 3, title: '求解过程', content: '利用代入法/消元法求解，注意运算规范，避免低级错误。' },
          { step: 4, title: '验证结果', content: '将结果代回原式验证，确保答案满足所有约束条件。' },
          { step: 5, title: '总结规律', content: '归纳本题涉及的核心知识点，形成解题模板。' },
        ],
        knowledge: ['一元二次方程', '因式分解', '韦达定理', '判别式'],
        tips: [
          '注意审清题目中的隐含条件',
          '多项式因式分解要熟练掌握常见公式',
          '解题后务必代回验证，避免增根',
        ],
        similar: [
          { title: '同类题 · 一元二次方程', desc: '2x² + 5x - 3 = 0 的解' },
          { title: '同类题 · 二次函数', desc: '求抛物线与x轴的交点' },
        ],
      });
    }, 2200);
  });
}

export default function PhotoSearchModal({ open, onClose }: PhotoSearchModalProps) {
  const [phase, setPhase] = useState<'upload' | 'analyzing' | 'result'>('upload');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [activeTab, setActiveTab] = useState<'steps' | 'knowledge' | 'similar'>('steps');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('请上传图片文件');
      return;
    }
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    setPhase('analyzing');
    mockAnalyze(url).then(res => {
      setResult(res);
      setPhase('result');
    });
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const reset = () => {
    setPhase('upload');
    setImageUrl(null);
    setResult(null);
    setActiveTab('steps');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const difficultyColor = {
    简单: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    中等: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    困难: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-2xl max-h-[90dvh] overflow-y-auto p-0">
        <DialogHeader className="px-5 pt-5 pb-0">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-400 to-rose-500 flex items-center justify-center shadow-sm">
              <Camera className="w-4 h-4 text-white" />
            </div>
            拍照搜题
            <span className="text-xs font-normal text-muted-foreground ml-1">AI 智能解析</span>
          </DialogTitle>
        </DialogHeader>

        <div className="px-5 pb-5 pt-3">
          <AnimatePresence mode="wait">
            {/* ── 上传阶段 ── */}
            {phase === 'upload' && (
              <motion.div
                key="upload"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-4"
              >
                {/* 拖拽区域 */}
                <div
                  onDrop={handleDrop}
                  onDragOver={e => e.preventDefault()}
                  className="relative border-2 border-dashed border-border rounded-2xl p-8 text-center hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer group"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-100 to-rose-100 dark:from-orange-900/30 dark:to-rose-900/30 flex items-center justify-center group-hover:scale-105 transition-transform">
                      <Upload className="w-7 h-7 text-orange-500" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">点击上传或拖拽图片到此处</p>
                      <p className="text-xs text-muted-foreground mt-1">支持 JPG、PNG、WEBP，最大 10MB</p>
                    </div>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
                  />
                </div>

                {/* 拍照按钮 */}
                <Button
                  className="w-full h-11 gap-2 bg-gradient-to-r from-orange-400 to-rose-500 hover:from-orange-500 hover:to-rose-600 text-white border-0 shadow-md shadow-orange-300/30"
                  onClick={() => cameraInputRef.current?.click()}
                >
                  <Camera className="w-4 h-4" />
                  立即拍照搜题
                </Button>
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
                />

                {/* 使用提示 */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { icon: '📐', text: '数学公式' },
                    { icon: '🔬', text: '理化实验' },
                    { icon: '📝', text: '文字题目' },
                  ].map(item => (
                    <div key={item.text} className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-muted/50 text-center">
                      <span className="text-2xl">{item.icon}</span>
                      <p className="text-xs text-muted-foreground">{item.text}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* ── 解析中 ── */}
            {phase === 'analyzing' && (
              <motion.div
                key="analyzing"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                {/* 图片预览 */}
                {imageUrl && (
                  <div className="relative rounded-xl overflow-hidden aspect-video bg-muted">
                    <img src={imageUrl} alt="题目图片" className="w-full h-full object-contain" />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <div className="text-center text-white">
                        <Loader2 className="w-10 h-10 animate-spin mx-auto mb-3" />
                        <p className="font-semibold">AI 正在识别题目…</p>
                        <p className="text-sm text-white/70 mt-1">深度解析中，请稍候</p>
                      </div>
                    </div>
                    {/* 扫描动画线 */}
                    <motion.div
                      className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-orange-400 to-transparent"
                      animate={{ top: ['10%', '90%', '10%'] }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                    />
                  </div>
                )}
                <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                  <Lightbulb className="w-4 h-4 text-amber-500 shrink-0" />
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    AI 正在识别题型、分析解题思路，并生成详尽步骤解析…
                  </p>
                </div>
              </motion.div>
            )}

            {/* ── 解析结果 ── */}
            {phase === 'result' && result && (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                {/* 题目图片缩略图 + 基本信息 */}
                <div className="flex gap-3">
                  {imageUrl && (
                    <div className="w-24 h-24 rounded-xl overflow-hidden border border-border shrink-0 bg-muted">
                      <img src={imageUrl} alt="题目" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className="text-xs bg-primary/10 text-primary border-0">{result.subject}</Badge>
                      <Badge className={`text-xs border-0 ${difficultyColor[result.difficulty]}`}>{result.difficulty}</Badge>
                      <div className="flex items-center gap-0.5 ml-auto">
                        {[1,2,3,4,5].map(s => (
                          <Star key={s} className={`w-3 h-3 ${s <= 3 ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground'}`} />
                        ))}
                      </div>
                    </div>
                    <div className="flex items-start gap-1.5 p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 mb-0.5">参考答案</p>
                        <p className="text-xs text-emerald-600 dark:text-emerald-400">{result.answer}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Tab 切换 */}
                <div className="flex gap-1 p-1 bg-muted/60 rounded-xl">
                  {(['steps', 'knowledge', 'similar'] as const).map(tab => {
                    const labels = { steps: '解题步骤', knowledge: '知识点', similar: '同类题' };
                    return (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setActiveTab(tab)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          activeTab === tab
                            ? 'bg-background shadow-sm text-foreground'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {labels[tab]}
                      </button>
                    );
                  })}
                </div>

                {/* Tab 内容 */}
                <AnimatePresence mode="wait">
                  {activeTab === 'steps' && (
                    <motion.div key="steps" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                      {result.steps.map((s, i) => (
                        <div key={i} className="flex gap-3">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-400 to-rose-500 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                            {s.step}
                          </div>
                          <div className="flex-1 pb-3 border-b border-border last:border-0">
                            <p className="text-sm font-semibold mb-1">{s.title}</p>
                            <p className="text-xs text-muted-foreground leading-relaxed text-pretty">{s.content}</p>
                          </div>
                        </div>
                      ))}
                      {/* 解题技巧 */}
                      <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 space-y-1.5">
                        <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                          <Lightbulb className="w-3.5 h-3.5" />解题技巧
                        </p>
                        {result.tips.map((tip, i) => (
                          <p key={i} className="text-xs text-amber-600 dark:text-amber-400 flex items-start gap-1.5">
                            <span className="text-amber-400 shrink-0">•</span>{tip}
                          </p>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {activeTab === 'knowledge' && (
                    <motion.div key="knowledge" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">
                      <p className="text-xs text-muted-foreground mb-3">本题涉及以下核心知识点：</p>
                      {result.knowledge.map((k, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.07 }}
                          className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                        >
                          <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <BookOpen className="w-3.5 h-3.5 text-primary" />
                          </div>
                          <p className="text-sm font-medium flex-1">{k}</p>
                          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                        </motion.div>
                      ))}
                    </motion.div>
                  )}

                  {activeTab === 'similar' && (
                    <motion.div key="similar" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">
                      <p className="text-xs text-muted-foreground mb-3">为你推荐同类练习题：</p>
                      {result.similar.map((s, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.08 }}
                          className="p-3.5 rounded-xl border border-border hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer bg-card"
                        >
                          <p className="text-xs font-semibold text-primary mb-1">{s.title}</p>
                          <p className="text-sm text-muted-foreground">{s.desc}</p>
                        </motion.div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* 底部操作 */}
                <div className="flex gap-2 pt-1">
                  <Button variant="outline" size="sm" className="gap-1.5 flex-1" onClick={reset}>
                    <RefreshCw className="w-3.5 h-3.5" />再搜一题
                  </Button>
                  <Button size="sm" className="gap-1.5 flex-1 bg-gradient-to-r from-orange-400 to-rose-500 border-0 text-white" onClick={handleClose}>
                    <CheckCircle2 className="w-3.5 h-3.5" />完成
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}
