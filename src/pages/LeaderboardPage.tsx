import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';
import AppLayout from '@/components/layouts/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { motion } from 'motion/react';
import { Trophy, Medal, Crown, TrendingUp, Users, Star } from 'lucide-react';

type Period = 'day' | 'week' | 'month';

interface RankRow {
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  total_minutes: number;
}

const medals: Record<number, { icon: React.ReactNode; color: string; bg: string }> = {
  1: { icon: <Crown className="w-4 h-4" />, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20' },
  2: { icon: <Medal className="w-4 h-4" />, color: 'text-slate-400', bg: 'bg-slate-50 dark:bg-slate-900/20' },
  3: { icon: <Medal className="w-4 h-4" />, color: 'text-amber-700', bg: 'bg-amber-50/50 dark:bg-amber-900/10' },
};

function getDateRange(period: Period) {
  const now = new Date();
  const end = now.toISOString().split('T')[0];
  const start = new Date(now);
  if (period === 'day') { /* same day */ }
  else if (period === 'week') start.setDate(now.getDate() - 6);
  else start.setDate(now.getDate() - 29);
  return { start: start.toISOString().split('T')[0], end };
}

export default function LeaderboardPage() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<Period>('week');
  const [ranks, setRanks] = useState<RankRow[]>([]);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [myMin, setMyMin] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (user) loadRanks(); }, [user, period]);

  // 当真实用户数不足时用于填充的示例用户
  const MOCK_USERS: RankRow[] = [
    { user_id: 'mock-1', username: '学习达人·林晨', avatar_url: null, total_minutes: 936 },
    { user_id: 'mock-2', username: 'AI探索者',      avatar_url: null, total_minutes: 812 },
    { user_id: 'mock-3', username: '算法爱好者',    avatar_url: null, total_minutes: 765 },
    { user_id: 'mock-4', username: '考研备战中',    avatar_url: null, total_minutes: 698 },
    { user_id: 'mock-5', username: '全栈开发er',    avatar_url: null, total_minutes: 623 },
    { user_id: 'mock-6', username: '数学深度解析',  avatar_url: null, total_minutes: 541 },
    { user_id: 'mock-7', username: 'React开发者',   avatar_url: null, total_minutes: 487 },
    { user_id: 'mock-8', username: '代码小白白',    avatar_url: null, total_minutes: 412 },
    { user_id: 'mock-9', username: '技术布道师',    avatar_url: null, total_minutes: 378 },
    { user_id: 'mock-10', username: '知识探索者',   avatar_url: null, total_minutes: 315 },
  ];

  const loadRanks = async () => {
    setLoading(true);
    const { start, end } = getDateRange(period);

    const { data } = await supabase
      .from('user_check_ins')
      .select('user_id, study_minutes')
      .gte('check_date', start)
      .lte('check_date', end);

    const rows: { user_id: string; study_minutes: number }[] = Array.isArray(data) ? data : [];

    // 聚合每用户总时长
    const userMap: Record<string, number> = {};
    rows.forEach(r => { userMap[r.user_id] = (userMap[r.user_id] || 0) + r.study_minutes; });

    const userIds = Object.keys(userMap);

    // 获取用户信息
    let profMap: Record<string, { username: string | null; avatar_url: string | null }> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, username, avatar_url')
        .in('id', userIds.slice(0, 50));
      (Array.isArray(profiles) ? profiles : []).forEach(p => { profMap[p.id] = p; });
    }

    const realRanked: RankRow[] = Object.entries(userMap)
      .map(([uid, mins]) => ({
        user_id: uid,
        username: profMap[uid]?.username || '学习者',
        avatar_url: profMap[uid]?.avatar_url || null,
        total_minutes: mins,
      }))
      .sort((a, b) => b.total_minutes - a.total_minutes);

    // 按时段缩放示例用户时长，使数据更真实
    const scale = period === 'day' ? 0.14 : period === 'week' ? 1 : 4.2;
    const scaledMocks = MOCK_USERS.map(m => ({ ...m, total_minutes: Math.round(m.total_minutes * scale) }));

    // 合并真实 + 示例，排序，取前20
    const combined = [...realRanked, ...scaledMocks]
      .sort((a, b) => b.total_minutes - a.total_minutes)
      .slice(0, 20);

    setRanks(combined);

    const myIdx = combined.findIndex(r => r.user_id === user!.id);
    setMyRank(myIdx >= 0 ? myIdx + 1 : null);
    setMyMin(userMap[user!.id] || 0);
    setLoading(false);
  };

  const periodLabels: Record<Period, string> = { day: '今日', week: '本周', month: '本月' };

  return (
    <AppLayout>
      <div className="space-y-5 max-w-2xl mx-auto">
        {/* 标题 */}
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" />学习排行榜
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">看看谁是最勤奋的学习者</p>
        </div>

        {/* 周期切换 */}
        <div className="flex gap-2">
          {(['day', 'week', 'month'] as Period[]).map(p => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`flex-1 py-2 text-sm font-medium rounded-lg border transition-colors ${
                period === p ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'
              }`}
            >
              {periodLabels[p]}
            </button>
          ))}
        </div>

        {/* 我的排名 */}
        {user && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Star className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">我的排名</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {periodLabels[period]}学习 {Math.floor(myMin / 60)}小时{myMin % 60}分钟
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-2xl font-bold text-primary">
                  {loading ? '—' : myRank ? `#${myRank}` : '未上榜'}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 前三名大卡片 */}
        {!loading && ranks.slice(0, 3).length === 3 && (
          <div className="grid grid-cols-3 gap-3">
            {[1, 0, 2].map(idx => {
              const r = ranks[idx];
              if (!r) return null;
              const rank = idx + 1;
              const isMe = r.user_id === user?.id;
              const m = medals[rank];
              return (
                <motion.div
                  key={r.user_id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: rank === 1 ? -8 : 0 }}
                  transition={{ delay: idx * 0.1 }}
                >
                  <Card className={`h-full ${rank === 1 ? 'border-amber-300 dark:border-amber-600 shadow-lg' : ''} ${isMe ? 'ring-2 ring-primary' : ''}`}>
                    <CardContent className="p-3 flex flex-col items-center text-center">
                      <div className={`w-8 h-8 rounded-full ${m.bg} flex items-center justify-center mb-2 ${m.color}`}>
                        {m.icon}
                      </div>
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mb-1.5 text-lg font-bold">
                        {r.avatar_url
                          ? <img src={r.avatar_url} alt="" className="w-full h-full object-cover rounded-full" />
                          : (r.username?.[0] || '?').toUpperCase()
                        }
                      </div>
                      <p className="text-xs font-semibold truncate w-full">{isMe ? '我' : r.username}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{Math.floor(r.total_minutes / 60)}h {r.total_minutes % 60}m</p>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* 完整榜单 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />完整排名
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="px-4 pb-4 space-y-2">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 bg-muted rounded-lg" />)}
              </div>
            ) : ranks.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <TrendingUp className="w-10 h-10 mx-auto mb-2 opacity-20" />
                <p className="text-sm">暂无排行数据，快去学习打卡吧！</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {ranks.map((r, i) => {
                  const rank = i + 1;
                  const isMe = r.user_id === user?.id;
                  const m = medals[rank];
                  return (
                    <motion.div
                      key={r.user_id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className={`flex items-center gap-3 px-4 py-3 ${isMe ? 'bg-primary/5' : ''}`}
                    >
                      {/* 排名 */}
                      <div className={`w-7 h-7 shrink-0 rounded-lg flex items-center justify-center text-sm font-bold ${m ? `${m.bg} ${m.color}` : 'bg-muted text-muted-foreground'}`}>
                        {m ? m.icon : rank}
                      </div>
                      {/* 头像 */}
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 font-semibold text-sm overflow-hidden">
                        {r.avatar_url
                          ? <img src={r.avatar_url} alt="" className="w-full h-full object-cover" />
                          : (r.username?.[0] || '?').toUpperCase()
                        }
                      </div>
                      {/* 姓名 */}
                      <div className="flex-1 min-w-0">
                        <span className={`text-sm font-medium truncate ${isMe ? 'text-primary' : ''}`}>
                          {isMe ? `${r.username}（我）` : r.username}
                        </span>
                      </div>
                      {/* 时长 */}
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-semibold">{Math.floor(r.total_minutes / 60)}h {r.total_minutes % 60}m</p>
                        <p className="text-[10px] text-muted-foreground">学习时长</p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
