import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';
import AppLayout from '@/components/layouts/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import {
  Target, Sparkles, Brain, AlertTriangle, CheckCircle2, XCircle,
  RotateCcw, ChevronRight, Trophy, Loader2, TrendingUp, Flame,
} from 'lucide-react';

interface WrongEntry {
  id: string;
  exercise_id: string;
  note: string | null;
  mastered: boolean;
  exercises?: {
    id: string;
    title: string;
    content: Record<string, unknown>;
    subject: string;
    difficulty: number;
    knowledge_points: string[];
  };
}

interface AITrainQuestion {
  question: string;
  options?: string[];
  answer: string;
  explanation: string;
  type: 'choice' | 'fill' | 'think';
  knowledgePoint: string;
}

interface TrainingSession {
  weakPoint: string;
  questions: AITrainQuestion[];
  currentIndex: number;
  answers: (string | null)[];
  submitted: boolean[];
  correct: boolean[];
  score: number;
  done: boolean;
}

const WEAK_TOPICS = [
  { label: '数据结构', points: ['数组/链表', '栈与队列', '树与图', '哈希表'] },
  { label: '算法设计', points: ['动态规划', '贪心算法', '回溯算法', '分治策略'] },
  { label: '操作系统', points: ['进程调度', '内存管理', '文件系统', '死锁处理'] },
  { label: '计算机网络', points: ['TCP/IP', 'HTTP/HTTPS', 'DNS原理', '网络安全'] },
  { label: '数据库', points: ['SQL优化', '事务ACID', '索引设计', '范式理论'] },
];

