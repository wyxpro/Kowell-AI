import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';
import { recordWeaknessTrainingCompleted, triggerLearningAdapt } from '@/services/learning/service';
import AppLayout from '@/components/layouts/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { Target, Brain, AlertTriangle, CheckCircle2, XCircle, RotateCcw, ChevronRight, Trophy, Loader2, TrendingUp, Flame } from 'lucide-react';

type QuestionType = 'choice' | 'fill' | 'think';
interface AIQuestion { question: string; options?: string[]; answer: string; explanation: string; type: QuestionType; knowledgePoint: string; }
interface PersistedQuestion extends AIQuestion { exerciseId: string; knowledgePointId: string | null; }
interface Session {
  weakPoint: string; courseId: string; trainingResourceId: string; questions: PersistedQuestion[];
  currentIndex: number; answers: (string | null)[]; submitted: boolean[]; correct: (boolean | null)[];
  score: number; done: boolean; completing: boolean;
}
interface WrongEntry { id: string; mastered: boolean; exercises?: { id: string; question?: string; title?: string }; }
interface CourseRow { id: string; name: string; code: string | null; }
interface PointRow { id: string; code: string; title: string; }

const WEAK_TOPICS = [
  { label: '数据结构', points: ['数组/链表', '栈与队列', '树与图', '哈希表'] },
  { label: '算法设计', points: ['动态规划', '贪心算法', '回溯算法', '分治策略'] },
  { label: '操作系统', points: ['进程调度', '内存管理', '文件系统', '死锁处理'] },
  { label: '计算机网络', points: ['TCP/IP', 'HTTP/HTTPS', 'DNS原理', '网络安全'] },
  { label: '数据库', points: ['SQL优化', '事务ACID', '索引设计', '范式理论'] },
];

const normalize = (value: string) => value.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
const choiceKey = (value: string) => value.trim().replace(/[.、。\s]/g, '').charAt(0).toUpperCase();

function validQuestion(value: unknown): value is AIQuestion {
  if (!value || typeof value !== 'object') return false;
  const q = value as Record<string, unknown>;
  return typeof q.question === 'string' && Boolean(q.question.trim())
    && typeof q.answer === 'string' && Boolean(q.answer.trim())
    && typeof q.explanation === 'string' && typeof q.knowledgePoint === 'string' && Boolean(q.knowledgePoint.trim())
    && (q.type === 'choice' || q.type === 'fill' || q.type === 'think')
    && (q.options === undefined || (Array.isArray(q.options) && q.options.every(option => typeof option === 'string')))
    && (q.type !== 'choice' || (Array.isArray(q.options) && q.options.length >= 2));
}

