import { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';
import AppLayout from '@/components/layouts/AppLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import {
  Route, CheckCircle, Target, Sparkles, Plus, Loader2, Trophy,
  Wand2, RotateCcw, FileText, Brain, PenLine, BookOpen, Code2,
  Presentation, Video, Lock, ZoomIn, ZoomOut,
  Maximize2, Info, Trash2, X, MousePointer2, GitBranch,
  Type, Palette, Move, GripVertical,
} from 'lucide-react';
import type { LearningPath, PathStage } from '@/types/types';

// ─── 资源类型定义 ───────────────────────────────────────────────
const RESOURCE_TYPES = [
  { id: 'document',  label: '课程文档',   sub: '系统讲解知识点',   icon: FileText,     color: 'text-sky-600',     bg: 'bg-sky-50 dark:bg-sky-900/20',     border: 'border-sky-200 dark:border-sky-800',     active: 'bg-sky-500',     available: true  },
  { id: 'mindmap',   label: '思维导图',   sub: '可视化知识结构',   icon: Brain,        color: 'text-violet-600',  bg: 'bg-violet-50 dark:bg-violet-900/20', border: 'border-violet-200 dark:border-violet-800', active: 'bg-violet-500',  available: true  },
  { id: 'exercise',  label: '练习题',     sub: '配套巩固练习',     icon: PenLine,      color: 'text-amber-600',   bg: 'bg-amber-50 dark:bg-amber-900/20',   border: 'border-amber-200 dark:border-amber-800',   active: 'bg-amber-500',   available: true  },
  { id: 'reading',   label: '拓展阅读',   sub: '推荐相关材料',     icon: BookOpen,     color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20',border: 'border-emerald-200 dark:border-emerald-800',active: 'bg-emerald-500', available: true  },
  { id: 'code',      label: '代码示例',   sub: '可运行代码演示',   icon: Code2,        color: 'text-indigo-600',  bg: 'bg-indigo-50 dark:bg-indigo-900/20', border: 'border-indigo-200 dark:border-indigo-800', active: 'bg-indigo-500',  available: true  },
  { id: 'ppt',       label: 'AI课件PPT', sub: '自动生成演示文稿', icon: Presentation, color: 'text-rose-600',    bg: 'bg-rose-50 dark:bg-rose-900/20',     border: 'border-rose-200 dark:border-rose-800',     active: 'bg-rose-500',    available: false },
  { id: 'video',     label: '教学短视频', sub: '多模态动画讲解',   icon: Video,        color: 'text-orange-600',  bg: 'bg-orange-50 dark:bg-orange-900/20', border: 'border-orange-200 dark:border-orange-800', active: 'bg-orange-500',  available: false },
] as const;

type ResourceId = typeof RESOURCE_TYPES[number]['id'];

// ─── 阶段主题色 ─────────────────────────────────────────────────
const STAGE_THEMES = [
  { from: 'from-sky-400',     to: 'to-blue-500',    ring: 'ring-sky-400',     glow: 'shadow-sky-200 dark:shadow-sky-900/50'     },
  { from: 'from-violet-400',  to: 'to-purple-500',  ring: 'ring-violet-400',  glow: 'shadow-violet-200 dark:shadow-violet-900/50' },
  { from: 'from-amber-400',   to: 'to-orange-500',  ring: 'ring-amber-400',   glow: 'shadow-amber-200 dark:shadow-amber-900/50'   },
  { from: 'from-emerald-400', to: 'to-teal-500',    ring: 'ring-emerald-400', glow: 'shadow-emerald-200 dark:shadow-emerald-900/50'},
  { from: 'from-rose-400',    to: 'to-pink-500',    ring: 'ring-rose-400',    glow: 'shadow-rose-200 dark:shadow-rose-900/50'     },
];

// ─── 按资源类型生成路径模板 ──────────────────────────────────────
function buildStagesForResource(rid: ResourceId): PathStage[] {
  const base: Record<ResourceId, Array<{ title: string; description: string }>> = {
    document: [
      { title: '基础概念精读', description: '系统阅读课程文档，掌握核心概念与基本原理' },
      { title: '知识点梳理', description: '整理文档要点，建立结构化知识体系' },
      { title: '重难点攻克', description: '针对文档中的难点进行深入理解与记忆' },
      { title: '综合复习巩固', description: '回顾全部文档内容，完成知识闭环' },
    ],
    mindmap: [
      { title: '知识拆解绘图', description: '将核心知识点分解并绘制初始思维导图' },
      { title: '结构扩展完善', description: '补充二三级节点，丰富知识关联' },
      { title: '跨知识点连线', description: '识别并标注不同知识点之间的逻辑关系' },
      { title: '思维导图复盘', description: '利用完整导图进行系统化知识回顾' },
    ],
    exercise: [
      { title: '基础题目训练', description: '完成基础概念类练习，验证理解程度' },
      { title: '进阶题目挑战', description: '尝试综合应用类题目，提升解题能力' },
      { title: '错题归因分析', description: '整理错题，查找知识漏洞并针对补全' },
      { title: '模拟测试强化', description: '完成综合模拟题，达到全面掌握目标' },
    ],
    reading: [
      { title: '精选材料泛读', description: '快速阅读推荐材料，了解领域全貌' },
      { title: '重点段落精读', description: '对核心章节进行深入阅读与批注' },
      { title: '拓展资料对比', description: '对比不同来源材料，形成多角度认知' },
      { title: '阅读心得整理', description: '总结阅读收获，撰写学习笔记' },
    ],
    code: [
      { title: '示例代码阅读', description: '理解标准代码示例的逻辑与实现思路' },
      { title: '代码复现练习', description: '动手复现示例，加深编程理解' },
      { title: '变体修改实验', description: '在示例基础上修改参数与逻辑，验证理解' },
      { title: '独立项目实践', description: '综合所学编写完整功能模块' },
    ],
    ppt: [
      { title: '课件内容梳理', description: '逐页阅读AI生成课件，梳理讲解脉络' },
      { title: '重点幻灯精讲', description: '深入学习关键页面的核心知识' },
      { title: '知识点演练', description: '结合课件内容完成配套练习' },
      { title: '课件复习回放', description: '利用课件做整体知识复盘' },
    ],
    video: [
      { title: '视频初次观看', description: '完整观看教学短视频，建立整体印象' },
      { title: '重点片段精看', description: '对难点视频片段反复观看与分析' },
      { title: '动手跟练复现', description: '跟随视频演示进行同步操作练习' },
      { title: '综合回顾总结', description: '综合所有视频内容完成知识总结' },
    ],
  };
  return (base[rid] || base.document).map((s, i) => ({
    id: `${rid}-${i + 1}`,
    title: s.title,
    description: s.description,
    order: i + 1,
    resources: [rid],
    completed: false,
  }));
}

interface AIRecommendation { title: string; stages: PathStage[]; reasoning: string; }

// ─── 单节点卡片 ──────────────────────────────────────────────────
function StageNode({
  stage, index, isCurrent, isCompleted, isLocked,
  onComplete, completing, onDelete,
  onDragStart, onDragOver, onDrop,
  isDragging, activeTool,
}: {
  stage: PathStage; index: number; isCurrent: boolean; isCompleted: boolean; isLocked: boolean;
  onComplete: () => void; completing: boolean; onDelete: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  isDragging?: boolean;
  activeTool?: string;
}) {
  const theme = STAGE_THEMES[index % STAGE_THEMES.length];
  const [expanded, setExpanded] = useState(true);

  return (
    <div
      draggable={activeTool === 'select' || !activeTool}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className="shrink-0"
      style={{ width: 256 }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.06, type: 'spring', stiffness: 260, damping: 22 }}
        className={`relative bg-card rounded-2xl border-2 shadow-lg transition-all duration-200 select-none group
          ${isCompleted ? 'border-primary/30 opacity-80' : isCurrent ? `border-transparent ring-2 ${theme.ring} ${theme.glow} shadow-xl` : 'border-border opacity-70'}
          ${isLocked ? 'cursor-not-allowed' : activeTool === 'delete' ? 'cursor-pointer hover:border-destructive/60 hover:shadow-destructive/20' : 'cursor-grab active:cursor-grabbing hover:shadow-xl hover:-translate-y-0.5'}
          ${isDragging ? 'opacity-70 scale-105 z-50 shadow-2xl' : ''}
        `}
      >
        {/* 顶部色带 */}
        <div className={`h-1.5 rounded-t-2xl bg-gradient-to-r ${theme.from} ${theme.to}`} />

        <div className="p-4">
          {/* 头部 */}
          <div className="flex items-start gap-2 mb-3">
            <GripVertical className="w-3.5 h-3.5 mt-1 text-muted-foreground/30 shrink-0" />
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 bg-gradient-to-br ${theme.from} ${theme.to} shadow-sm`}>
              {isCompleted
                ? <CheckCircle className="w-4 h-4 text-white" />
                : <span className="text-white text-xs font-bold">{index + 1}</span>}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-balance leading-tight">{stage.title}</h3>
              <div className="flex flex-wrap gap-1 mt-1">
                {isCurrent   && <Badge className="bg-primary/10 text-primary border-0 text-[10px] h-4">当前阶段</Badge>}
                {isCompleted && <Badge variant="secondary" className="text-[10px] h-4">✓ 已完成</Badge>}
                {isLocked    && <Badge variant="outline" className="text-[10px] h-4 text-muted-foreground"><Lock className="w-2.5 h-2.5 mr-0.5" />待解锁</Badge>}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button type="button" onClick={() => setExpanded(v => !v)}
                className="text-muted-foreground/50 hover:text-muted-foreground transition-colors p-0.5">
                <Info className="w-3.5 h-3.5" />
              </button>
              <button type="button" onClick={onDelete}
                className="text-muted-foreground/30 hover:text-destructive transition-colors p-0.5 opacity-0 group-hover:opacity-100">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* 展开详情 */}
          <AnimatePresence initial={false}>
            {expanded && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <p className="text-xs text-muted-foreground text-pretty mb-3 leading-relaxed">{stage.description}</p>
                {stage.resources.length > 0 && (
                  <div className="space-y-1.5 mb-3">
                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">配套资源</p>
                    <div className="flex flex-wrap gap-1.5">
                      {stage.resources.map(rId => {
                        const r = RESOURCE_TYPES.find(rt => rt.id === rId);
                        if (!r) return null;
                        return (
                          <div key={rId} className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${r.bg} ${r.color} ${r.border}`}>
                            <r.icon className="w-2.5 h-2.5" />
                            {r.label}
                            {!r.available && <Lock className="w-2 h-2 ml-0.5 opacity-50" />}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* 操作按钮 */}
          {isCurrent && (
            <Button size="sm" disabled={completing} onClick={onComplete}
              className={`w-full h-8 text-xs gap-1.5 bg-gradient-to-r ${theme.from} ${theme.to} border-0 text-white hover:opacity-90`}>
              {completing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Target className="w-3 h-3" />}
              标记完成
            </Button>
          )}
          {isCompleted && (
            <div className="flex items-center gap-1.5 text-xs text-primary font-medium">
              <CheckCircle className="w-3.5 h-3.5" />阶段已完成
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ─── 工具类型 ─────────────────────────────────────────────────────
type CanvasTool = 'select' | 'add' | 'connect' | 'text' | 'color' | 'delete';

const CANVAS_TOOLS: { id: CanvasTool; icon: React.ElementType; label: string; color: string }[] = [
  { id: 'select',  icon: MousePointer2, label: '选择',   color: 'text-sky-500'     },
  { id: 'add',     icon: Plus,          label: '新增节点',color: 'text-primary'     },
  { id: 'connect', icon: GitBranch,     label: '连线',   color: 'text-violet-500'  },
  { id: 'text',    icon: Type,          label: '标注文字',color: 'text-amber-500'   },
  { id: 'color',   icon: Palette,       label: '颜色',   color: 'text-rose-500'    },
  { id: 'delete',  icon: Trash2,        label: '删除',   color: 'text-destructive' },
];

// ─── 主页面 ──────────────────────────────────────────────────────
export default function LearningPathPage() {
  const { user, profile } = useAuth();
  const [path, setPath] = useState<LearningPath | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [recommendation, setRecommendation] = useState<AIRecommendation | null>(null);
  const [zoom, setZoom] = useState(1);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [selectedResource, setSelectedResource] = useState<ResourceId>('document');
  const [generating, setGenerating] = useState(false);
  const [addingNode, setAddingNode] = useState(false);
  const [newNodeTitle, setNewNodeTitle] = useState('');
  const [newNodeDesc, setNewNodeDesc] = useState('');
  const addInputRef = useRef<HTMLInputElement>(null);

  // ── 画板工具 & 自由拖拽 ──
  const [activeTool, setActiveTool] = useState<CanvasTool>('select');
  const [nodePositions, setNodePositions] = useState<Record<string, { x: number; y: number }>>({});
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragStartRef = useRef<{ mx: number; my: number; ox: number; oy: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  // 初始化节点位置（横向排列）
  const initPositions = useCallback((stages: PathStage[]) => {
    setNodePositions(prev => {
      const next = { ...prev };
      stages.forEach((s, i) => {
        if (!next[s.id]) next[s.id] = { x: 48 + i * 290, y: 40 };
      });
      return next;
    });
  }, []);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    supabase.from('learning_paths').select('*').eq('user_id', user.id)
      .order('created_at', { ascending: false }).limit(1)
      .then(({ data }) => {
        if (Array.isArray(data) && data.length > 0) {
          setPath(data[0]);
          initPositions(data[0].stages);
        }
        setLoading(false);
      });
  }, [user, initPositions]);

  useEffect(() => {
    if (addingNode && addInputRef.current) addInputRef.current.focus();
  }, [addingNode]);

  // ── 按资源类型生成路径 ──
  const generateByResource = async (rid: ResourceId) => {
    if (!user) return;
    setGenerating(true);
    const rt = RESOURCE_TYPES.find(r => r.id === rid)!;
    const stages = buildStagesForResource(rid);
    if (path) await supabase.from('learning_paths').delete().eq('id', path.id);
    const { data } = await supabase.from('learning_paths').insert({
      user_id: user.id,
      title: `${rt.label}学习路径`,
      stages, current_stage: 0, progress_percent: 0,
    }).select().maybeSingle();
    if (data) {
      setPath(data);
      setNodePositions({});
      initPositions(stages);
      toast.success(`已生成「${rt.label}」个性化学习路径！`);
    }
    setGenerating(false);
  };

  // ── AI 推荐 ──
  const fetchAIRecommendation = async () => {
    if (!profile) { toast.error('请先完善个人信息'); return; }
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-recommend', { method: 'POST', body: { user_id: profile.id } });
      if (error) throw new Error(await error?.context?.text() || error.message);
      setRecommendation(data as AIRecommendation);
      toast.success('AI 推荐路径已生成！');
    } catch (err) { toast.error(`推荐失败：${(err as Error).message}`); }
    finally { setAiLoading(false); }
  };

  const applyRecommendation = async () => {
    if (!user || !recommendation) return;
    const { data } = await supabase.from('learning_paths').insert({
      user_id: user.id, title: recommendation.title,
      stages: recommendation.stages, current_stage: 0, progress_percent: 0,
    }).select().maybeSingle();
    if (data) {
      setPath(data);
      setNodePositions({});
      initPositions(recommendation.stages);
      setRecommendation(null);
      toast.success('AI 推荐路径已应用！');
    }
  };

  // ── 完成阶段 ──
  const completeStage = async (stageId: string) => {
    if (!path) return;
    setCompletingId(stageId);
    const updatedStages = path.stages.map(s => s.id === stageId ? { ...s, completed: true } : s);
    const completedCount = updatedStages.filter(s => s.completed).length;
    const progressPercent = Math.round((completedCount / updatedStages.length) * 100);
    const currentStage = updatedStages.findIndex(s => !s.completed);
    const { data } = await supabase.from('learning_paths').update({
      stages: updatedStages, progress_percent: progressPercent,
      current_stage: currentStage >= 0 ? currentStage : updatedStages.length - 1,
    }).eq('id', path.id).select().maybeSingle();
    if (data) {
      setPath(data);
      if (progressPercent === 100) { setShowCelebration(true); setTimeout(() => setShowCelebration(false), 3500); }
      toast.success('🎉 阶段完成！继续加油！');
    }
    setCompletingId(null);
  };

  // ── 删除节点 ──
  const deleteStage = async (stageId: string) => {
    if (!path) return;
    const updatedStages = path.stages.filter(s => s.id !== stageId).map((s, i) => ({ ...s, order: i + 1 }));
    const completedCount = updatedStages.filter(s => s.completed).length;
    const progressPercent = updatedStages.length ? Math.round((completedCount / updatedStages.length) * 100) : 0;
    const currentStage = updatedStages.findIndex(s => !s.completed);
    const { data } = await supabase.from('learning_paths').update({
      stages: updatedStages, progress_percent: progressPercent,
      current_stage: currentStage >= 0 ? currentStage : Math.max(0, updatedStages.length - 1),
    }).eq('id', path.id).select().maybeSingle();
    if (data) {
      setPath(data);
      // 清除已删除节点位置
      setNodePositions(prev => { const next = { ...prev }; delete next[stageId]; return next; });
      toast.success('节点已删除');
    }
  };

  // ── 新增节点 ──
  const addStage = async () => {
    if (!path || !newNodeTitle.trim()) return;
    const newStage: PathStage = {
      id: `custom-${Date.now()}`,
      title: newNodeTitle.trim(),
      description: newNodeDesc.trim() || '自定义学习阶段',
      order: path.stages.length + 1,
      resources: [selectedResource],
      completed: false,
    };
    const updatedStages = [...path.stages, newStage];
    const { data } = await supabase.from('learning_paths').update({ stages: updatedStages })
      .eq('id', path.id).select().maybeSingle();
    if (data) {
      setPath(data);
      const existing = Object.values(nodePositions);
      const maxX = existing.length ? Math.max(...existing.map(p => p.x)) : 0;
      setNodePositions(prev => ({ ...prev, [newStage.id]: { x: maxX + 290, y: 40 } }));
      setNewNodeTitle(''); setNewNodeDesc(''); setAddingNode(false);
      toast.success('节点已添加');
    }
  };

  // ── 拖拽重排（兼容旧列表模式，画板模式用鼠标拖拽）──
  const handleDrop = async (dropIndex: number) => {
    if (dragIndex === null || dragIndex === dropIndex || !path) return;
    const stages = [...path.stages];
    const [moved] = stages.splice(dragIndex, 1);
    stages.splice(dropIndex, 0, moved);
    const reordered = stages.map((s, i) => ({ ...s, order: i + 1 }));
    const currentStage = reordered.findIndex(s => !s.completed);
    const { data } = await supabase.from('learning_paths').update({
      stages: reordered,
      current_stage: currentStage >= 0 ? currentStage : reordered.length - 1,
    }).eq('id', path.id).select().maybeSingle();
    if (data) { setPath(data); toast.success('顺序已更新'); }
    setDragIndex(null);
  };

  // ── 画板鼠标拖拽（仅 select 工具时生效）──
  const handleNodeMouseDown = useCallback((e: React.MouseEvent, stageId: string) => {
    if (activeTool === 'delete') { deleteStage(stageId); return; }
    if (activeTool !== 'select') return;
    e.preventDefault();
    const pos = nodePositions[stageId] ?? { x: 0, y: 0 };
    dragStartRef.current = { mx: e.clientX, my: e.clientY, ox: pos.x, oy: pos.y };
    setDraggingId(stageId);
  }, [activeTool, nodePositions]);

  useEffect(() => {
    if (!draggingId) return;
    const onMove = (e: MouseEvent) => {
      if (!dragStartRef.current) return;
      const dx = e.clientX - dragStartRef.current.mx;
      const dy = e.clientY - dragStartRef.current.my;
      setNodePositions(prev => ({
        ...prev,
        [draggingId]: { x: Math.max(0, dragStartRef.current!.ox + dx), y: Math.max(0, dragStartRef.current!.oy + dy) },
      }));
    };
    const onUp = () => { setDraggingId(null); dragStartRef.current = null; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [draggingId]);

  const completedCount = path?.stages.filter(s => s.completed).length ?? 0;

  if (loading) return (
    <AppLayout>
      <div className="space-y-4">
        <Skeleton className="h-24 bg-muted rounded-2xl" />
        <Skeleton className="h-80 bg-muted rounded-2xl" />
      </div>
    </AppLayout>
  );

  return (
    <AppLayout>
      <div className="flex flex-col gap-5 h-full">

        {/* ══ 资源类型选择器 ══ */}
        <div className="shrink-0">
          <div className="flex items-center justify-between mb-3 gap-2">
            <div className="flex items-center gap-2">
              <Route className="w-5 h-5 text-primary shrink-0" />
              <h1 className="text-xl font-bold">学习路径</h1>
              {path && (
                <div className="hidden md:flex items-center gap-2">
                  <Badge variant="secondary" className="gap-1">{completedCount}/{path.stages.length} 阶段</Badge>
                  <Badge className="bg-primary/10 text-primary border-0">{path.progress_percent}% 完成</Badge>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {/* 缩放 */}
              {path && (
                <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                  <button type="button" onClick={() => setZoom(z => Math.max(0.6, +(z - 0.1).toFixed(1)))}
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-background transition-colors text-muted-foreground hover:text-foreground">
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-xs text-muted-foreground w-10 text-center">{Math.round(zoom * 100)}%</span>
                  <button type="button" onClick={() => setZoom(z => Math.min(1.4, +(z + 0.1).toFixed(1)))}
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-background transition-colors text-muted-foreground hover:text-foreground">
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" onClick={() => setZoom(1)} title="重置"
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-background transition-colors text-muted-foreground hover:text-foreground">
                    <Maximize2 className="w-3 h-3" />
                  </button>
                </div>
              )}
              {path && (
                <button type="button" title="重置路径"
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-border hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                  onClick={async () => {
                    await supabase.from('learning_paths').delete().eq('id', path.id);
                    setPath(null);
                  }}>
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
              <Button size="sm" variant="outline" onClick={fetchAIRecommendation} disabled={aiLoading} className="gap-1.5">
                {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                AI 推荐
              </Button>
            </div>
          </div>

          {/* 资源类型按钮组 */}
          <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              选择资源类型，生成对应个性化学习路径
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
              {RESOURCE_TYPES.map(rt => {
                const isSelected = selectedResource === rt.id;
                return (
                  <button
                    key={rt.id}
                    type="button"
                    disabled={generating}
                    onClick={() => {
                      setSelectedResource(rt.id as ResourceId);
                      generateByResource(rt.id as ResourceId);
                    }}
                    className={`relative group flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all duration-200
                      ${isSelected
                        ? `${rt.border} ${rt.bg} scale-[1.03] shadow-sm`
                        : 'border-border hover:border-border/80 hover:bg-muted/50'}
                      ${generating ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:scale-[1.02]'}
                    `}
                  >
                    {/* 即将上线标签 */}
                    {!rt.available && (
                      <span className="absolute -top-1.5 -right-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground border border-border whitespace-nowrap">
                        即将上线
                      </span>
                    )}
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors
                      ${isSelected ? `${rt.bg}` : 'bg-muted group-hover:bg-muted/80'}`}>
                      <rt.icon className={`w-4 h-4 ${isSelected ? rt.color : 'text-muted-foreground'}`} />
                    </div>
                    <span className={`text-[11px] font-medium text-center leading-tight ${isSelected ? rt.color : 'text-muted-foreground'}`}>
                      {rt.label}
                    </span>
                    <span className="text-[10px] text-muted-foreground/70 text-center leading-tight hidden lg:block">
                      {rt.sub}
                    </span>
                    {generating && isSelected && (
                      <Loader2 className="w-3 h-3 animate-spin text-primary absolute top-1 left-1" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ══ AI 推荐预览 ══ */}
        <AnimatePresence>
          {recommendation && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="shrink-0">
              <div className="border border-primary/30 bg-primary/5 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <span className="text-sm font-semibold text-primary">AI 推荐：{recommendation.title}</span>
                  </div>
                  <button type="button" onClick={() => setRecommendation(null)} className="text-muted-foreground hover:text-foreground">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-muted-foreground text-pretty">{recommendation.reasoning}</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {recommendation.stages.map((s, i) => (
                    <div key={s.id} className="flex items-center gap-2 p-2 rounded-xl bg-background border border-border">
                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-bold shrink-0">{i + 1}</span>
                      <p className="text-xs font-medium truncate">{s.title}</p>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={applyRecommendation} className="flex-1 gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5" />应用此路径
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setRecommendation(null)}>取消</Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ══ 进度条 ══ */}
        {path && (
          <div className="shrink-0 bg-card border border-border rounded-2xl px-5 py-3.5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold truncate mr-2">{path.title}</span>
              <span className="text-xs text-muted-foreground shrink-0">{completedCount}/{path.stages.length} 阶段完成</span>
            </div>
            <Progress value={path.progress_percent} className="h-2" />
            <p className="text-[11px] text-muted-foreground mt-1.5 flex items-center gap-1.5">
              <GripVertical className="w-3 h-3" />可拖拽节点调整顺序 · 悬停节点查看删除 · 底部可新增节点
            </p>
          </div>
        )}

        {/* ══ 主画板 ══ */}
        {!path ? (
          <div className="flex-1 flex items-center justify-center rounded-2xl border border-dashed border-border">
            <div className="text-center p-10">
              <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-5">
                <Route className="w-10 h-10 text-muted-foreground/30" />
              </div>
              <h3 className="text-lg font-semibold mb-2">选择上方资源类型，一键生成学习路径</h3>
              <p className="text-sm text-muted-foreground max-w-sm text-pretty">
                系统将结合你的学习画像与所选资源类型，为你规划科学的个性化学习步骤
              </p>
            </div>
          </div>
        ) : (
          /* 画板区域：左工具栏 + 主画布 */
          <div className="flex gap-0 rounded-2xl border border-border overflow-hidden" style={{ minHeight: 420 }}>

            {/* ── 左侧工具面板 ── */}
            <div className="w-14 shrink-0 flex flex-col items-center gap-1 py-3 px-1 bg-card border-r border-border">
              {CANVAS_TOOLS.map((tool, idx) => (
                <div key={tool.id} className="w-full flex flex-col items-center">
                  <button
                    type="button"
                    onClick={() => {
                      if (tool.id === 'add') { setActiveTool('select'); setAddingNode(true); }
                      else setActiveTool(tool.id);
                    }}
                    title={tool.label}
                    className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all ${
                      activeTool === tool.id
                        ? 'bg-primary/10 ring-1 ring-primary/40'
                        : 'hover:bg-muted'
                    }`}
                  >
                    <tool.icon className={`w-4 h-4 ${activeTool === tool.id ? tool.color : 'text-muted-foreground'}`} />
                    <span className={`text-[9px] leading-none font-medium ${activeTool === tool.id ? tool.color : 'text-muted-foreground/70'}`}>
                      {tool.label.slice(0, 2)}
                    </span>
                  </button>
                  {/* 分隔线：select 工具后放一条分隔线 */}
                  {idx === 0 && <div className="w-8 h-px bg-border my-1" />}
                </div>
              ))}

              {/* 分隔 */}
              <div className="flex-1" />

              {/* 缩放控制放在左侧底部 */}
              <div className="flex flex-col items-center gap-1 mb-1">
                <button type="button" onClick={() => setZoom(z => Math.min(1.5, +(z + 0.1).toFixed(1)))}
                  title="放大" className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors">
                  <ZoomIn className="w-4 h-4 text-muted-foreground" />
                </button>
                <span className="text-[10px] text-muted-foreground font-mono">{Math.round(zoom * 100)}%</span>
                <button type="button" onClick={() => setZoom(z => Math.max(0.5, +(z - 0.1).toFixed(1)))}
                  title="缩小" className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors">
                  <ZoomOut className="w-4 h-4 text-muted-foreground" />
                </button>
                <button type="button" onClick={() => setZoom(1)}
                  title="重置缩放" className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors">
                  <Maximize2 className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              </div>
            </div>

            {/* ── 主画布（自由拖拽，绝对定位节点）── */}
            <div
              ref={canvasRef}
              className="flex-1 min-w-0 relative overflow-auto"
              style={{
                background: 'radial-gradient(hsl(var(--border) / 0.5) 1px, transparent 1px)',
                backgroundSize: '24px 24px',
                cursor: activeTool === 'delete' ? 'crosshair' : activeTool === 'connect' ? 'cell' : 'default',
              }}
            >
              {/* 工具提示条 */}
              <div className="sticky top-0 left-0 z-20 flex items-center gap-2 px-3 py-1.5 bg-background/70 backdrop-blur-sm border-b border-border/50">
                <Move className="w-3 h-3 text-muted-foreground/60" />
                <span className="text-[11px] text-muted-foreground/70">
                  {activeTool === 'select'  && '选择工具：拖拽节点自由移动位置'}
                  {activeTool === 'add'     && '新增节点工具：点击左侧面板中「新增节点」已激活'}
                  {activeTool === 'connect' && '连线工具：从节点出发点击另一节点创建连接'}
                  {activeTool === 'text'    && '标注工具：点击画布空白处添加文字标注'}
                  {activeTool === 'color'   && '颜色工具：点击节点更改主题色'}
                  {activeTool === 'delete'  && '删除工具：点击节点将其删除'}
                </span>
                <div className="ml-auto flex items-center gap-2 text-[10px] text-muted-foreground/60">
                  <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-primary rounded-full inline-block" />已完成</span>
                  <span className="flex items-center gap-1"><span className="inline-block w-3 border-t-2 border-dashed border-muted-foreground/40" />待完成</span>
                </div>
              </div>

              {/* 缩放容器 */}
              <div
                style={{
                  transform: `scale(${zoom})`,
                  transformOrigin: 'top left',
                  width: `${Math.max(path.stages.length * 300 + 200, 1000)}px`,
                  minHeight: '380px',
                  position: 'relative',
                }}
              >
                {/* SVG 连线层（跟随节点位置） */}
                <svg className="absolute inset-0 pointer-events-none"
                  style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                  <defs>
                    <marker id="arrowDone" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
                      <path d="M0,0 L0,6 L8,3 z" fill="hsl(var(--primary))" />
                    </marker>
                    <marker id="arrowTodo" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
                      <path d="M0,0 L0,6 L8,3 z" fill="hsl(var(--border))" />
                    </marker>
                  </defs>
                  {path.stages.map((stage, i) => {
                    if (i >= path.stages.length - 1) return null;
                    const p1 = nodePositions[stage.id] ?? { x: 48 + i * 290, y: 40 };
                    const p2 = nodePositions[path.stages[i + 1].id] ?? { x: 48 + (i + 1) * 290, y: 40 };
                    const x1 = p1.x + 256;
                    const x2 = p2.x;
                    const y1 = p1.y + 68;
                    const y2 = p2.y + 68;
                    return (
                      <g key={`edge-${stage.id}`}>
                        <line x1={x1} y1={y1} x2={x2} y2={y2}
                          stroke={stage.completed ? 'hsl(var(--primary))' : 'hsl(var(--border))'}
                          strokeWidth="2.5" strokeDasharray={stage.completed ? '0' : '7 5'}
                          strokeLinecap="round"
                          markerEnd={stage.completed ? 'url(#arrowDone)' : 'url(#arrowTodo)'} />
                        {stage.completed && (
                          <circle r="4" fill="hsl(var(--primary))" opacity="0.9">
                            <animateMotion dur="1.6s" repeatCount="indefinite"
                              path={`M${x1},${y1} L${x2},${y2}`} />
                          </circle>
                        )}
                      </g>
                    );
                  })}
                </svg>

                {/* 绝对定位节点 */}
                {path.stages.map((stage, index) => {
                  const isCurrent = index === path.current_stage && !stage.completed;
                  const pos = nodePositions[stage.id] ?? { x: 48 + index * 290, y: 40 };
                  return (
                    <div
                      key={stage.id}
                      style={{ position: 'absolute', left: pos.x, top: pos.y, width: 260 }}
                      onMouseDown={e => handleNodeMouseDown(e, stage.id)}
                    >
                      <StageNode
                        stage={stage}
                        index={index}
                        isCurrent={isCurrent}
                        isCompleted={stage.completed}
                        isLocked={!stage.completed && !isCurrent}
                        onComplete={() => completeStage(stage.id)}
                        completing={completingId === stage.id}
                        onDelete={() => deleteStage(stage.id)}
                        onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; setDragIndex(index); }}
                        onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                        onDrop={e => { e.preventDefault(); handleDrop(index); }}
                        isDragging={draggingId === stage.id}
                        activeTool={activeTool}
                      />
                    </div>
                  );
                })}

                {/* 新增节点表单（浮动在画布左上空白处） */}
                <AnimatePresence>
                  {addingNode && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.92 }}
                      className="absolute z-30 bg-card rounded-2xl border-2 border-dashed border-primary/50 p-4 space-y-3 shadow-xl"
                      style={{ left: 48, top: 320, width: 260 }}
                    >
                      <p className="text-xs font-semibold text-primary flex items-center gap-1.5">
                        <Plus className="w-3.5 h-3.5" />新增学习节点
                      </p>
                      <input
                        ref={addInputRef}
                        value={newNodeTitle}
                        onChange={e => setNewNodeTitle(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') addStage(); if (e.key === 'Escape') { setAddingNode(false); setNewNodeTitle(''); setNewNodeDesc(''); } }}
                        placeholder="节点名称（必填）"
                        className="w-full text-xs rounded-lg border border-border bg-background px-3 py-2 outline-none focus:border-primary placeholder:text-muted-foreground/50"
                      />
                      <textarea
                        value={newNodeDesc}
                        onChange={e => setNewNodeDesc(e.target.value)}
                        placeholder="描述（可选）"
                        rows={2}
                        className="w-full text-xs rounded-lg border border-border bg-background px-3 py-2 outline-none focus:border-primary resize-none placeholder:text-muted-foreground/50"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" className="flex-1 h-7 text-xs" onClick={addStage} disabled={!newNodeTitle.trim()}>确认</Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => { setAddingNode(false); setNewNodeTitle(''); setNewNodeDesc(''); }}>
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        )}

        {/* ══ 庆祝弹窗 ══ */}
        <AnimatePresence>
          {showCelebration && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 flex items-center justify-center z-50 bg-black/30 backdrop-blur-sm">
              <motion.div initial={{ scale: 0.7, y: 30 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.7, opacity: 0 }}
                className="bg-background rounded-3xl p-10 shadow-2xl text-center max-w-sm mx-4">
                <motion.div animate={{ rotate: [0, 10, -10, 10, 0] }} transition={{ repeat: 2, duration: 0.4 }}>
                  <Trophy className="w-16 h-16 text-amber-500 mx-auto mb-4" />
                </motion.div>
                <h2 className="text-2xl font-bold text-balance mb-2">🎉 全部完成！</h2>
                <p className="text-muted-foreground text-pretty">你已成功完成所有学习阶段，太棒了！</p>
                <Button className="mt-6 w-full" onClick={() => setShowCelebration(false)}>继续探索</Button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </AppLayout>
  );
}