export default function WeaknessTrainingPage() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<WrongEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [session, setSession] = useState<TrainingSession | null>(null);
  const [userInput, setUserInput] = useState('');
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<string>('');
  const [stats, setStats] = useState({ totalWrong: 0, mastered: 0, unmastered: 0 });

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('wrong_book')
        .select('*, exercises!wrong_book_exercise_id_fkey(id, title, content, subject, difficulty, knowledge_points)')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(30);
      const items = (data || []) as WrongEntry[];
      setEntries(items);
      setStats({
        totalWrong: items.length,
        mastered: items.filter(e => e.mastered).length,
        unmastered: items.filter(e => !e.mastered).length,
      });
    } catch {
      toast.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const generateTraining = async (weakPoint: string) => {
    setGenerating(true);
    try {
      const wrongContext = entries.slice(0, 5).map(e => e.exercises?.title || '').filter(Boolean).join('、');
      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: {
          messages: [{
            role: 'user',
            content: `请为"${weakPoint}"知识点生成3道练习题，帮助学生克服薄弱环节${wrongContext ? `（学生错过的题目包括：${wrongContext}）` : ''}。

输出JSON格式：
{"questions":[
  {
    "question": "题目内容",
    "options": ["A. 选项1","B. 选项2","C. 选项3","D. 选项4"],
    "answer": "B",
    "explanation": "详细解析，100字以内",
    "type": "choice",
    "knowledgePoint": "${weakPoint}"
  }
]}
要求：
1. 第1题为选择题(type=choice)，第2题为填空题(type=fill，无options，answer为填空答案)，第3题为思考题(type=think，无options，answer为参考答案)
2. 难度循序渐进，解析清晰
3. 只输出JSON`,
          }],
          portrait: null,
        }
      });
      if (error) throw error;
      const text: string = data?.content || data?.message || '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('解析失败');
      const parsed = JSON.parse(jsonMatch[0]);
      setSession({
        weakPoint,
        questions: parsed.questions || [],
        currentIndex: 0,
        answers: new Array(parsed.questions.length).fill(null),
        submitted: new Array(parsed.questions.length).fill(false),
        correct: new Array(parsed.questions.length).fill(false),
        score: 0,
        done: false,
      });
      toast.success(`已生成 ${weakPoint} 专项练习！`);
    } catch {
      toast.error('生成练习失败，请重试');
    } finally {
      setGenerating(false);
    }
  };

  const submitAnswer = () => {
    if (!session) return;
    const q = session.questions[session.currentIndex];
    const ans = userInput.trim();
    if (!ans) { toast.error('请输入或选择答案'); return; }

    const isCorrect = q.type === 'think'
      ? ans.length > 10 // 思考题字数够即可
      : q.type === 'fill'
        ? ans.toLowerCase().includes(q.answer.toLowerCase()) || q.answer.toLowerCase().includes(ans.toLowerCase())
        : ans.toUpperCase() === q.answer.toUpperCase() || ans === q.answer;

    const newAnswers = [...session.answers];
    const newSubmitted = [...session.submitted];
    const newCorrect = [...session.correct];
    newAnswers[session.currentIndex] = ans;
    newSubmitted[session.currentIndex] = true;
    newCorrect[session.currentIndex] = isCorrect;

    const newScore = newCorrect.filter(Boolean).length;
    const isDone = newSubmitted.every(Boolean) && session.currentIndex === session.questions.length - 1;

    setSession({ ...session, answers: newAnswers, submitted: newSubmitted, correct: newCorrect, score: newScore, done: isDone });
  };

  const nextQuestion = () => {
    if (!session) return;
    setUserInput('');
    if (session.currentIndex < session.questions.length - 1) {
      setSession({ ...session, currentIndex: session.currentIndex + 1 });
    } else {
      setSession({ ...session, done: true });
    }
  };

  const resetSession = () => {
    setSession(null);
    setUserInput('');
    setSelectedPoint('');
  };

  const currentQ = session ? session.questions[session.currentIndex] : null;
  const isSubmitted = session ? session.submitted[session.currentIndex] : false;
  const isCorrect = session ? session.correct[session.currentIndex] : false;

  return (
    <AppLayout>
      <div className="space-y-4">
        {/* 标题 */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Target className="w-5 h-5 text-primary" />弱项强化训练
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">基于错题本和薄弱知识点，AI 定向生成强化练习</p>
          </div>
        </div>

        {/* 统计卡 */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: '错题总数', value: stats.totalWrong, icon: XCircle, color: 'text-red-500' },
            { label: '已掌握', value: stats.mastered, icon: CheckCircle2, color: 'text-emerald-500' },
            { label: '待攻克', value: stats.unmastered, icon: Flame, color: 'text-amber-500' },
          ].map(s => (
            <Card key={s.label} className="h-full">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`rounded-lg p-2 bg-muted ${s.color}`}><s.icon className="w-4 h-4" /></div>
                <div>
                  <p className="text-xl font-bold">{loading ? '-' : s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* 左：选择训练方向 */}
          <div className="space-y-3">
            {/* 错题本弱点 */}
            {!loading && entries.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />来自我的错题本
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {entries.filter(e => !e.mastered).slice(0, 4).map(e => (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => generateTraining(e.exercises?.title || e.exercises?.knowledge_points?.[0] || '综合练习')}
                      disabled={generating}
                      className="w-full text-left p-2.5 rounded-lg border border-border hover:border-primary/30 hover:bg-primary/5 transition-all text-sm group"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                        <span className="flex-1 truncate text-xs">{e.exercises?.title || '未知题目'}</span>
                        <Sparkles className="w-3.5 h-3.5 text-primary opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                      </div>
                      {e.exercises?.knowledge_points?.[0] && (
                        <p className="text-[10px] text-muted-foreground mt-1 pl-4">{e.exercises.knowledge_points[0]}</p>
                      )}
                    </button>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* 知识点选择 */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Brain className="w-4 h-4 text-primary" />按知识点训练
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {WEAK_TOPICS.map(t => (
                  <div key={t.label}>
                    <button
                      type="button"
                      onClick={() => setSelectedTopic(selectedTopic === t.label ? null : t.label)}
                      className="w-full flex items-center justify-between text-sm font-medium p-2 rounded-lg hover:bg-muted transition-colors text-left"
                    >
                      {t.label}
                      <ChevronRight className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${selectedTopic === t.label ? 'rotate-90' : ''}`} />
                    </button>
                    <AnimatePresence>
                      {selectedTopic === t.label && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="pl-3 pt-1 space-y-1">
                            {t.points.map(p => (
                              <button
                                key={p}
                                type="button"
                                onClick={() => { setSelectedPoint(p); generateTraining(p); }}
                                disabled={generating}
                                className={`w-full text-left text-xs px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-2 ${
                                  selectedPoint === p ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-muted-foreground'
                                }`}
                              >
                                <div className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />
                                {p}
                              </button>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* 右：训练区 */}
          <div className="lg:col-span-2">
            <AnimatePresence mode="wait">
              {!session && !generating && (
                <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <Card className="h-full">
                    <CardContent className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground gap-4">
                      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                        <Target className="w-8 h-8 text-primary" />
                      </div>
                      <div>
                        <p className="text-base font-medium text-foreground mb-1">选择薄弱点开始训练</p>
                        <p className="text-sm">从左侧点击错题或知识点，AI 将为你定向生成练习题</p>
                      </div>
                      <div className="grid grid-cols-3 gap-3 mt-2 w-full max-w-sm">
                        {['针对性出题', 'AI详解', '即时反馈'].map((f, i) => (
                          <div key={f} className="p-3 rounded-xl bg-muted/50 text-xs font-medium">
                            {['🎯', '🧠', '⚡'][i]} {f}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {generating && (
                <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
                      <Loader2 className="w-10 h-10 animate-spin text-primary" />
                      <div className="text-center">
                        <p className="font-medium">AI 正在分析薄弱点...</p>
                        <p className="text-sm text-muted-foreground mt-1">生成定向练习题，请稍候</p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {session && !generating && !session.done && currentQ && (
                <motion.div key={`q-${session.currentIndex}`} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">{session.weakPoint}</Badge>
                          <Badge variant="outline" className="text-xs">
                            {{ choice: '选择题', fill: '填空题', think: '思考题' }[currentQ.type]}
                          </Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {session.currentIndex + 1} / {session.questions.length}
                        </span>
                      </div>
                      <Progress value={(session.currentIndex / session.questions.length) * 100} className="h-1 mt-2" />
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-sm font-medium leading-relaxed">{currentQ.question}</p>

                      {currentQ.type === 'choice' && currentQ.options && (
                        <div className="space-y-2">
                          {currentQ.options.map((opt, i) => {
                            const letter = opt.charAt(0).toUpperCase();
                            const isSelected = userInput.toUpperCase() === letter;
                            const isAnswerOpt = letter === currentQ.answer.toUpperCase();
                            let cls = 'border-border hover:border-primary/30 hover:bg-primary/5';
                            if (isSubmitted) {
                              if (isAnswerOpt) cls = 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20';
                              else if (isSelected && !isAnswerOpt) cls = 'border-red-400 bg-red-50 dark:bg-red-900/20';
                            } else if (isSelected) {
                              cls = 'border-primary bg-primary/5';
                            }
                            return (
                              <button
                                key={i}
                                type="button"
                                disabled={isSubmitted}
                                onClick={() => setUserInput(letter)}
                                className={`w-full text-left p-3 rounded-xl border transition-all text-sm ${cls}`}
                              >
                                {opt}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {(currentQ.type === 'fill' || currentQ.type === 'think') && (
                        <Textarea
                          placeholder={currentQ.type === 'fill' ? '请输入答案...' : '请写出你的分析思路（至少10字）...'}
                          value={userInput}
                          onChange={e => setUserInput(e.target.value)}
                          disabled={isSubmitted}
                          className="min-h-[80px] text-sm"
                        />
                      )}

                      {/* 提交后解析 */}
                      <AnimatePresence>
                        {isSubmitted && (
                          <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`p-3 rounded-xl border ${isCorrect ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-900/15' : 'border-amber-300 bg-amber-50 dark:bg-amber-900/15'}`}
                          >
                            <div className="flex items-center gap-2 mb-1.5">
                              {isCorrect
                                ? <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                : <AlertTriangle className="w-4 h-4 text-amber-600" />
                              }
                              <span className={`text-sm font-medium ${isCorrect ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'}`}>
                                {isCorrect ? '回答正确！' : currentQ.type === 'think' ? '已记录回答' : `正确答案：${currentQ.answer}`}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed text-pretty">{currentQ.explanation}</p>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <div className="flex gap-2">
                        {!isSubmitted ? (
                          <Button className="flex-1 gap-1.5" onClick={submitAnswer} disabled={!userInput.trim()}>
                            <CheckCircle2 className="w-4 h-4" />提交答案
                          </Button>
                        ) : (
                          <Button className="flex-1 gap-1.5" onClick={nextQuestion}>
                            {session.currentIndex < session.questions.length - 1 ? (
                              <><ChevronRight className="w-4 h-4" />下一题</>
                            ) : (
                              <><Trophy className="w-4 h-4" />查看结果</>
                            )}
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={resetSession}>
                          <RotateCcw className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {session?.done && (
                <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                  <Card>
                    <CardContent className="py-10 flex flex-col items-center gap-5 text-center">
                      <motion.div
                        initial={{ scale: 0 }} animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                        className={`w-20 h-20 rounded-full flex items-center justify-center ${
                          session.score / session.questions.length >= 0.7 ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-amber-100 dark:bg-amber-900/30'
                        }`}
                      >
                        <Trophy className={`w-10 h-10 ${session.score / session.questions.length >= 0.7 ? 'text-emerald-600' : 'text-amber-500'}`} />
                      </motion.div>
                      <div>
                        <h2 className="text-2xl font-bold">{session.score}/{session.questions.length}</h2>
                        <p className="text-muted-foreground mt-1">{session.weakPoint} 专项训练完成</p>
                      </div>
                      <div className="flex items-center gap-3 flex-wrap justify-center">
                        {session.correct.map((c, i) => (
                          <div key={i} className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${c ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30' : 'bg-red-100 text-red-600 dark:bg-red-900/30'}`}>
                            {i + 1}
                          </div>
                        ))}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {session.score / session.questions.length >= 0.7
                          ? '🎉 掌握良好！继续保持，巩固其他薄弱知识点。'
                          : '💪 还需加强！建议再次练习或查阅相关资料。'}
                      </p>
                      <div className="flex gap-2">
                        <Button onClick={() => generateTraining(session.weakPoint)} disabled={generating} className="gap-1.5">
                          <RotateCcw className="w-4 h-4" />再练一次
                        </Button>
                        <Button variant="outline" onClick={resetSession} className="gap-1.5">
                          <TrendingUp className="w-4 h-4" />换个弱点
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
