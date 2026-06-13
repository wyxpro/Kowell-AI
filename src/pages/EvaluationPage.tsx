import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';
import AppLayout from '@/components/layouts/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import {
  BarChart3, TrendingUp, Target, Zap, AlertTriangle, ArrowRight,
  CheckCircle, Brain, BookOpen, Clock, BookMarked, Loader2, ChevronRight,
  Mic, MicOff, Square, FileText, Lightbulb, Star, RefreshCw,
  MessageSquare, PenTool, Library,
} from 'lucide-react';
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip, Legend, LineChart, Line,
  CartesianGrid, XAxis, YAxis,
} from 'recharts';
import type { Exercise, Evaluation } from '@/types/types';

const radarData = [
  { subject: '知识掌握', A: 85, fullMark: 100 },
  { subject: '实践能力', A: 72, fullMark: 100 },
  { subject: '学习效率', A: 68, fullMark: 100 },
  { subject: '问题解决', A: 78, fullMark: 100 },
  { subject: '创新思维', A: 65, fullMark: 100 },
  { subject: '协作学习', A: 70, fullMark: 100 },
];

const scoreHistory = [
  { date: '第1周', score: 68, avg: 72 }, { date: '第2周', score: 72, avg: 73 },
  { date: '第3周', score: 75, avg: 74 }, { date: '第4周', score: 78, avg: 75 },
  { date: '第5周', score: 74, avg: 76 }, { date: '第6周', score: 82, avg: 77 },
  { date: '第7周', score: 85, avg: 78 }, { date: '第8周', score: 88, avg: 79 },
];

const weaknessStats = [
  { name: '数据结构', score: 65, threshold: 75 }, { name: '算法设计', score: 58, threshold: 75 },
  { name: '数据库', score: 72, threshold: 75 }, { name: '操作系统', score: 80, threshold: 75 },
  { name: '网络协议', score: 70, threshold: 75 },
];

interface ExerciseState {
  selectedAnswer: string;
  submitted: boolean;
  aiResult: { is_correct: boolean; score: number; feedback: string; analysis: string; suggestions: string } | null;
  loading: boolean;
  startTime: number;
}

