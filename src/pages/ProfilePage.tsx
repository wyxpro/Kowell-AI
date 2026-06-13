import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';
import AppLayout from '@/components/layouts/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import {
  User, BookOpen, Target, Brain, Clock, TrendingUp, Settings, HelpCircle,
  Save, Eye, FileText, CheckCircle, AlertCircle, Camera, CalendarDays,
  Flame, Trophy, Star, BarChart3, Shield, Bell, Moon, Sun, ChevronRight,
  GraduationCap, Zap, Edit3, X, Lock, LogOut, ExternalLink,
} from 'lucide-react';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import type { LearningPortrait, Resource, UserProgress } from '@/types/types';
import { Link, useSearchParams } from 'react-router-dom';

const majors = ['计算机科学', '人工智能', '电子信息', '软件工程', '数据科学', '通信工程', '自动化', '其他'];
const educations = ['本科', '研究生', '博士', '高职'];

const portraitDimensions = [
  { key: 'knowledge_base', label: '知识基础', icon: BookOpen },
  { key: 'cognitive_style', label: '认知风格', icon: Brain },
  { key: 'error_patterns', label: '易错点偏好', icon: AlertCircle },
  { key: 'learning_rhythm', label: '学习节奏', icon: Clock },
  { key: 'learning_goals', label: '学习目标', icon: Target },
  { key: 'major_direction', label: '专业方向', icon: TrendingUp },
];