export default function WeaknessTrainingPage() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<WrongEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [userInput, setUserInput] = useState('');
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [selectedPoint, setSelectedPoint] = useState('');

  const stats = { totalWrong: entries.length, mastered: entries.filter(entry => entry.mastered).length, unmastered: entries.filter(entry => !entry.mastered).length };

  useEffect(() => {
    if (!user) return;
    void (async () => {
      setLoading(true);
      const { data, error } = await supabase.from('wrong_book').select('id, mastered, exercises!wrong_book_exercise_id_fkey(id, question)').eq('user_id', user.id).order('created_at', { ascending: false }).limit(30);
      if (error) toast.error(`加载错题数据失败：${error.message}`);
      else setEntries((data ?? []) as unknown as WrongEntry[]);
      setLoading(false);
    })();
  }, [user]);

  const resolveCourse = async (): Promise<CourseRow> => {
    if (!user) throw new Error('请先登录');
    const { data: recent, error: recentError } = await supabase.from('resources').select('course_id').eq('user_id', user.id).not('course_id', 'is', null).order('updated_at', { ascending: false }).limit(1).maybeSingle();
    if (recentError) throw recentError;
    if (recent?.course_id) {
      const { data, error } = await supabase.from('courses').select('id, name, code').eq('id', recent.course_id).maybeSingle();
      if (error) throw error;
      if (data) return data as CourseRow;
    }
    const { data, error } = await supabase.from('courses').select('id, name, code').or('name.ilike.%人工智能基础%,code.ilike.%AI%').limit(20);
    if (error) throw error;
    const course = (data as CourseRow[] | null)?.find(item => item.name.includes('人工智能基础')) ?? data?.[0];
    if (!course) throw new Error('没有可用的最近课程，也未找到《人工智能基础》课程');
    return course as CourseRow;
  };

  const matchPoint = (points: PointRow[], value: string) => {
    const query = normalize(value);
    return points.find(point => normalize(point.code) === query || normalize(point.title) === query)
      ?? points.find(point => normalize(point.code).includes(query) || normalize(point.title).includes(query))
      ?? null;
  };

  const generateTraining = async (weakPoint: string) => {
    if (!user) { toast.error('请先登录'); return; }
    setGenerating(true);
    try {
      const context = entries.slice(0, 5).map(entry => entry.exercises?.question ?? '').filter(Boolean).join('、');
      const { data, error } = await supabase.functions.invoke('ai-chat', { body: { portrait: null, messages: [{ role: 'user', content: `请为“${weakPoint}”生成恰好3道不重复训练题${context ? `，参考错题：${context}` : ''}。只输出 JSON：{"questions":[{"question":"题干","options":["A. 选项","B. 选项"],"answer":"B","explanation":"解析","type":"choice","knowledgePoint":"${weakPoint}"}]}。第1题 choice，第2题 fill（无 options），第3题 think（无 options）。` }] } });
      if (error) throw error;
      const text = (data?.content || data?.message || '') as string;
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('AI 未返回 JSON');
      const parsed = JSON.parse(match[0]) as { questions?: unknown };
      if (!Array.isArray(parsed.questions) || parsed.questions.length !== 3 || !parsed.questions.every(validQuestion)) throw new Error('AI 题目结构无效');
      const questions = parsed.questions as AIQuestion[];
      if (new Set(questions.map(question => normalize(question.question))).size !== 3) throw new Error('AI 返回了重复题目');

      const course = await resolveCourse();
      const { data: pointData, error: pointError } = await supabase.from('knowledge_points').select('id, code, title').eq('course_id', course.id);
      if (pointError) throw pointError;
      const points = (pointData ?? []) as PointRow[];
      const payload = questions.map(question => ({ ...question, knowledgePointId: matchPoint(points, question.knowledgePoint)?.id ?? null }));
      const { data: resource, error: resourceError } = await supabase.from('resources').insert({ user_id: user.id, course_id: course.id, title: `${weakPoint} 弱项强化训练`, resource_type: 'exercise', content: payload, chapter: weakPoint, status: 'completed' }).select('id').single();
      if (resourceError || !resource) throw resourceError ?? new Error('训练资源未返回');
      const { data: savedExercises, error: exerciseError } = await supabase.from('exercises').insert(questions.map(question => ({ resource_id: resource.id, question: question.question, question_type: question.type === 'choice' ? 'single' : 'subjective', options: question.options ?? [], answer: question.answer, explanation: question.explanation, difficulty: question.type === 'choice' ? 'easy' : question.type === 'fill' ? 'medium' : 'hard' }))).select('id, question');
      if (exerciseError || !savedExercises || savedExercises.length !== questions.length) {
        void supabase.from('resources').delete().eq('id', resource.id).eq('user_id', user.id);
        throw exerciseError ?? new Error('题目未完整保存');
      }
      const exerciseIds = new Map(savedExercises.map(exercise => [normalize(exercise.question), exercise.id]));
      const persisted = questions.map(question => {
        const exerciseId = exerciseIds.get(normalize(question.question));
        if (!exerciseId) throw new Error('题目 ID 映射失败');
        return { ...question, exerciseId, knowledgePointId: matchPoint(points, question.knowledgePoint)?.id ?? null };
      });
      setSession({ weakPoint, courseId: course.id, trainingResourceId: resource.id, questions: persisted, currentIndex: 0, answers: [null, null, null], submitted: [false, false, false], correct: [null, null, null], score: 0, done: false, completing: false });
      setUserInput('');
      toast.success('训练资源和 3 道练习题已保存，可以开始训练');
    } catch (error) {
      toast.error(error instanceof Error ? `生成或保存训练失败：${error.message}` : '生成或保存训练失败');
    } finally { setGenerating(false); }
  };

  const submitAnswer = async () => {
    if (!session || !user || submitting) return;
    const index = session.currentIndex;
    const question = session.questions[index];
    const answer = userInput.trim();
    if (!answer) { toast.error('请输入或选择答案'); return; }
    const correct = question.type === 'think' ? null : question.type === 'fill' ? normalize(answer) === normalize(question.answer) : choiceKey(answer) === choiceKey(question.answer);
    setSubmitting(true);
    try {
      const { error } = await supabase.from('user_exercise_submissions').insert({ user_id: user.id, exercise_id: question.exerciseId, user_answer: answer, is_correct: correct, ai_score: null, ai_feedback: question.type === 'think' ? '思考题已保存，待 AI 评估。' : null, ai_status: question.type === 'think' ? 'pending' : 'skipped', time_spent: 0 });
      if (error) throw error;
      const answers = [...session.answers]; const submitted = [...session.submitted]; const results = [...session.correct];
      answers[index] = answer; submitted[index] = true; results[index] = correct;
      setSession({ ...session, answers, submitted, correct: results, score: results.filter(result => result === true).length });
    } catch (error) {
      toast.error(error instanceof Error ? `答案保存失败：${error.message}` : '答案保存失败，请重试');
    } finally { setSubmitting(false); }
  };

  const finishTraining = async (current: Session) => {
    setSession({ ...current, done: true, completing: true });
    const knowledgePointId = current.questions.find(question => question.knowledgePointId)?.knowledgePointId ?? null;
    try {
      const event = await recordWeaknessTrainingCompleted({ courseId: current.courseId, resourceId: current.trainingResourceId, knowledgePointId, idempotencyKey: `weakness-training:${current.trainingResourceId}`, payload: { trainingResourceId: current.trainingResourceId, questionCount: current.questions.length, correctCount: current.score, knowledgePointId } });
      void triggerLearningAdapt(event.id).catch(() => toast.warning('训练已记录，但学习适配暂未触发。'));
      setSession(previous => previous ? { ...previous, completing: false } : previous);
    } catch (error) {
      setSession(previous => previous ? { ...previous, completing: false } : previous);
      toast.error(error instanceof Error ? `训练完成事件保存失败：${error.message}` : '训练完成事件保存失败；未伪造同步成功');
    }
  };

  const next = () => {
    if (!session) return;
    setUserInput('');
    if (session.currentIndex < session.questions.length - 1) setSession({ ...session, currentIndex: session.currentIndex + 1 });
    else void finishTraining(session);
  };
  const reset = () => { setSession(null); setUserInput(''); setSelectedPoint(''); };
  const current = session?.questions[session.currentIndex] ?? null;
  const submitted = session?.submitted[session.currentIndex] ?? false;
  const correct = session?.correct[session.currentIndex] ?? null;

  return <AppLayout><div className="space-y-4">
    <div><h1 className="text-xl font-bold flex items-center gap-2"><Target className="w-5 h-5 text-primary" />弱项强化训练</h1><p className="text-sm text-muted-foreground mt-0.5">训练题先真实保存为课程练习资源；每次答题均单独记录。</p></div>
    <div className="grid grid-cols-3 gap-3">{[{ label: '错题总数', value: stats.totalWrong, icon: XCircle, color: 'text-red-500' }, { label: '已掌握', value: stats.mastered, icon: CheckCircle2, color: 'text-emerald-500' }, { label: '待攻克', value: stats.unmastered, icon: Flame, color: 'text-amber-500' }].map(item => <Card key={item.label}><CardContent className="p-4 flex gap-3 items-center"><item.icon className={`w-5 h-5 ${item.color}`} /><div><p className="text-xl font-bold">{loading ? '-' : item.value}</p><p className="text-xs text-muted-foreground">{item.label}</p></div></CardContent></Card>)}</div>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4"><div className="space-y-3">
      {!loading && entries.some(entry => !entry.mastered) && <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex gap-2"><AlertTriangle className="w-4 h-4 text-amber-500" />来自我的错题本</CardTitle></CardHeader><CardContent className="space-y-2">{entries.filter(entry => !entry.mastered).slice(0, 4).map(entry => <button key={entry.id} type="button" disabled={generating} onClick={() => void generateTraining(entry.exercises?.question || '综合练习')} className="w-full text-left p-2 rounded-lg border text-xs hover:bg-muted">{entry.exercises?.question || '未知题目'}</button>)}</CardContent></Card>}
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex gap-2"><Brain className="w-4 h-4 text-primary" />按知识点训练</CardTitle></CardHeader><CardContent>{WEAK_TOPICS.map(topic => <div key={topic.label}><button type="button" onClick={() => setSelectedTopic(selectedTopic === topic.label ? null : topic.label)} className="w-full p-2 flex justify-between text-sm">{topic.label}<ChevronRight className={`w-4 h-4 ${selectedTopic === topic.label ? 'rotate-90' : ''}`} /></button>{selectedTopic === topic.label && <div className="pl-3 space-y-1">{topic.points.map(point => <button key={point} type="button" disabled={generating} onClick={() => { setSelectedPoint(point); void generateTraining(point); }} className={`block w-full text-left text-xs p-2 rounded ${selectedPoint === point ? 'bg-primary/10 text-primary' : 'hover:bg-muted'}`}>{point}</button>)}</div>}</div>)}</CardContent></Card>
    </div><div className="lg:col-span-2"><AnimatePresence mode="wait">
      {!session && !generating && <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><Card><CardContent className="py-20 text-center space-y-3"><Target className="w-10 h-10 mx-auto text-primary" /><p className="font-medium">选择薄弱点开始训练</p><p className="text-sm text-muted-foreground">保存失败不会进入训练，避免显示伪造的持久化成功。</p></CardContent></Card></motion.div>}
      {generating && <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><Card><CardContent className="py-20 text-center"><Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-3" /><p>AI 正在生成并保存训练资源…</p></CardContent></Card></motion.div>}
      {session && !session.done && current && <motion.div key={`q-${session.currentIndex}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }}><Card><CardHeader><div className="flex justify-between"><div className="flex gap-2"><Badge>{session.weakPoint}</Badge><Badge variant="outline">{{ choice: '选择题', fill: '填空题', think: '思考题' }[current.type]}</Badge></div><span className="text-xs">{session.currentIndex + 1}/{session.questions.length}</span></div><Progress className="mt-2 h-1" value={(session.currentIndex / session.questions.length) * 100} /></CardHeader><CardContent className="space-y-4"><p className="text-sm font-medium">{current.question}</p>
        {current.type === 'choice' && <div className="space-y-2">{current.options?.map((option, index) => <button key={index} type="button" disabled={submitted} onClick={() => setUserInput(choiceKey(option))} className={`w-full border p-3 rounded-xl text-left text-sm ${choiceKey(userInput) === choiceKey(option) ? 'border-primary bg-primary/5' : 'border-border'}`}>{option}</button>)}</div>}
        {(current.type === 'fill' || current.type === 'think') && <Textarea disabled={submitted} value={userInput} onChange={event => setUserInput(event.target.value)} placeholder={current.type === 'think' ? '写出你的分析思路；将标记为待 AI 评估。' : '请输入答案…'} />}
        {submitted && <div className="border rounded-xl p-3 text-sm"><div className="flex gap-2 items-center">{correct === true ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-amber-600" />}<span>{correct === true ? '回答正确！' : current.type === 'think' ? '回答已保存，待 AI 评估' : `正确答案：${current.answer}`}</span></div><p className="text-xs text-muted-foreground mt-2">{current.explanation}</p></div>}
        <div className="flex gap-2">{!submitted ? <Button className="flex-1" disabled={!userInput.trim() || submitting} onClick={() => void submitAnswer()}>{submitting && <Loader2 className="w-4 h-4 animate-spin mr-1" />}{submitting ? '正在保存…' : '提交答案'}</Button> : <Button className="flex-1" onClick={next}>{session.currentIndex < 2 ? '下一题' : '完成训练'}<ChevronRight className="w-4 h-4 ml-1" /></Button>}<Button variant="ghost" size="icon" onClick={reset}><RotateCcw className="w-4 h-4" /></Button></div>
      </CardContent></Card></motion.div>}
      {session?.done && <motion.div key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><Card><CardContent className="py-16 text-center space-y-4"><Trophy className="w-12 h-12 mx-auto text-primary" /><h2 className="text-2xl font-bold">{session.score}/{session.questions.length}</h2><p className="text-muted-foreground">{session.weakPoint} 专项训练完成</p><p className="text-sm text-muted-foreground">思考题不按字数判对，已保存为待 AI 评估。</p>{session.completing && <p className="text-xs flex justify-center gap-1"><Loader2 className="w-3 h-3 animate-spin" />正在记录完成事件…</p>}<div className="flex justify-center gap-2"><Button onClick={() => void generateTraining(session.weakPoint)}><RotateCcw className="w-4 h-4 mr-1" />再练一次</Button><Button variant="outline" onClick={reset}><TrendingUp className="w-4 h-4 mr-1" />换个弱点</Button></div></CardContent></Card></motion.div>}
    </AnimatePresence></div></div>
  </div></AppLayout>;
}