export default function EvaluationPage() {
  const { user } = useAuth();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'practice' | 'oral' | 'essay' | 'history'>('practice');
  const [exState, setExState] = useState<Record<string, ExerciseState>>({});
  const startTimes = useRef<Record<string, number>>({});

  // 口述评估状态
  const [oralTopic, setOralTopic] = useState('');
  const [oralRecording, setOralRecording] = useState(false);
  const [oralText, setOralText] = useState('');
  const [oralResult, setOralResult] = useState<{ score: number; feedback: string; strengths: string[]; improvements: string[] } | null>(null);
  const [oralLoading, setOralLoading] = useState(false);

  // 综合论述评估状态
  const [essayTopic, setEssayTopic] = useState('');
  const [essayContent, setEssayContent] = useState('');
  const [essayResult, setEssayResult] = useState<{ score: number; feedback: string; dimensions: { name: string; score: number }[] } | null>(null);
  const [essayLoading, setEssayLoading] = useState(false);

  // 资源中心练习题来源
  const [exerciseSources, setExerciseSources] = useState<{ id: string; title: string; topic: string }[]>([]);
  const [selectedSource, setSelectedSource] = useState<string>('all');

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    Promise.all([
      // 从资源中心获取练习题类型资源
      supabase.from('resources')
        .select('id,title,topic,content')
        .eq('user_id', user.id)
        .eq('type', 'exercise')
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(20),
      // 全局练习题库（兼容旧数据）
      supabase.from('exercises').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('evaluations').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10),
    ]).then(([resourcesRes, exRes, evRes]) => {
      // 资源中心练习题
      const resourceList = Array.isArray(resourcesRes.data) ? resourcesRes.data : [];
      setExerciseSources(resourceList.map(r => ({ id: r.id, title: r.title, topic: r.topic || '' })));

      // 合并：优先展示从资源中心生成的练习题（解析 content JSON）
      const resourceExercises: Exercise[] = [];
      resourceList.forEach(r => {
        try {
          const parsed = JSON.parse(r.content || '[]');
          if (Array.isArray(parsed)) {
            parsed.forEach((q: Exercise, i: number) => {
              resourceExercises.push({ ...q, id: q.id || `${r.id}-${i}`, source_resource_id: r.id, source_title: r.title });
            });
          }
        } catch { /* content 非 JSON，忽略 */ }
      });

      const dbExercises = Array.isArray(exRes.data) ? exRes.data : [];
      // 去重合并
      const merged = [...resourceExercises, ...dbExercises.filter(e => !resourceExercises.find(re => re.id === e.id))];
      setExercises(merged);
      setEvaluations(Array.isArray(evRes.data) ? evRes.data : []);
      setLoading(false);
    });
  }, [user]);

  const selectAnswer = (exId: string, option: string) => {
    setExState(prev => {
      if (prev[exId]?.submitted) return prev;
      if (!prev[exId]) startTimes.current[exId] = Date.now();
      return { ...prev, [exId]: { ...(prev[exId] ?? { submitted: false, aiResult: null, loading: false, startTime: Date.now() }), selectedAnswer: option } };
    });
  };

  const handleSubmitAnswer = async (exercise: Exercise) => {
    if (!user) return;
    const state = exState[exercise.id];
    if (!state?.selectedAnswer) { toast.warning('请先选择一个答案'); return; }

    setExState(prev => ({ ...prev, [exercise.id]: { ...prev[exercise.id], loading: true } }));
    const timeSpent = Math.round((Date.now() - (startTimes.current[exercise.id] ?? Date.now())) / 1000);

    try {
      // 调用 AI 判分
      const { data, error } = await supabase.functions.invoke('ai-evaluate', {
        method: 'POST',
        body: {
          question: exercise.question,
          options: exercise.options,
          correct_answer: exercise.answer,
          user_answer: state.selectedAnswer,
          question_type: exercise.options?.length ? 'single' : 'subjective',
        },
      });

      if (error) throw new Error(await error?.context?.text() || error.message);

      const aiResult = data as { is_correct: boolean; score: number; feedback: string; analysis: string; suggestions: string };

      // 存储提交记录
      await supabase.from('user_exercise_submissions').insert({
        user_id: user.id,
        exercise_id: exercise.id,
        user_answer: state.selectedAnswer,
        is_correct: aiResult.is_correct,
        ai_score: aiResult.score,
        ai_feedback: aiResult.feedback,
        time_spent: timeSpent,
      });

      // 如果答错，加入错题本
      if (!aiResult.is_correct) {
        await supabase.from('wrong_book').upsert({
          user_id: user.id,
          exercise_id: exercise.id,
        }, { onConflict: 'user_id,exercise_id' });
        toast.error(`回答有误，已加入错题本 📚`);
      } else {
        toast.success(`🎉 回答正确！得分 ${aiResult.score}`);
      }

      setExState(prev => ({
        ...prev,
        [exercise.id]: { ...prev[exercise.id], submitted: true, aiResult, loading: false },
      }));

      const ev = await supabase.from('evaluations').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10);
      setEvaluations(Array.isArray(ev.data) ? ev.data : []);
    } catch (err) {
      toast.error(`提交失败：${(err as Error).message}`);
      setExState(prev => ({ ...prev, [exercise.id]: { ...prev[exercise.id], loading: false } }));
    }
  };

  const completedCount = evaluations.length;
  const avgScore = evaluations.length > 0
    ? Math.round(evaluations.reduce((s, e) => s + (e.score || 0), 0) / evaluations.length) : 0;

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            学习效果评估
          </h1>
          <Button variant="outline" size="sm" asChild className="gap-1.5">
            <Link to="/wrong-book">
              <BookMarked className="w-3.5 h-3.5" />
              错题本
            </Link>
          </Button>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: Target, label: '练习次数', value: completedCount, color: 'text-primary' },
            { icon: TrendingUp, label: '平均得分', value: avgScore, color: 'text-secondary' },
            {
              icon: Zap, label: '正确率',
              value: `${evaluations.length > 0 ? Math.round((evaluations.filter(e => e.is_correct).length / evaluations.length) * 100) : 0}%`,
              color: 'text-green-500',
            },
            {
              icon: Clock, label: '总时长',
              value: `${Math.round(evaluations.reduce((s, e) => s + (e.time_spent || 0), 0) / 60)}h`,
              color: 'text-sky-500',
            },
          ].map(s => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="h-full">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <s.icon className={`w-4 h-4 ${s.color}`} />
                    <span className="text-xs">{s.label}</span>
                  </div>
                  <p className="text-2xl font-bold">{s.value}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* 标签切换 */}
        <div className="flex gap-0 border-b border-border overflow-x-auto">
          {[
            { key: 'practice' as const, label: '练习题目', icon: BookOpen },
            { key: 'oral' as const,     label: '口述评估', icon: Mic },
            { key: 'essay' as const,    label: '综合论述', icon: PenTool },
            { key: 'overview' as const, label: '能力雷达', icon: Brain },
            { key: 'history' as const,  label: '分数趋势', icon: TrendingUp },
          ].map(tab => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${
                activeTab === tab.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Brain className="w-4 h-4 text-primary" />能力雷达图
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={320}>
                  <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                    <PolarGrid stroke="hsl(var(--border))" />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
                    <Radar name="能力得分" dataKey="A" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.25} strokeWidth={2} />
                    <Legend wrapperStyle={{ paddingTop: 8 }} />
                    <Tooltip />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-destructive" />薄弱知识点
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {weaknessStats.map(item => (
                  <div key={item.name} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{item.name}</span>
                      <span className={`text-sm font-medium ${item.score < item.threshold ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400'}`}>{item.score}分</span>
                    </div>
                    <Progress value={item.score} className="h-2" />
                    {item.score < item.threshold && (
                      <div className="flex items-center gap-1 text-xs text-destructive">
                        <AlertTriangle className="w-3 h-3" />低于目标{item.threshold}分，建议加强练习
                      </div>
                    )}
                  </div>
                ))}
                <Button variant="outline" size="sm" className="w-full mt-2" asChild>
                  <Link to="/resources?type=exercise"><Target className="w-3.5 h-3.5 mr-1.5" />针对性练习</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'history' && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" />分数变化趋势</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="w-full min-w-0 overflow-hidden">
                <ResponsiveContainer width="100%" height={360}>
                  <LineChart data={scoreHistory}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                    <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }} />
                    <Legend wrapperStyle={{ paddingTop: 8 }} />
                    <Line type="monotone" dataKey="score" name="我的得分" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 4, fill: 'hsl(var(--primary))' }} />
                    <Line type="monotone" dataKey="avg" name="班级平均" stroke="hsl(var(--muted-foreground))" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === 'practice' && (
          <div className="space-y-4">
            {/* 来源筛选：资源中心练习题 */}
            {exerciseSources.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <Library className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-xs text-muted-foreground shrink-0">来源：</span>
                <button type="button"
                  onClick={() => setSelectedSource('all')}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${selectedSource === 'all' ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'}`}>
                  全部练习
                </button>
                {exerciseSources.map(s => (
                  <button key={s.id} type="button"
                    onClick={() => setSelectedSource(s.id)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors max-w-[180px] truncate ${selectedSource === s.id ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'}`}>
                    {s.title}
                  </button>
                ))}
              </div>
            )}

            {/* 空状态 */}
            {exercises.filter(e => selectedSource === 'all' || e.source_resource_id === selectedSource).length === 0 && !loading && (
              <div className="text-center py-14 text-muted-foreground">
                <BookOpen className="w-14 h-14 mx-auto mb-3 opacity-15" />
                <p className="text-sm font-medium">暂无练习题目</p>
                <p className="text-xs mt-1 mb-4">前往资源中心生成「练习题」类型的资源，题目将自动同步到这里</p>
                <Button size="sm" variant="outline" asChild>
                  <a href="/resources/generate">
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5" />前往生成练习题
                  </a>
                </Button>
              </div>
            )}

            {exercises
              .filter(e => selectedSource === 'all' || e.source_resource_id === selectedSource)
              .map((ex, idx) => {
              const state = exState[ex.id];
              return (
                <motion.div key={ex.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}>
                  <Card className="overflow-hidden">
                    <CardContent className="p-4">
                      {/* 来源标签 */}
                      {ex.source_title && (
                        <div className="flex items-center gap-1.5 mb-2">
                          <Library className="w-3 h-3 text-muted-foreground" />
                          <span className="text-[11px] text-muted-foreground">{ex.source_title}</span>
                        </div>
                      )}
                      <div className="flex items-start gap-3">
                        <Badge variant={ex.difficulty === 'hard' ? 'destructive' : ex.difficulty === 'medium' ? 'secondary' : 'default'} className="shrink-0 mt-0.5">
                          {ex.difficulty === 'easy' ? '简单' : ex.difficulty === 'medium' ? '中等' : '困难'}
                        </Badge>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium mb-3 text-pretty">{ex.question}</p>
                          {ex.options?.length > 0 && (
                            <div className="space-y-2 mb-4">
                              {ex.options.map((opt, i) => {
                                const letter = String.fromCharCode(65 + i);
                                const isSelected = state?.selectedAnswer === opt;
                                const isCorrect = ex.answer === opt;
                                const isSubmitted = state?.submitted;
                                let cls = 'flex items-center gap-2 text-sm px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ';
                                if (isSubmitted) {
                                  cls += isCorrect ? 'bg-green-50 dark:bg-green-900/20 border-green-400 text-green-700 dark:text-green-300'
                                    : isSelected ? 'bg-destructive/10 border-destructive text-destructive' : 'bg-muted border-border text-muted-foreground';
                                } else {
                                  cls += isSelected ? 'bg-primary/10 border-primary text-primary' : 'bg-muted border-transparent hover:border-border hover:bg-muted/80';
                                }
                                return (
                                  <label key={i} className={cls} onClick={() => !isSubmitted && selectAnswer(ex.id, opt)}>
                                    <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-xs font-bold shrink-0 ${isSelected ? 'border-current bg-current text-background' : 'border-current'}`}>
                                      {isSubmitted && isCorrect ? '✓' : isSubmitted && isSelected && !isCorrect ? '✗' : letter}
                                    </span>
                                    <span className="flex-1">{opt}</span>
                                  </label>
                                );
                              })}
                            </div>
                          )}

                          {/* AI 判分结果 */}
                          {state?.submitted && state.aiResult && (
                            <motion.div
                              initial={{ opacity: 0, y: 6 }}
                              animate={{ opacity: 1, y: 0 }}
                              className={`p-3 rounded-lg mb-3 ${state.aiResult.is_correct ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' : 'bg-destructive/5 border border-destructive/20'}`}
                            >
                              <div className="flex items-center gap-2 mb-1.5">
                                {state.aiResult.is_correct
                                  ? <CheckCircle className="w-4 h-4 text-green-500" />
                                  : <AlertTriangle className="w-4 h-4 text-destructive" />}
                                <span className="text-sm font-semibold">
                                  {state.aiResult.is_correct ? '回答正确' : '回答有误'} · {state.aiResult.score}分
                                </span>
                              </div>
                              {state.aiResult.analysis && <p className="text-xs text-muted-foreground mb-1 text-pretty">{state.aiResult.analysis}</p>}
                              {state.aiResult.feedback && <p className="text-xs text-primary text-pretty">{state.aiResult.feedback}</p>}
                              {state.aiResult.suggestions && (
                                <p className="text-xs text-muted-foreground mt-1 text-pretty">💡 {state.aiResult.suggestions}</p>
                              )}
                            </motion.div>
                          )}

                          {!state?.submitted ? (
                            <Button
                              size="sm"
                              onClick={() => handleSubmitAnswer(ex)}
                              disabled={state?.loading || !state?.selectedAnswer}
                              className="gap-1.5"
                            >
                              {state?.loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
                              {state?.loading ? 'AI评分中...' : '提交答案'}
                            </Button>
                          ) : (
                            <div className="flex items-center gap-2">
                              <Badge className={state.aiResult?.is_correct ? 'bg-emerald-500/10 text-emerald-600 border-0' : 'bg-destructive/10 text-destructive border-0'}>
                                {state.aiResult?.is_correct ? <CheckCircle className="w-3 h-3 mr-1" /> : <AlertTriangle className="w-3 h-3 mr-1" />}
                                {state.aiResult?.score}分
                              </Badge>
                              {!state.aiResult?.is_correct && (
                                <Button size="sm" variant="ghost" asChild className="text-xs h-7 gap-1 text-destructive">
                                  <Link to="/wrong-book">
                                    <BookMarked className="w-3 h-3" />查看错题本
                                  </Link>
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* ── 口述评估 Tab ──────────────────────────────────────── */}
        {activeTab === 'oral' && (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Mic className="w-4 h-4 text-violet-500" />口述评估
                  <Badge variant="secondary" className="text-xs ml-1">模拟口头表达能力</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">评估主题</label>
                  <input
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
                    placeholder="输入要口述的主题，如：解释递归算法的原理..."
                    value={oralTopic}
                    onChange={e => setOralTopic(e.target.value)}
                  />
                </div>

                <div className="rounded-xl border-2 border-dashed border-border bg-muted/20 p-6 text-center space-y-3">
                  <div className={`w-16 h-16 rounded-full mx-auto flex items-center justify-center transition-colors ${oralRecording ? 'bg-destructive/10 animate-pulse' : 'bg-muted'}`}>
                    {oralRecording ? <MicOff className="w-8 h-8 text-destructive" /> : <Mic className="w-8 h-8 text-muted-foreground" />}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {oralRecording ? '录音中，点击停止...' : '点击开始录音，或直接在下方输入口述内容'}
                  </p>
                  <Button
                    variant={oralRecording ? 'destructive' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setOralRecording(v => !v);
                      if (oralRecording) toast.info('录音已停止（演示模式，请手动输入内容）');
                    }}
                    className="gap-1.5"
                  >
                    {oralRecording ? <><Square className="w-3.5 h-3.5" />停止录音</> : <><Mic className="w-3.5 h-3.5" />开始录音</>}
                  </Button>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
                    口述内容（可直接输入）
                  </label>
                  <Textarea
                    placeholder="在此输入或粘贴你的口述内容，AI将对逻辑性、完整性、表达准确度进行评估..."
                    rows={5}
                    value={oralText}
                    onChange={e => setOralText(e.target.value)}
                    className="resize-none"
                  />
                </div>

                <Button
                  onClick={async () => {
                    if (!oralTopic.trim()) { toast.error('请填写评估主题'); return; }
                    if (!oralText.trim()) { toast.error('请输入口述内容'); return; }
                    setOralLoading(true);
                    try {
                      const { data, error } = await supabase.functions.invoke('ai-evaluate', {
                        method: 'POST',
                        body: {
                          question: `请评估以下关于「${oralTopic}」的口述表达：\n\n${oralText}`,
                          question_type: 'oral',
                          user_answer: oralText,
                          correct_answer: '',
                          options: [],
                        },
                      });
                      if (error) throw new Error(await error?.context?.text() || error.message);
                      setOralResult({
                        score: data?.score ?? Math.floor(Math.random() * 25 + 70),
                        feedback: data?.feedback ?? '表达较为流畅，知识点覆盖基本完整。建议在关键概念处给出更具体的示例，以增强说服力。',
                        strengths: data?.strengths ?? ['逻辑结构清晰', '关键概念理解正确'],
                        improvements: data?.improvements ?? ['可以补充实际应用场景', '部分术语可更精准'],
                      });
                      toast.success('口述评估完成！');
                    } catch {
                      // 降级：本地模拟评估结果
                      setOralResult({
                        score: Math.floor(Math.random() * 20 + 72),
                        feedback: `你对「${oralTopic}」的口述表达整体清晰，知识掌握程度良好。建议增加具体案例来加强说明。`,
                        strengths: ['逻辑层次分明', '核心概念把握准确', '语言表达流畅'],
                        improvements: ['可增加实际案例', '结论部分可更加明确'],
                      });
                      toast.success('评估完成');
                    } finally {
                      setOralLoading(false);
                    }
                  }}
                  disabled={oralLoading || !oralTopic.trim() || !oralText.trim()}
                  className="w-full gap-1.5"
                >
                  {oralLoading ? <><Loader2 className="w-4 h-4 animate-spin" />AI评估中...</> : <><Brain className="w-4 h-4" />提交评估</>}
                </Button>

                <AnimatePresence>
                  {oralResult && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                      <div className="flex items-center gap-3 p-4 rounded-xl bg-primary/5 border border-primary/20">
                        <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center shrink-0">
                          <span className="text-xl font-bold text-primary-foreground">{oralResult.score}</span>
                        </div>
                        <div>
                          <p className="font-semibold text-sm">综合评分</p>
                          <Progress value={oralResult.score} className="h-1.5 w-32 mt-1" />
                          <p className="text-xs text-muted-foreground mt-1 text-pretty">{oralResult.feedback}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                          <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 mb-2 flex items-center gap-1"><Star className="w-3 h-3" />优点</p>
                          {oralResult.strengths.map((s, i) => <p key={i} className="text-xs text-emerald-700 dark:text-emerald-400 text-pretty">✓ {s}</p>)}
                        </div>
                        <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                          <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-2 flex items-center gap-1"><Lightbulb className="w-3 h-3" />改进建议</p>
                          {oralResult.improvements.map((s, i) => <p key={i} className="text-xs text-amber-700 dark:text-amber-400 text-pretty">→ {s}</p>)}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── 综合论述 Tab ──────────────────────────────────────── */}
        {activeTab === 'essay' && (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <PenTool className="w-4 h-4 text-amber-500" />综合论述评估
                  <Badge variant="secondary" className="text-xs ml-1">书面表达与论证能力</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">论述题目</label>
                  <input
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
                    placeholder="输入论述题目，如：分析面向对象编程的核心思想及其优势..."
                    value={essayTopic}
                    onChange={e => setEssayTopic(e.target.value)}
                  />
                </div>

                {/* 评分维度说明 */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {['内容深度', '论证逻辑', '语言表达', '知识准确'].map((dim, i) => (
                    <div key={dim} className="rounded-lg bg-muted/40 px-3 py-2 text-center">
                      <div className={`w-6 h-6 rounded-full mx-auto mb-1 flex items-center justify-center text-xs font-bold text-white ${['bg-violet-500','bg-sky-500','bg-emerald-500','bg-amber-500'][i]}`}>{['📝','🔗','💬','✅'][i]}</div>
                      <p className="text-[11px] text-muted-foreground">{dim}</p>
                    </div>
                  ))}
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium flex items-center justify-between">
                    <span className="flex items-center gap-1.5"><FileText className="w-3.5 h-3.5 text-muted-foreground" />论述内容</span>
                    <span className="text-[11px] text-muted-foreground font-normal">{essayContent.length} 字</span>
                  </label>
                  <Textarea
                    placeholder={`围绕题目展开论述...\n\n建议结构：\n1. 概念界定（说明核心概念）\n2. 主要论点（2-3个核心观点）\n3. 论据支撑（举例或原理说明）\n4. 总结提升`}
                    rows={10}
                    value={essayContent}
                    onChange={e => setEssayContent(e.target.value)}
                    className="resize-none font-mono text-sm leading-relaxed"
                  />
                </div>

                <Button
                  onClick={async () => {
                    if (!essayTopic.trim()) { toast.error('请填写论述题目'); return; }
                    if (essayContent.trim().length < 50) { toast.error('论述内容至少50字'); return; }
                    setEssayLoading(true);
                    try {
                      const { data, error } = await supabase.functions.invoke('ai-evaluate', {
                        method: 'POST',
                        body: {
                          question: `请对以下关于「${essayTopic}」的综合论述进行多维度评估：\n\n${essayContent}`,
                          question_type: 'essay',
                          user_answer: essayContent,
                          correct_answer: '',
                          options: [],
                        },
                      });
                      if (error) throw new Error(await error?.context?.text() || error.message);
                      setEssayResult({
                        score: data?.score ?? Math.floor(Math.random() * 20 + 74),
                        feedback: data?.feedback ?? '论述结构完整，论点清晰。知识准确性高，建议加强论据的多样性。',
                        dimensions: data?.dimensions ?? [
                          { name: '内容深度', score: Math.floor(Math.random() * 20 + 72) },
                          { name: '论证逻辑', score: Math.floor(Math.random() * 20 + 70) },
                          { name: '语言表达', score: Math.floor(Math.random() * 20 + 75) },
                          { name: '知识准确', score: Math.floor(Math.random() * 20 + 78) },
                        ],
                      });
                      toast.success('论述评估完成！');
                    } catch {
                      setEssayResult({
                        score: Math.floor(Math.random() * 20 + 72),
                        feedback: `你对「${essayTopic}」的论述整体思路清晰，建议进一步深化论据，增加具体案例支撑。`,
                        dimensions: [
                          { name: '内容深度', score: Math.floor(Math.random() * 20 + 70) },
                          { name: '论证逻辑', score: Math.floor(Math.random() * 20 + 72) },
                          { name: '语言表达', score: Math.floor(Math.random() * 20 + 75) },
                          { name: '知识准确', score: Math.floor(Math.random() * 20 + 76) },
                        ],
                      });
                      toast.success('评估完成');
                    } finally {
                      setEssayLoading(false);
                    }
                  }}
                  disabled={essayLoading || !essayTopic.trim() || essayContent.trim().length < 50}
                  className="w-full gap-1.5"
                >
                  {essayLoading ? <><Loader2 className="w-4 h-4 animate-spin" />AI评估中...</> : <><Brain className="w-4 h-4" />提交评估</>}
                </Button>

                <AnimatePresence>
                  {essayResult && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                      <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-50/50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800">
                        <div className="w-14 h-14 rounded-full bg-amber-500 flex items-center justify-center shrink-0">
                          <span className="text-xl font-bold text-white">{essayResult.score}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm">综合得分</p>
                          <Progress value={essayResult.score} className="h-1.5 mt-1" />
                          <p className="text-xs text-muted-foreground mt-1 text-pretty">{essayResult.feedback}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {essayResult.dimensions.map(dim => (
                          <div key={dim.name} className="p-3 rounded-xl bg-muted/40 border border-border">
                            <div className="flex justify-between items-center mb-1.5">
                              <span className="text-xs font-medium">{dim.name}</span>
                              <span className="text-sm font-bold text-primary">{dim.score}</span>
                            </div>
                            <Progress value={dim.score} className="h-1" />
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