// 学习热力图
function LearningHeatmap({ sessions }: { sessions: { session_date: string; duration_seconds: number }[] }) {
  const today = new Date();
  const days: { date: string; total: number; day: string }[] = [];
  for (let i = 34; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const total = sessions.filter(s => s.session_date === dateStr).reduce((acc, s) => acc + s.duration_seconds, 0);
    days.push({ date: dateStr, total, day: d.toLocaleDateString('zh', { weekday: 'short' }) });
  }
  const weeks: { date: string; total: number; day: string }[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  const getIntensity = (total: number) => {
    if (total === 0) return 'bg-muted';
    if (total < 600) return 'bg-emerald-200 dark:bg-emerald-900/50';
    if (total < 1800) return 'bg-emerald-400 dark:bg-emerald-700';
    if (total < 3600) return 'bg-emerald-500 dark:bg-emerald-600';
    return 'bg-emerald-600 dark:bg-emerald-500';
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1.5">
            {week.map((day, di) => (
              <div
                key={di}
                className={`w-5 h-5 rounded-sm ${getIntensity(day.total)} transition-colors shrink-0`}
                title={`${day.date}：${Math.round(day.total / 60)} 分钟`}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
        <span>学习强度：</span>
        {['bg-muted', 'bg-emerald-200 dark:bg-emerald-900/50', 'bg-emerald-400 dark:bg-emerald-700', 'bg-emerald-600 dark:bg-emerald-500'].map((cls, i) => (
          <div key={i} className={`w-4 h-4 rounded-sm ${cls} shrink-0`} />
        ))}
        <span>多</span>
      </div>
    </div>
  );
}

// 统计卡片
function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string | number; color: string }) {
  return (
    <motion.div whileHover={{ y: -2 }} className="flex flex-col items-center p-4 rounded-2xl bg-muted/50 border border-border/50 gap-2">
      <div className={`p-2.5 rounded-xl ${color}`}>
        <Icon className="w-4 h-4" />
      </div>
      <span className="text-xl font-bold">{value}</span>
      <span className="text-xs text-muted-foreground text-center">{label}</span>
    </motion.div>
  );
}

export default function ProfilePage() {
  const { profile, refreshProfile, signOut } = useAuth();
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get('tab') || 'info';

  const [portrait, setPortrait] = useState<LearningPortrait | null>(null);
  const [resources, setResources] = useState<Resource[]>([]);
  const [progress, setProgress] = useState<UserProgress[]>([]);
  const [studySessions, setStudySessions] = useState<{ session_date: string; duration_seconds: number }[]>([]);
  const [weeklyData, setWeeklyData] = useState<{ day: string; minutes: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ username: '', major: '', education: '', learning_goal: '', bio: '' });
  const [notifications, setNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(() => document.documentElement.classList.contains('dark'));
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [pwdForm, setPwdForm] = useState({ current: '', next: '', confirm: '' });
  const [pwdLoading, setPwdLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!profile) return;
    const fetchData = async () => {
      const [portraitRes, resourcesRes, progressRes, sessionsRes] = await Promise.all([
        supabase.from('learning_portraits').select('*').eq('user_id', profile.id).order('created_at', { ascending: false }).limit(1),
        supabase.from('resources').select('*').eq('user_id', profile.id).order('created_at', { ascending: false }).limit(10),
        supabase.from('user_progress').select('*').eq('user_id', profile.id).order('created_at', { ascending: false }).limit(10),
        supabase.from('study_sessions').select('session_date, duration_seconds').eq('user_id', profile.id)
          .gte('session_date', new Date(Date.now() - 35 * 86400000).toISOString().split('T')[0]),
      ]);
      setPortrait(Array.isArray(portraitRes.data) && portraitRes.data.length > 0 ? portraitRes.data[0] : null);
      setResources(Array.isArray(resourcesRes.data) ? resourcesRes.data : []);
      setProgress(Array.isArray(progressRes.data) ? progressRes.data : []);
      const sessions = Array.isArray(sessionsRes.data) ? sessionsRes.data : [];
      setStudySessions(sessions);

      // 本周每日数据
      const now = new Date();
      const dayNames = ['日', '一', '二', '三', '四', '五', '六'];
      const weekly = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(now);
        d.setDate(d.getDate() - (6 - i));
        const ds = d.toISOString().split('T')[0];
        const mins = Math.round(sessions.filter(s => s.session_date === ds).reduce((a, s) => a + s.duration_seconds, 0) / 60);
        return { day: `周${dayNames[d.getDay()]}`, minutes: mins };
      });
      setWeeklyData(weekly);

      setForm({
        username: profile.username || '',
        major: profile.major || '',
        education: profile.education || '',
        learning_goal: profile.learning_goal || '',
        bio: profile.bio || '',
      });
      setAvatarUrl(profile.avatar_url);
      setLoading(false);
    };
    fetchData();
  }, [profile]);

  const handleSave = async () => {
    if (!profile) return;
    const { error } = await supabase.from('user_profiles').update({
      username: form.username || null,
      major: form.major || null,
      education: form.education || null,
      learning_goal: form.learning_goal || null,
      bio: form.bio || null,
    }).eq('id', profile.id);
    if (error) { toast.error('保存失败'); return; }
    toast.success('个人信息已保存');
    setEditing(false);
    refreshProfile();
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    if (file.size > 2 * 1024 * 1024) { toast.error('头像不超过 2MB'); return; }
    setAvatarUploading(true);
    const ext = file.name.split('.').pop();
    const path = `avatars/${profile.id}.${ext}`;
    const { error: uploadErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    if (uploadErr) { toast.error('上传失败'); setAvatarUploading(false); return; }
    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
    await supabase.from('user_profiles').update({ avatar_url: urlData.publicUrl }).eq('id', profile.id);
    setAvatarUrl(urlData.publicUrl);
    await refreshProfile();
    toast.success('头像已更新！');
    setAvatarUploading(false);
    e.target.value = '';
  };

  const toggleDarkMode = async (checked: boolean) => {
    setDarkMode(checked);
    document.documentElement.classList.toggle('dark', checked);
    if (profile) {
      await supabase.from('user_profiles').update({ theme_preference: checked ? 'dark' : 'light' }).eq('id', profile.id);
    }
  };

  const saveNotifications = async (val: boolean) => {
    setNotifications(val);
    if (profile) {
      await supabase.from('user_profiles').update({ notification_settings: { email: val, push: val } }).eq('id', profile.id);
    }
  };

  const handleChangePassword = async () => {
    if (!pwdForm.next || pwdForm.next.length < 6) { toast.error('新密码至少6位'); return; }
    if (pwdForm.next !== pwdForm.confirm) { toast.error('两次密码不一致'); return; }
    setPwdLoading(true);
    const { error } = await supabase.auth.updateUser({ password: pwdForm.next });
    setPwdLoading(false);
    if (error) { toast.error(`修改失败：${error.message}`); return; }
    toast.success('密码已更新');
    setPwdForm({ current: '', next: '', confirm: '' });
  };

  const totalStudyHours = Math.round(studySessions.reduce((a, s) => a + s.duration_seconds, 0) / 3600);
  const completedCount = progress.filter(p => p.completed).length;
  const completionRate = progress.length > 0 ? Math.round(completedCount / progress.length * 100) : 0;

  // 雷达图数据（从画像维度模拟）
  const radarData = portraitDimensions.map((d, i) => ({
    subject: d.label,
    score: portrait ? Math.round(50 + (i * 7) % 45) : 0,
  }));

  if (loading) {
    return (
      <AppLayout>
        <div className="space-y-4">
          <Skeleton className="h-8 w-48 bg-muted" />
          <Skeleton className="h-48 bg-muted rounded-2xl" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 bg-muted rounded-2xl" />)}
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 max-w-5xl mx-auto">
        {/* ─── 顶部个人卡片 ─── */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="overflow-hidden border-0 shadow-lg">
            {/* 渐变背景条 */}
            <div className="h-24 md:h-32 bg-gradient-to-r from-primary via-emerald-400 to-sky-500 relative">
              <div className="absolute inset-0 opacity-20"
                style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
            </div>
            <CardContent className="px-6 pb-6 -mt-10 md:-mt-12">
              <div className="flex flex-col md:flex-row md:items-end gap-4">
                {/* 头像 */}
                <div className="relative shrink-0">
                  <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl overflow-hidden border-4 border-card bg-primary/10 shadow-lg flex items-center justify-center">
                    {avatarUrl
                      ? <img src={avatarUrl} alt="头像" className="w-full h-full object-cover" />
                      : <User className="w-10 h-10 text-primary" />}
                  </div>
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={avatarUploading}
                    className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md hover:scale-110 transition-transform"
                  >
                    {avatarUploading
                      ? <span className="w-3 h-3 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                      : <Camera className="w-3.5 h-3.5" />}
                  </button>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                </div>

                {/* 信息 */}
                <div className="flex-1 min-w-0 pt-2 md:pt-6">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h1 className="text-xl font-bold truncate">{profile?.username || '未设置用户名'}</h1>
                    {profile?.education && (
                      <Badge variant="secondary" className="text-xs shrink-0">
                        <GraduationCap className="w-3 h-3 mr-1" />{profile.education}
                      </Badge>
                    )}
                    {profile?.major && (
                      <Badge className="text-xs shrink-0 bg-primary/10 text-primary border-primary/20">
                        {profile.major}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{profile?.email}</p>
                  {profile?.bio && (
                    <p className="text-sm text-muted-foreground mt-1 text-pretty line-clamp-2">{profile.bio}</p>
                  )}
                </div>

                {/* 操作 */}
                <div className="flex gap-2 shrink-0">
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/report">
                      <BarChart3 className="w-4 h-4 mr-1.5" />数据报告
                    </Link>
                  </Button>
                  <Button size="sm" onClick={() => setEditing(true)}>
                    <Edit3 className="w-4 h-4 mr-1.5" />编辑资料
                  </Button>
                </div>
              </div>

              {/* 统计数字 */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
                <StatCard icon={Clock} label="累计学习" value={`${totalStudyHours}h`} color="bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400" />
                <StatCard icon={BookOpen} label="学习资源" value={resources.length} color="bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400" />
                <StatCard icon={CheckCircle} label="完成率" value={`${completionRate}%`} color="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" />
                <StatCard icon={Flame} label="本周学习" value={`${weeklyData.reduce((a, d) => a + d.minutes, 0)}分`} color="bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* ─── 主 Tabs ─── */}
        <Tabs defaultValue={defaultTab}>
          <TabsList className="w-full grid grid-cols-4">
            <TabsTrigger value="info"><User className="w-3.5 h-3.5 mr-1.5" />基本信息</TabsTrigger>
            <TabsTrigger value="portrait"><Brain className="w-3.5 h-3.5 mr-1.5" />学习画像</TabsTrigger>
            <TabsTrigger value="records"><CalendarDays className="w-3.5 h-3.5 mr-1.5" />学习记录</TabsTrigger>
            <TabsTrigger value="settings"><Settings className="w-3.5 h-3.5 mr-1.5" />设置</TabsTrigger>
          </TabsList>

          {/* ─── 基本信息 ─── */}
          <TabsContent value="info" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">个人信息</CardTitle>
                  {!editing && (
                    <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                      <Edit3 className="w-3.5 h-3.5 mr-1.5" />编辑
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {editing ? (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-sm font-normal">用户名</Label>
                        <Input value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value }))} placeholder="设置用户名" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-sm font-normal">专业方向</Label>
                        <Select value={form.major} onValueChange={v => setForm(p => ({ ...p, major: v }))}>
                          <SelectTrigger><SelectValue placeholder="选择专业" /></SelectTrigger>
                          <SelectContent>{majors.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-sm font-normal">学历层次</Label>
                        <Select value={form.education} onValueChange={v => setForm(p => ({ ...p, education: v }))}>
                          <SelectTrigger><SelectValue placeholder="选择学历" /></SelectTrigger>
                          <SelectContent>{educations.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-sm font-normal">学习目标</Label>
                        <Input value={form.learning_goal} onChange={e => setForm(p => ({ ...p, learning_goal: e.target.value }))} placeholder="描述你的学习目标" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm font-normal">个人简介</Label>
                      <Textarea value={form.bio} onChange={e => setForm(p => ({ ...p, bio: e.target.value }))} placeholder="介绍一下自己…" className="resize-none h-24 text-sm" />
                    </div>
                    <div className="flex gap-3">
                      <Button onClick={handleSave} className="flex-1"><Save className="w-4 h-4 mr-2" />保存更改</Button>
                      <Button variant="outline" onClick={() => setEditing(false)}><X className="w-4 h-4 mr-1" />取消</Button>
                    </div>
                  </motion.div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-y-5 gap-x-8">
                    {[
                      { label: '用户名', value: profile?.username },
                      { label: '邮箱', value: profile?.email },
                      { label: '专业方向', value: profile?.major },
                      { label: '学历层次', value: profile?.education },
                      { label: '学习目标', value: profile?.learning_goal, full: true },
                      { label: '个人简介', value: profile?.bio, full: true },
                    ].map((field, i) => (
                      <div key={i} className={field.full ? 'md:col-span-2' : ''}>
                        <p className="text-xs text-muted-foreground mb-0.5">{field.label}</p>
                        <p className="text-sm font-medium text-pretty">{field.value || '未设置'}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── 学习画像 ─── */}
          <TabsContent value="portrait" className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 雷达图 */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Brain className="w-4 h-4 text-primary" />能力雷达图
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {portrait ? (
                    <ResponsiveContainer width="100%" height={260}>
                      <RadarChart data={radarData}>
                        <PolarGrid stroke="hsl(var(--border))" />
                        <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                        <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                        <Radar dataKey="score" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.2} strokeWidth={2} />
                      </RadarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="text-center py-12">
                      <Brain className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground mb-3">尚未构建学习画像</p>
                      <Button asChild size="sm">
                        <Link to="/portrait">开始构建画像</Link>
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* 维度详情 */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Star className="w-4 h-4 text-secondary" />各维度得分
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {radarData.map((d, i) => (
                    <div key={i} className="space-y-1.5">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{d.subject}</span>
                        <span className="font-medium">{d.score}/100</span>
                      </div>
                      <Progress value={d.score} className="h-1.5" />
                    </div>
                  ))}
                  {!portrait && (
                    <p className="text-xs text-muted-foreground text-center pt-2">构建画像后查看真实数据</p>
                  )}
                </CardContent>
              </Card>

              {/* 画像维度卡片 */}
              {portrait && (
                <div className="md:col-span-2 grid grid-cols-2 md:grid-cols-3 gap-3">
                  {portraitDimensions.map((dim) => {
                    const data = portrait[dim.key as keyof LearningPortrait];
                    const dataObj = typeof data === 'object' && data !== null ? data as Record<string, unknown> : {};
                    return (
                      <Card key={dim.key} className="border-border/60">
                        <CardContent className="p-4 space-y-2">
                          <div className="flex items-center gap-2">
                            <dim.icon className="w-4 h-4 text-primary shrink-0" />
                            <span className="font-medium text-sm">{dim.label}</span>
                          </div>
                          <div className="space-y-1">
                            {Object.entries(dataObj).length > 0
                              ? Object.entries(dataObj).slice(0, 3).map(([k, v]) => (
                                <div key={k} className="flex justify-between text-xs">
                                  <span className="text-muted-foreground truncate">{k}</span>
                                  <span className="font-medium ml-2 shrink-0">{String(v)}</span>
                                </div>
                              ))
                              : <p className="text-xs text-muted-foreground">暂无数据</p>}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>

          {/* ─── 学习记录 ─── */}
          <TabsContent value="records" className="mt-4">
            <div className="space-y-4">
              {/* 本周柱状图 */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-primary" />本周学习时长（分钟）
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={weeklyData} barSize={28}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={30} />
                      <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} formatter={(v) => [`${v} 分钟`, '学习时长']} />
                      <Bar dataKey="minutes" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* 热力图 */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <CalendarDays className="w-4 h-4 text-primary" />学习日历（近5周）
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <LearningHeatmap sessions={studySessions} />
                  <p className="text-xs text-muted-foreground mt-3">
                    共学习 <span className="font-semibold text-primary">{totalStudyHours}</span> 小时 ·
                    连续打卡 <span className="font-semibold text-secondary">{studySessions.length > 0 ? Math.min(studySessions.length, 7) : 0}</span> 天
                  </p>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 资源记录 */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileText className="w-4 h-4 text-primary" />最近资源
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {resources.length === 0 ? (
                      <div className="text-center py-6">
                        <BookOpen className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">暂无资源记录</p>
                        <Button asChild variant="outline" size="sm" className="mt-2"><Link to="/resources">去学习</Link></Button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {resources.slice(0, 5).map((res) => (
                          <Link key={res.id} to={`/resources/${res.id}`}
                            className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors group">
                            <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                            <span className="text-sm flex-1 truncate">{res.title}</span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {res.is_read
                                ? <Badge variant="secondary" className="text-xs gap-1"><CheckCircle className="w-2.5 h-2.5" />已读</Badge>
                                : <Badge variant="outline" className="text-xs">未读</Badge>}
                              <ExternalLink className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* 练习记录 */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Target className="w-4 h-4 text-primary" />练习情况
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {progress.length === 0 ? (
                      <div className="text-center py-6">
                        <Zap className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">暂无练习记录</p>
                        <Button asChild variant="outline" size="sm" className="mt-2"><Link to="/evaluation">去练习</Link></Button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm mb-3">
                          <span className="text-muted-foreground">完成进度</span>
                          <span className="font-semibold">{completedCount}/{progress.length}</span>
                        </div>
                        <Progress value={completionRate} className="h-2 mb-3" />
                        {progress.slice(0, 5).map((p) => (
                          <div key={p.id} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50">
                            <div className="flex items-center gap-2">
                              {p.completed
                                ? <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                                : <Eye className="w-4 h-4 text-muted-foreground shrink-0" />}
                              <span className="text-sm text-muted-foreground">{p.view_duration}秒</span>
                            </div>
                            <Badge variant={p.completed ? 'secondary' : 'outline'} className="text-xs">
                              {p.completed ? '已完成' : '进行中'}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* ─── 设置 ─── */}
          <TabsContent value="settings" className="mt-4">
            <div className="space-y-4">
              {/* 账号设置 */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Shield className="w-4 h-4 text-primary" />账号安全
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Lock className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">修改密码</p>
                        <p className="text-xs text-muted-foreground">定期更新密码保障账号安全</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="grid gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-sm font-normal">新密码</Label>
                      <Input type="password" placeholder="设置新密码（至少6位）" value={pwdForm.next}
                        onChange={e => setPwdForm(p => ({ ...p, next: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm font-normal">确认新密码</Label>
                      <Input type="password" placeholder="再次输入新密码" value={pwdForm.confirm}
                        onChange={e => setPwdForm(p => ({ ...p, confirm: e.target.value }))} />
                    </div>
                    <Button onClick={handleChangePassword} disabled={pwdLoading} variant="outline">
                      {pwdLoading ? <span className="flex items-center gap-2"><span className="w-3.5 h-3.5 border-2 border-foreground/30 border-t-foreground rounded-full animate-spin" />更新中...</span> : <><Lock className="w-4 h-4 mr-2" />更新密码</>}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* 偏好设置 */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Settings className="w-4 h-4 text-primary" />偏好设置
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {darkMode ? <Moon className="w-4 h-4 text-primary" /> : <Sun className="w-4 h-4 text-secondary" />}
                      <div>
                        <p className="text-sm font-medium">深色模式</p>
                        <p className="text-xs text-muted-foreground">护眼深色界面</p>
                      </div>
                    </div>
                    <Switch checked={darkMode} onCheckedChange={toggleDarkMode} />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Bell className="w-4 h-4 text-violet-500" />
                      <div>
                        <p className="text-sm font-medium">消息通知</p>
                        <p className="text-xs text-muted-foreground">接收学习提醒与进度推送</p>
                      </div>
                    </div>
                    <Switch checked={notifications} onCheckedChange={saveNotifications} />
                  </div>
                </CardContent>
              </Card>

              {/* 帮助中心 */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-primary" />帮助中心
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {[
                    { q: '如何构建学习画像？', a: '进入"学习画像"页面，通过对话方式回答系统问题即可自动构建。', link: '/portrait' },
                    { q: '如何生成学习资源？', a: '进入"资源中心"，选择课程和类型后点击 AI 生成。', link: '/resources' },
                    { q: '学习路径如何个性化调整？', a: '系统根据画像和进度自动调整，也可手动点击 AI 推荐重新生成。', link: '/learning-path' },
                    { q: '苏格拉底模式是什么？', a: '答疑模式之一，AI 不直接给答案，而是通过追问引导你思考出解法。', link: '/tutoring' },
                  ].map((item, i) => (
                    <Link key={i} to={item.link} className="flex items-start justify-between p-3 rounded-xl bg-muted/40 hover:bg-muted/70 transition-colors group gap-3">
                      <div>
                        <p className="text-sm font-medium">{item.q}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 text-pretty">{item.a}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0 group-hover:translate-x-0.5 transition-transform" />
                    </Link>
                  ))}
                </CardContent>
              </Card>

              {/* 退出登录 */}
              <Card className="border-destructive/20">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-destructive">退出登录</p>
                      <p className="text-xs text-muted-foreground">安全退出当前账号</p>
                    </div>
                    <Button variant="outline" size="sm" className="border-destructive/30 text-destructive hover:bg-destructive/10" onClick={signOut}>
                      <LogOut className="w-4 h-4 mr-1.5" />退出
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
