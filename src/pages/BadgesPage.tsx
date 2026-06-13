import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';
import AppLayout from '@/components/layouts/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Lock, Star, Sparkles } from 'lucide-react';

interface BadgeDef {
  id: string;
  key: string;
  name: string;
  description: string;
  icon: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  condition_type: string;
  condition_value: number;
}

interface UserBadgeRow {
  badge_id: string;
  unlocked_at: string;
}

const rarityConfig = {
  common:    { label: '普通',   glow: 'shadow-gray-200 dark:shadow-gray-700',  border: 'border-gray-200 dark:border-gray-700', badge: 'bg-muted text-muted-foreground',                   star: 1 },
  rare:      { label: '稀有',   glow: 'shadow-blue-200 dark:shadow-blue-900',  border: 'border-blue-200 dark:border-blue-700', badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',     star: 2 },
  epic:      { label: '史诗',   glow: 'shadow-violet-300 dark:shadow-violet-900', border: 'border-violet-300 dark:border-violet-700', badge: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300', star: 3 },
  legendary: { label: '传说',   glow: 'shadow-amber-300 dark:shadow-amber-800', border: 'border-amber-300 dark:border-amber-700', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300', star: 4 },
};

export default function BadgesPage() {
  const { user } = useAuth();
  const [allBadges, setAllBadges] = useState<BadgeDef[]>([]);
  const [userBadges, setUserBadges] = useState<UserBadgeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unlocked' | 'locked'>('all');
  const [highlighted, setHighlighted] = useState<string | null>(null);

  useEffect(() => { if (user) load(); }, [user]);

  const load = async () => {
    setLoading(true);
    const [{ data: bData }, { data: ubData }] = await Promise.all([
      supabase.from('badges').select('*').order('rarity'),
      supabase.from('user_badges').select('badge_id, unlocked_at').eq('user_id', user!.id),
    ]);
    setAllBadges(Array.isArray(bData) ? bData : []);
    setUserBadges(Array.isArray(ubData) ? ubData : []);
    setLoading(false);
  };

  const unlockedIds = new Set(userBadges.map(u => u.badge_id));
  const unlockedCount = unlockedIds.size;

  const displayed = allBadges.filter(b => {
    if (filter === 'unlocked') return unlockedIds.has(b.id);
    if (filter === 'locked') return !unlockedIds.has(b.id);
    return true;
  });

  const groupedByRarity = (['legendary', 'epic', 'rare', 'common'] as const).map(r => ({
    rarity: r,
    items: displayed.filter(b => b.rarity === r),
  })).filter(g => g.items.length > 0);

  return (
    <AppLayout>
      <div className="space-y-5">
        {/* 标题 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" />成就徽章
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              已解锁 <span className="font-semibold text-foreground">{unlockedCount}</span> / {allBadges.length} 枚徽章
            </p>
          </div>
        </div>

        {/* 进度概览 */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span className="text-sm font-medium">解锁进度</span>
              </div>
              <span className="text-sm font-bold text-primary">{unlockedCount}/{allBadges.length}</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2.5">
              <motion.div
                className="bg-amber-500 h-2.5 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: allBadges.length ? `${Math.round(unlockedCount / allBadges.length * 100)}%` : '0%' }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </div>
            <div className="flex gap-4 mt-3">
              {(['legendary', 'epic', 'rare', 'common'] as const).map(r => {
                const cnt = allBadges.filter(b => b.rarity === r).length;
                const un = allBadges.filter(b => b.rarity === r && unlockedIds.has(b.id)).length;
                const rc = rarityConfig[r];
                return (
                  <div key={r} className="flex items-center gap-1.5">
                    <Badge className={`text-[10px] px-2 ${rc.badge}`}>{rc.label}</Badge>
                    <span className="text-xs text-muted-foreground">{un}/{cnt}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* 过滤 */}
        <div className="flex gap-2">
          {(['all', 'unlocked', 'locked'] as const).map(f => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                filter === f ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'
              }`}
            >
              {{ all: '全部', unlocked: '已解锁', locked: '未解锁' }[f]}
            </button>
          ))}
        </div>

        {/* 按稀有度分组展示 */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-36 bg-muted rounded-xl" />)}
          </div>
        ) : (
          <div className="space-y-6">
            {groupedByRarity.map(({ rarity, items }) => {
              const rc = rarityConfig[rarity];
              return (
                <div key={rarity}>
                  <div className="flex items-center gap-2 mb-3">
                    <Badge className={`${rc.badge} text-xs`}>{rc.label}</Badge>
                    <div className="flex">
                      {Array.from({ length: rc.star }).map((_, i) => (
                        <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />
                      ))}
                    </div>
                    <span className="text-xs text-muted-foreground">({items.filter(b => unlockedIds.has(b.id)).length}/{items.length})</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    <AnimatePresence>
                      {items.map((badge, i) => {
                        const isUnlocked = unlockedIds.has(badge.id);
                        const ub = userBadges.find(u => u.badge_id === badge.id);
                        return (
                          <motion.div
                            key={badge.id}
                            initial={{ opacity: 0, scale: 0.85 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: i * 0.04 }}
                            onClick={() => setHighlighted(highlighted === badge.id ? null : badge.id)}
                          >
                            <Card
                              className={`cursor-pointer transition-all duration-200 border-2 h-full ${
                                isUnlocked
                                  ? `${rc.border} shadow-md ${rc.glow} hover:scale-105`
                                  : 'border-border opacity-50 hover:opacity-70'
                              } ${highlighted === badge.id ? 'ring-2 ring-primary' : ''}`}
                            >
                              <CardContent className="p-3 flex flex-col items-center text-center">
                                <motion.div
                                  className={`text-3xl my-1.5 ${!isUnlocked ? 'grayscale' : ''}`}
                                  animate={isUnlocked && highlighted === badge.id ? { rotate: [0, -10, 10, 0], scale: [1, 1.2, 1] } : {}}
                                  transition={{ duration: 0.4 }}
                                >
                                  {isUnlocked ? badge.icon : <Lock className="w-7 h-7 text-muted-foreground/40 mx-auto" />}
                                </motion.div>
                                <p className="text-xs font-semibold leading-tight text-balance">{badge.name}</p>
                                {isUnlocked && ub && (
                                  <p className="text-[10px] text-muted-foreground mt-1">
                                    {new Date(ub.unlocked_at).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                                  </p>
                                )}
                              </CardContent>
                            </Card>
                            {/* 展开说明 */}
                            <AnimatePresence>
                              {highlighted === badge.id && (
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  exit={{ opacity: 0, height: 0 }}
                                  className="overflow-hidden"
                                >
                                  <div className="mt-1.5 p-2.5 bg-muted rounded-lg text-center">
                                    <p className="text-xs text-muted-foreground text-pretty">{badge.description}</p>
                                    {!isUnlocked && (
                                      <p className="text-[10px] text-primary mt-1">完成条件：{badge.description}</p>
                                    )}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                </div>
              );
            })}
            {displayed.length === 0 && (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  <Trophy className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p className="text-sm">暂无数据</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
