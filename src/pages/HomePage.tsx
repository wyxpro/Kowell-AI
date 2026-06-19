import { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';
import AppLayout from '@/components/layouts/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'motion/react';
import {
  BookOpen, Route, MessageCircle, BarChart3, Sparkles, Clock, Target, ChevronRight,
  Brain, PlayCircle, FileText, Code, TrendingUp, Zap, Activity,
  Search, BookMarked, X, CheckSquare, StickyNote, Trophy, Medal, GraduationCap,
} from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts';
import type { Resource } from '@/types/types';
import { RESOURCE_TYPE_LABELS } from '@/types/types';
import CheckInWidget from '@/components/common/CheckInWidget';

const resourceTypeIcons: Record<string, React.ReactNode> = {
  document: <FileText className="w-4 h-4" />,
  mindmap: <Brain className="w-4 h-4" />,
  exercise: <Target className="w-4 h-4" />,
  reading: <BookOpen className="w-4 h-4" />,
  code: <Code className="w-4 h-4" />,
};

const resourceTypeColors: Record<string, string> = {
  document: 'bg-primary/10 text-primary',
  mindmap: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
  exercise: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
  reading: 'bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400',
  code: 'bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400',
};

const quickActions = [
  { label: '资源中心', desc: '生成学习资源', icon: BookOpen, href: '/resources/generate', color: 'bg-primary/10 text-primary' },
  { label: '学习路径', desc: '规划学习计划', icon: Route, href: '/learning-path', color: 'bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-500' },
  { label: '答疑中心', desc: '智能解答问题', icon: MessageCircle, href: '/tutoring', color: 'bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-500' },
  { label: '今日待办', desc: '管理每日任务', icon: CheckSquare, href: '/todos', color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-500' },
  { label: '我的笔记', desc: '记录学习心得', icon: StickyNote, href: '/notes', color: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' },
  { label: '错题本', desc: '巩固薄弱知识', icon: BookMarked, href: '/wrong-book', color: 'bg-red-100 text-red-500 dark:bg-red-900/30 dark:text-red-400' },
  { label: '数据报告', desc: '周期学习统计', icon: BarChart3, href: '/report', color: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400' },
  { label: '成就徽章', desc: '解锁学习成就', icon: Trophy, href: '/badges', color: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400' },
];

export default function HomePage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [resources, setResources] = useState<Resource[]>([]);
  const [allResources, setAllResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, completed: 0, unread: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Resource[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 6) return '夜深了';
    if (h < 12) return '早上好';
    if (h < 14) return '中午好';
    if (h < 18) return '下午好';
    return '晚上好';
  };

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    const fetchData = async () => {
      const [resourcesRes, allRes] = await Promise.all([
        supabase.from('resources').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(6),
        supabase.from('resources').select('id,title,resource_type').eq('user_id', user.id),
      ]);
      const resData: Resource[] = Array.isArray(resourcesRes.data) ? resourcesRes.data : [];
      setResources(resData);
      setAllResources((Array.isArray(allRes.data) ? allRes.data : []) as Resource[]);
      setStats({ total: resData.length, completed: resData.filter(r => r.is_read).length, unread: resData.filter(r => !r.is_read).length });
      setLoading(false);
    };
    fetchData();
  }, [user]);

  // 全局搜索
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); setShowSearch(false); return; }
    setShowSearch(true);
    const q = searchQuery.toLowerCase();
    setSearchResults(allResources.filter(r => r.title.toLowerCase().includes(q)).slice(0, 8));
  }, [searchQuery, allResources]);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowSearch(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const weeklyData = [
    { day: '周一', hours: 2.5 }, { day: '周二', hours: 3.2 }, { day: '周三', hours: 1.8 },
    { day: '周四', hours: 4.0 }, { day: '周五', hours: 3.5 }, { day: '周六', hours: 5.2 }, { day: '周日', hours: 4.1 },
  ];

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* 欢迎区 + 搜索 — 教育风格清新渐变卡片 */}
        <div className="rounded-2xl p-6 text-white overflow-hidden relative" style={{
          background: 'linear-gradient(135deg, #1565c0 0%, #1976d2 30%, #0288d1 60%, #00897b 100%)',
        }}>
          {/* 装饰层：书本/学业符号 + 光晕 */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
            {/* 主光晕 */}
            <div className="absolute -top-10 -right-10 w-56 h-56 rounded-full opacity-25 animate-pulse"
              style={{ background: 'radial-gradient(circle, #81d4fa 0%, transparent 70%)', animationDuration: '4s' }} />
            <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full opacity-20 animate-pulse"
              style={{ background: 'radial-gradient(circle, #a5d6a7 0%, transparent 70%)', animationDuration: '5s', animationDelay: '1s' }} />
            {/* 几何装饰 — 六边形网格 */}
            <svg className="absolute right-4 top-3 opacity-10" width="120" height="100" viewBox="0 0 120 100">
              {[0,1,2,3,4,5].map(i => {
                const x = 20 + (i % 3) * 38, y = i < 3 ? 15 : 55;
                return <polygon key={i} points={`${x},${y} ${x+16},${y+8} ${x+16},${y+24} ${x},${y+32} ${x-16},${y+24} ${x-16},${y+8}`} fill="none" stroke="white" strokeWidth="1.5" />;
              })}
            </svg>
            {/* 小星点 */}
            {[...Array(5)].map((_, i) => (
              <div key={i} className="absolute rounded-full bg-white/50 animate-ping"
                style={{ width: `${4 + i}px`, height: `${4 + i}px`, top: `${10 + i * 18}%`, right: `${15 + (i % 2) * 8}%`, animationDuration: `${3 + i * 0.6}s`, animationDelay: `${i * 0.4}s` }} />
            ))}
          </div>
          <div className="relative">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">{['🌙','🌅','☀️','🌤️','🌙'][Math.min(4, Math.floor(new Date().getHours() / 5))]}</span>
              <p className="text-white/90 text-sm font-medium">{greeting()}，</p>
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-balance">
              {profile?.username || user?.email?.split('@')[0] || '同学'}
              {!user && '欢迎来到 Kowell AI'}
            </h1>
            {profile && (
              <div className="flex flex-wrap items-center gap-2 mt-2 mb-4">
                <Badge className="bg-white/25 text-white text-xs border-0 backdrop-blur-sm gap-1">
                  <BookOpen className="w-3 h-3" />{profile.major}
                </Badge>
                <Badge className="bg-white/25 text-white text-xs border-0 backdrop-blur-sm gap-1">
                  <GraduationCap className="w-3 h-3" />{profile.education}
                </Badge>
              </div>
            )}
            {/* 全局搜索框 */}
            {user && (
              <div className="relative mt-3" ref={searchRef}>
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/60" />
                <input
                  type="text"
                  placeholder="搜索课程、资源..."
                  className="w-full bg-white/20 text-white placeholder:text-white/60 rounded-xl pl-9 pr-9 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-white/40 border border-white/20"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onFocus={() => searchQuery && setShowSearch(true)}
                />
                {searchQuery && (
                  <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white" onClick={() => { setSearchQuery(''); setShowSearch(false); }}>
                    <X className="w-4 h-4" />
                  </button>
                )}
                <AnimatePresence>
                  {showSearch && searchResults.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      className="absolute top-full mt-2 left-0 right-0 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden"
                    >
                      {searchResults.map(r => (
                        <button
                          key={r.id}
                          type="button"
                          className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-muted text-left transition-colors"
                          onClick={() => { navigate(`/resources/${r.id}`); setShowSearch(false); setSearchQuery(''); }}
                        >
                          <span className={`rounded p-1 ${resourceTypeColors[r.resource_type] || 'bg-muted text-muted-foreground'}`}>
                            {resourceTypeIcons[r.resource_type]}
                          </span>
                          <span className="text-sm text-foreground truncate">{r.title}</span>
                          <Badge variant="secondary" className="ml-auto text-xs shrink-0">{RESOURCE_TYPE_LABELS[r.resource_type]}</Badge>
                        </button>
                      ))}
                    </motion.div>
                  )}
                  {showSearch && searchQuery && searchResults.length === 0 && (
                    <motion.div
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="absolute top-full mt-2 left-0 right-0 bg-card border border-border rounded-xl shadow-xl z-50 px-4 py-3 text-sm text-muted-foreground"
                    >
                      未找到相关资源
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
            {!user && (
              <div className="mt-3 flex gap-2">
                <Button asChild size="sm" variant="secondary"><Link to="/login">登录</Link></Button>
                <Button asChild size="sm" className="bg-white/20 text-white border-0 hover:bg-white/30"><Link to="/login">注册</Link></Button>
              </div>
            )}
          </div>
        </div>

        {/* 统计卡片 + 学习时长图表 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: '总资源', value: stats.total, icon: BookOpen, color: 'text-primary' },
              { label: '已学习', value: stats.completed, icon: TrendingUp, color: 'text-green-500' },
              { label: '待学习', value: stats.unread, icon: Clock, color: 'text-amber-500' },
              { label: '学习天数', value: user ? 7 : 0, icon: Zap, color: 'text-violet-500' },
            ].map((s, i) => (
              <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
                <Card className="h-full">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className={`rounded-lg p-2 bg-muted ${s.color}`}><s.icon className="w-4 h-4" /></div>
                    <div className="min-w-0">
                      <p className="text-2xl font-bold">{s.value}</p>
                      <p className="text-xs text-muted-foreground">{s.label}</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
          <Card className="lg:col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs flex items-center gap-1.5 text-muted-foreground font-normal">
                <Activity className="w-3.5 h-3.5" />本周学习时长
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="w-full min-w-0 overflow-hidden">
                <ResponsiveContainer width="100%" height={100}>
                  <AreaChart data={weeklyData}>
                    <defs>
                      <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Tooltip contentStyle={{ borderRadius: '6px', border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', fontSize: '12px' }} formatter={(v: number) => [`${v} 小时`, '时长']} />
                    <Area type="monotone" dataKey="hours" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorHours)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 快捷操作 */}
        <div>
          <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
            <PlayCircle className="w-4 h-4 text-primary" />
            快捷操作
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
            {quickActions.map((action, i) => (
              <motion.div key={action.href} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.04 }}>
                <Link to={action.href}>
                  <Card className="h-full hover:shadow-hover transition-all duration-200 hover:-translate-y-0.5 cursor-pointer">
                    <CardContent className="p-3 flex flex-col gap-2">
                      <div className={`rounded-lg p-2 w-fit ${action.color}`}><action.icon className="w-4 h-4" /></div>
                      <div>
                        <p className="font-medium text-xs">{action.label}</p>
                        <p className="text-[10px] text-muted-foreground text-pretty leading-tight mt-0.5">{action.desc}</p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>

        {/* 打卡 + 数据报告 */}
        {user && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <CheckInWidget />
            <Link to="/report">
              <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:border-primary/30 hover:bg-primary/5 transition-all cursor-pointer h-full">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <BarChart3 className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">数据报告</p>
                  <p className="text-xs text-muted-foreground mt-0.5">查看本周学习数据</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </div>
            </Link>
          </div>
        )}

        {/* 画像引导 */}
        {user && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="rounded-lg p-2 bg-primary/10 text-primary shrink-0"><Brain className="w-5 h-5" /></div>
                <div className="min-w-0">
                  <p className="font-medium text-sm text-balance">构建学习画像</p>
                  <p className="text-xs text-muted-foreground text-pretty">通过对话了解你的学习特征，获得个性化推荐</p>
                </div>
              </div>
              <Button asChild size="sm" className="shrink-0"><Link to="/portrait">开始构建</Link></Button>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
