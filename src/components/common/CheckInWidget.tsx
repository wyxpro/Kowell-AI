import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';
import { useAppStore } from '@/store/useAppStore';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { Flame, CheckCircle2 } from 'lucide-react';

export default function CheckInWidget() {
  const { user } = useAuth();
  const { todayCheckedIn, setTodayCheckedIn, streakDays, setStreakDays } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [exploding, setExploding] = useState(false);

  useEffect(() => {
    if (user && !fetched) loadCheckin();
  }, [user, fetched]);

  const loadCheckin = async () => {
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('user_check_ins')
      .select('check_date')
      .eq('user_id', user!.id)
      .order('check_date', { ascending: false })
      .limit(60);
    const rows: { check_date: string }[] = Array.isArray(data) ? data : [];
    const dates = rows.map(r => r.check_date);
    setTodayCheckedIn(dates.includes(today));

    // 计算连续天数
    let streak = 0;
    const cur = new Date();
    while (true) {
      const d = cur.toISOString().split('T')[0];
      if (!dates.includes(d)) break;
      streak++;
      cur.setDate(cur.getDate() - 1);
    }
    setStreakDays(streak);
    setFetched(true);
  };

  const checkIn = async () => {
    if (todayCheckedIn || loading) return;
    setLoading(true);
    const today = new Date().toISOString().split('T')[0];
    const { error } = await supabase
      .from('user_check_ins')
      .upsert({ user_id: user!.id, check_date: today, study_minutes: 0 });
    setLoading(false);
    if (error) { toast.error('打卡失败，请重试'); return; }
    setTodayCheckedIn(true);
    const newStreak = streakDays + 1;
    setStreakDays(newStreak);
    setExploding(true);
    setTimeout(() => setExploding(false), 1500);
    toast.success(`🔥 连续打卡 ${newStreak} 天！坚持就是胜利！`);
  };

  if (!user) return null;

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card">
      <div className="relative">
        <motion.div
          animate={exploding ? { scale: [1, 1.3, 1] } : {}}
          transition={{ duration: 0.4 }}
          className={`w-9 h-9 rounded-xl flex items-center justify-center ${
            todayCheckedIn ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-muted text-muted-foreground'
          }`}
        >
          <Flame className="w-5 h-5" />
        </motion.div>
        <AnimatePresence>
          {exploding && (
            <motion.div
              initial={{ opacity: 1, scale: 0.8, y: 0 }}
              animate={{ opacity: 0, scale: 1.5, y: -20 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
            >
              <span className="text-lg">🎉</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold">连续打卡</span>
          <span className="text-sm font-bold text-amber-500">{streakDays}</span>
          <span className="text-sm text-muted-foreground">天</span>
        </div>
        <p className="text-[11px] text-muted-foreground">
          {todayCheckedIn ? '今日已打卡 ✓' : '今日还未打卡'}
        </p>
      </div>
      {todayCheckedIn ? (
        <div className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 shrink-0">
          <CheckCircle2 className="w-4 h-4" />
          <span>已打卡</span>
        </div>
      ) : (
        <Button size="sm" variant="default" onClick={checkIn} disabled={loading} className="shrink-0 text-xs h-7 px-3">
          {loading ? '打卡中...' : '立即打卡'}
        </Button>
      )}
    </div>
  );
}
