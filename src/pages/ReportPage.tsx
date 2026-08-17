import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';
import AppLayout from '@/components/layouts/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { motion } from 'motion/react';
import { getLearningReportData } from '@/services/learning/service';
import type { ExerciseQuestionType, ExerciseSubmission, KnowledgeMastery } from '@/types/types';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import {
  TrendingUp, Clock, BookOpen, Target, ChevronLeft, ChevronRight,
  BarChart3, Calendar, Award, Zap
} from 'lucide-react';

type Period = 'weekly' | 'monthly';

interface DayStat {
  label: string;
  minutes: number;
  resources: number;
  correct: number;
  exercises: number;
}

type SubmissionRow = Pick<ExerciseSubmission, 'created_at' | 'is_correct' | 'ai_score' | 'ai_status'> & {
  exercises: { question_type?: ExerciseQuestionType }[] | null;
};

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))'];

function getWeekRange(offset = 0) {
  const now = new Date();
  const day = now.getDay() || 7;
  const mon = new Date(now);
  mon.setDate(now.getDate() - day + 1 + offset * 7);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return { start: mon, end: sun };
}

function getMonthRange(offset = 0) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
  return { start, end };
}

function toDateStr(d: Date) { return d.toISOString().split('T')[0]; }

export default function ReportPage() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<Period>('weekly');
  const [offset, setOffset] = useState(0);
  const [stats, setStats] = useState<DayStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({ totalMin: 0, totalRes: 0, totalExer: 0, correctRate: 0, checkInDays: 0 });
  const [mastery, setMastery] = useState<KnowledgeMastery[]>([]);
  const [reportInsight, setReportInsight] = useState<string | null>(null);

  useEffect(() => {
    if (user) loadStats();
  }, [user, period, offset]);

  const loadStats = async () => {
    setLoading(true);
    const range = period === 'weekly' ? getWeekRange(offset) : getMonthRange(offset);
    const start = toDateStr(range.start);
    const end = toDateStr(range.end);

    // 学习进度（资源）
    const { data: progressData } = await supabase
      .from('user_progress')
      .select('created_at, completed')
      .eq('user_id', user!.id)
      .gte('created_at', start)
      .lte('created_at', end + 'T23:59:59');

    // 真实答题提交：排除仍等待 AI 评分的主观题。
    const { data: exerciseData } = await supabase
      .from('user_exercise_submissions')
      .select('created_at, is_correct, ai_score, ai_status, exercises(question_type)')
      .eq('user_id', user!.id)
      .gte('created_at', start)
      .lte('created_at', end + 'T23:59:59');

    // 打卡
    const { data: checkinData } = await supabase
      .from('user_check_ins')
      .select('check_date, study_minutes')
      .eq('user_id', user!.id)
      .gte('check_date', start)
      .lte('check_date', end);

    const progRows: { created_at: string; completed: boolean }[] = Array.isArray(progressData) ? progressData : [];
    const submissionRows = (Array.isArray(exerciseData) ? exerciseData : []) as SubmissionRow[];
    const exerRows = submissionRows.filter(submission => {
      const questionType = submission.exercises?.[0]?.question_type;
      return questionType === 'subjective'
        ? submission.ai_status === 'completed' && submission.ai_score !== null && submission.is_correct !== null
        : submission.is_correct !== null;
    });
    const cinRows: { check_date: string; study_minutes: number }[] = Array.isArray(checkinData) ? checkinData : [];

    // 构建每日统计
    const dayMap: Record<string, DayStat> = {};
    const cur = new Date(range.start);
    while (cur <= range.end) {
      const k = toDateStr(cur);
      const label = period === 'weekly'
        ? ['周一','周二','周三','周四','周五','周六','周日'][cur.getDay() === 0 ? 6 : cur.getDay() - 1]
        : `${cur.getDate()}日`;
      dayMap[k] = { label, minutes: 0, resources: 0, correct: 0, exercises: 0 };
      cur.setDate(cur.getDate() + 1);
    }

    cinRows.forEach(r => {
      if (dayMap[r.check_date]) dayMap[r.check_date].minutes += r.study_minutes;
    });
    progRows.forEach(r => {
      const k = r.created_at.split('T')[0];
      if (dayMap[k]) dayMap[k].resources++;
    });
    exerRows.forEach(r => {
      const k = r.created_at.split('T')[0];
      if (!dayMap[k]) return;
      dayMap[k].exercises++;
      if (r.is_correct) dayMap[k].correct++;
    });

    const dayStats = Object.values(dayMap);

    const totalMin = cinRows.reduce((s, r) => s + r.study_minutes, 0);
    const totalRes = progRows.length;
    const totalExer = exerRows.length;
    const correctRate = totalExer > 0 ? Math.round(exerRows.filter(r => r.is_correct).length / totalExer * 100) : 0;
    const checkInDays = cinRows.length;
    const learningReport = await getLearningReportData({
      periodStart: `${start}T00:00:00`,
      periodEnd: `${end}T23:59:59`,
    }).catch(error => {
      console.warn('学习洞察加载失败：', error);
      return null;
    });

    setStats(dayStats);
    setSummary({ totalMin, totalRes, totalExer, correctRate, checkInDays });
    setMastery(learningReport?.mastery ?? []);
    setReportInsight(learningReport?.report?.ai_summary ?? null);
    setLoading(false);
  };

  const { start, end } = period === 'weekly' ? getWeekRange(offset) : getMonthRange(offset);
  const periodLabel = period === 'weekly'
    ? `${start.getMonth() + 1}月${start.getDate()}日 - ${end.getMonth() + 1}月${end.getDate()}日`
    : `${start.getFullYear()}年${start.getMonth() + 1}月`;

  const pieData = [
    { name: '已完成资源', value: summary.totalRes || 0 },
    { name: '练习题', value: summary.totalExer || 0 },
    { name: '打卡天数', value: summary.checkInDays || 0 },
  ].filter(d => d.value > 0);
  const weakestMastery = mastery.slice().sort((a, b) => a.mastery_score - b.mastery_score)[0];
  const strongestMastery = mastery.slice().sort((a, b) => b.mastery_score - a.mastery_score)[0];

  return (
    <AppLayout>
      <div className="space-y-5">
        {/* 标题 + 切换 */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />数据报告
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">回顾你的学习数据，了解进步轨迹</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-border overflow-hidden">
              <button
                type="button"
                onClick={() => { setPeriod('weekly'); setOffset(0); }}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${period === 'weekly' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
              >周报</button>
              <button
                type="button"
                onClick={() => { setPeriod('monthly'); setOffset(0); }}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${period === 'monthly' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
              >月报</button>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setOffset(o => o - 1)}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm min-w-[140px] text-center">{periodLabel}</span>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setOffset(o => Math.min(o + 1, 0))} disabled={offset === 0}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* 四卡汇总 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: Clock, label: '学习时长', value: `${Math.floor(summary.totalMin / 60)}h ${summary.totalMin % 60}m`, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20' },
            { icon: BookOpen, label: '学习资源', value: `${summary.totalRes} 个`, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
            { icon: Target, label: '答题正确率', value: `${summary.correctRate}%`, color: 'text-violet-500', bg: 'bg-violet-50 dark:bg-violet-900/20' },
            { icon: Calendar, label: '打卡天数', value: `${summary.checkInDays} 天`, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20' },
          ].map(({ icon: Icon, label, value, color, bg }) => (
            <Card key={label} className="h-full">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
                  <Icon className={`w-5 h-5 ${color}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-lg font-bold mt-0.5">{loading ? '—' : value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* 图表区域 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 学习时长柱状图 */}
          <Card className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />每日学习时长（分钟）
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? <Skeleton className="h-48 bg-muted rounded-lg" /> : (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
                  <ResponsiveContainer width="100%" height={190}>
                    <BarChart data={stats} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{ fontSize: 12, borderRadius: 8 }}
                        formatter={(v: number) => [`${v} 分钟`, '学习时长']}
                      />
                      <Bar dataKey="minutes" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </motion.div>
              )}
            </CardContent>
          </Card>

          {/* 每日答题统计 */}
          <Card className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Target className="w-4 h-4 text-violet-500" />每日答题数与正确数
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? <Skeleton className="h-48 bg-muted rounded-lg" /> : (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
                  <ResponsiveContainer width="100%" height={190}>
                    <LineChart data={stats} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v: number, name: string) => [`${v} 题`, name === 'exercises' ? '答题数' : '正确数']} />
                      <Line type="monotone" dataKey="exercises" name="exercises" stroke="hsl(var(--chart-2))" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                      <Line type="monotone" dataKey="correct" name="correct" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </motion.div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 综合分析 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 饼图 */}
          <Card className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500" />学习活动分布
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? <Skeleton className="h-48 bg-muted rounded-lg" /> : pieData.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">暂无数据</div>
              ) : (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
                  <ResponsiveContainer width="100%" height={190}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" paddingAngle={3}>
                        {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} layout="horizontal" />
                    </PieChart>
                  </ResponsiveContainer>
                </motion.div>
              )}
            </CardContent>
          </Card>

          {/* 学习洞察 */}
          <Card className="md:col-span-2 h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Award className="w-4 h-4 text-violet-500" />学习洞察
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 bg-muted rounded-lg" />)}</div>
              ) : (
                <div className="space-y-3">
                  {[
                    {
                      emoji: '📈',
                      title: '学习活跃度',
                      desc: summary.checkInDays >= 5 ? '本期学习非常稳定，继续保持！' : summary.checkInDays >= 3 ? '保持不错，还可以更稳定' : '建议培养每日学习习惯',
                      color: summary.checkInDays >= 5 ? 'text-emerald-600' : summary.checkInDays >= 3 ? 'text-amber-600' : 'text-rose-600',
                    },
                    {
                      emoji: '🎯',
                      title: '答题表现',
                      desc: summary.totalExer === 0 ? '本期尚未完成练习题' : summary.correctRate >= 80 ? `正确率 ${summary.correctRate}%，掌握得很好` : summary.correctRate >= 60 ? `正确率 ${summary.correctRate}%，继续加油` : `正确率 ${summary.correctRate}%，建议多复习错题`,
                      color: summary.correctRate >= 80 ? 'text-emerald-600' : summary.correctRate >= 60 ? 'text-amber-600' : 'text-rose-600',
                    },
                    {
                      emoji: '📚',
                      title: '资源学习',
                      desc: summary.totalRes === 0 ? '本期尚未浏览学习资源' : `已学习 ${summary.totalRes} 个资源，${summary.totalRes >= 10 ? '知识储备丰富' : '可以多探索资源中心'}`,
                      color: summary.totalRes >= 10 ? 'text-emerald-600' : 'text-amber-600',
                    },
                    {
                      emoji: '🧠',
                      title: '知识掌握',
                      desc: mastery.length === 0
                        ? '暂无知识点掌握度数据，完成带知识点的练习后将生成洞察'
                        : reportInsight ?? `已评估 ${mastery.length} 个知识点；${weakestMastery ? `最低掌握度 ${Math.round(weakestMastery.mastery_score)} 分` : ''}${strongestMastery ? `，最高掌握度 ${Math.round(strongestMastery.mastery_score)} 分` : ''}`,
                      color: mastery.length === 0 ? 'text-amber-600' : weakestMastery && weakestMastery.mastery_score < 60 ? 'text-rose-600' : 'text-emerald-600',
                    },
                  ].map((item, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 * i }}
                      className="flex items-start gap-3 p-3 rounded-lg bg-muted/40"
                    >
                      <span className="text-lg shrink-0">{item.emoji}</span>
                      <div>
                        <p className="text-sm font-medium">{item.title}</p>
                        <p className={`text-xs mt-0.5 ${item.color}`}>{item.desc}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
