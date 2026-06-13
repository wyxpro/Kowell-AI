import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';
import AppLayout from '@/components/layouts/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import {
  Gift, Copy, Users, Coins, Crown, Check, Sparkles,
  ArrowUpRight, ArrowDownRight, Link2, Share2,
  Star, Zap, Infinity as InfinityIcon, Shield,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

// ─── 类型 ─────────────────────────────────────────────────────
interface Plan {
  id: string;
  name: string;
  price_month: number;
  price_year: number;
  features: string[];
  sort_order: number;
}

interface PointTransaction {
  id: string;
  delta: number;
  action: string;
  note: string | null;
  created_at: string;
}

interface InviteRecord {
  id: string;
  invitee_id: string;
  created_at: string;
}

// ─── 套餐图标 & 样式映射 ──────────────────────────────────────
const PLAN_META: Record<string, { icon: React.ElementType; gradient: string; badge: string; textGradient: string }> = {
  free:       { icon: Star,     gradient: 'from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900',       badge: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',    textGradient: 'from-slate-500 to-slate-600' },
  basic:      { icon: Zap,      gradient: 'from-sky-50 to-blue-50 dark:from-sky-950 dark:to-blue-950',              badge: 'bg-sky-100 text-sky-700 dark:bg-sky-900/60 dark:text-sky-300',          textGradient: 'from-sky-500 to-blue-600'    },
  pro:        { icon: Sparkles, gradient: 'from-violet-50 to-purple-50 dark:from-violet-950 dark:to-purple-950',    badge: 'bg-violet-100 text-violet-700 dark:bg-violet-900/60 dark:text-violet-300', textGradient: 'from-violet-500 to-purple-600' },
  enterprise: { icon: InfinityIcon, gradient: 'from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-950',     badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300',    textGradient: 'from-amber-500 to-orange-500' },
};

const ACTION_LABELS: Record<string, string> = {
  invite_friend:  '邀请好友',
  task_complete:  '完成任务',
  sign_in:        '每日签到',
  redeem_plan:    '兑换套餐',
  admin_adjust:   '管理员调整',
  other:          '其他',
};

export default function InvitePage() {
  const { user, profile } = useAuth();
  const [searchParams] = useSearchParams();

  const [activeTab, setActiveTab] = useState(() => searchParams.get('tab') === 'plans' ? 'plans' : 'invite');
  const [inviteCode, setInviteCode] = useState('');
  const [inviteRecords, setInviteRecords] = useState<InviteRecord[]>([]);
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<PointTransaction[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [currentPlanId, setCurrentPlanId] = useState('free');
  const [loading, setLoading] = useState(true);

  // ─── 加载数据 ──────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      // 邀请码
      const { data: codeData } = await supabase
        .rpc('get_or_create_invite_code', { p_user_id: user.id });
      if (codeData) setInviteCode(codeData as string);

      // 邀请记录
      const { data: records } = await supabase
        .from('invite_records')
        .select('id, invitee_id, created_at')
        .eq('inviter_id', user.id)
        .order('created_at', { ascending: false });
      setInviteRecords(Array.isArray(records) ? records : []);

      // 积分账户
      const { data: acct } = await supabase
        .from('point_accounts')
        .select('balance')
        .eq('user_id', user.id)
        .maybeSingle();
      setBalance(acct?.balance ?? 0);

      // 积分流水
      const { data: txs } = await supabase
        .from('point_transactions')
        .select('id, delta, action, note, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      setTransactions(Array.isArray(txs) ? txs : []);

      // 套餐列表
      const { data: planList } = await supabase
        .from('plans')
        .select('*')
        .order('sort_order');
      setPlans(Array.isArray(planList) ? planList : []);

      // 当前套餐
      const { data: sub } = await supabase
        .from('user_subscriptions')
        .select('plan_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();
      setCurrentPlanId(sub?.plan_id ?? 'free');
    } catch (err) {
      console.error('加载邀请页面数据失败:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── 复制邀请码 ───────────────────────────────────────────
  const copyCode = () => {
    navigator.clipboard.writeText(inviteCode);
    toast.success('邀请码已复制！');
  };

  const copyLink = () => {
    const link = `${window.location.origin}/register?invite=${inviteCode}`;
    navigator.clipboard.writeText(link);
    toast.success('邀请链接已复制！');
  };

  const shareLink = () => {
    const link = `${window.location.origin}/register?invite=${inviteCode}`;
    const text = `我在智学伴学习AI/计算机课程，效果很棒！用我的邀请码 ${inviteCode} 注册，我们各得积分奖励 🎁`;
    if (navigator.share) {
      navigator.share({ title: '智学伴邀请', text, url: link }).catch(() => {});
    } else {
      navigator.clipboard.writeText(`${text}\n${link}`);
      toast.success('分享内容已复制！');
    }
  };

  // ─── 升级套餐（演示） ────────────────────────────────────
  const handleUpgrade = (planId: string) => {
    if (planId === currentPlanId) return;
    toast.info(`即将跳转至 ${plans.find(p => p.id === planId)?.name} 支付页面`);
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-5xl">
        {/* 页面标题 */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-sm">
            <Gift className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-balance">邀请有礼 · 积分与套餐</h1>
            <p className="text-sm text-muted-foreground">邀请好友赚积分，解锁更多学习特权</p>
          </div>
        </div>

        {/* 顶部数据看板 */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { label: '我的积分', value: balance, icon: Coins, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/30' },
            { label: '邀请好友', value: inviteRecords.length, icon: Users, color: 'text-sky-500', bg: 'bg-sky-50 dark:bg-sky-900/30' },
            { label: '当前套餐', value: plans.find(p => p.id === currentPlanId)?.name ?? '免费版', icon: Crown, color: 'text-violet-500', bg: 'bg-violet-50 dark:bg-violet-900/30' },
          ].map((stat, i) => (
            <motion.div key={stat.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
              <Card className="h-full">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={`rounded-lg p-2.5 ${stat.bg} ${stat.color} shrink-0`}>
                    <stat.icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-lg font-bold truncate">{stat.value}</p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* 主体 Tab */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full md:w-auto">
            <TabsTrigger value="invite" className="flex-1 md:flex-none gap-1.5">
              <Gift className="w-3.5 h-3.5" />邀请好友
            </TabsTrigger>
            <TabsTrigger value="points" className="flex-1 md:flex-none gap-1.5">
              <Coins className="w-3.5 h-3.5" />积分记录
            </TabsTrigger>
            <TabsTrigger value="plans" className="flex-1 md:flex-none gap-1.5">
              <Crown className="w-3.5 h-3.5" />升级套餐
            </TabsTrigger>
          </TabsList>

          {/* ─── Tab: 邀请好友 ─────────────────────────────── */}
          <TabsContent value="invite" className="mt-4 space-y-4">
            {/* 邀请规则 banner */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-400 via-orange-400 to-rose-400 p-5 text-white shadow-md">
              <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/10" />
              <div className="absolute -right-2 bottom-0 w-20 h-20 rounded-full bg-white/10" />
              <div className="relative">
                <p className="text-sm font-semibold opacity-90 mb-1">🎁 邀请奖励规则</p>
                <p className="text-2xl font-bold mb-0.5">每成功邀请 1 位好友</p>
                <p className="text-3xl font-black">+50 积分</p>
                <p className="text-xs opacity-75 mt-2">好友注册后立即到账 · 积分可兑换套餐权益</p>
              </div>
            </div>

            {/* 邀请码 & 操作 */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-primary" />
                  我的专属邀请码
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0 bg-muted rounded-xl px-4 py-3 font-mono text-xl font-bold tracking-[0.25em] text-center select-all">
                    {loading ? '加载中…' : (inviteCode || '——')}
                  </div>
                  <Button size="icon" variant="outline" className="shrink-0 h-12 w-12" onClick={copyCode} disabled={!inviteCode}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" className="gap-1.5" onClick={copyLink} disabled={!inviteCode}>
                    <Copy className="w-3.5 h-3.5" />复制邀请链接
                  </Button>
                  <Button className="gap-1.5 bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-white border-0" onClick={shareLink} disabled={!inviteCode}>
                    <Share2 className="w-3.5 h-3.5" />分享给好友
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  好友通过你的链接注册，双方各得 <span className="text-amber-500 font-semibold">50 积分</span>
                </p>
              </CardContent>
            </Card>

            {/* 邀请记录 */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  邀请记录
                  {inviteRecords.length > 0 && (
                    <Badge variant="secondary" className="ml-auto text-xs">{inviteRecords.length} 位好友</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {inviteRecords.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">还没有邀请记录，快去分享吧！</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {inviteRecords.map((rec, i) => (
                      <div key={rec.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-muted/50">
                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-xs font-bold text-primary">
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">好友 {rec.invitee_id.slice(0, 8).toUpperCase()}</p>
                          <p className="text-xs text-muted-foreground">{new Date(rec.created_at).toLocaleDateString('zh-CN')}</p>
                        </div>
                        <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300 border-0 text-xs shrink-0">
                          +50 积分
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── Tab: 积分记录 ─────────────────────────────── */}
          <TabsContent value="points" className="mt-4 space-y-4">
            {/* 积分余额卡 */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 p-5 text-white shadow-md">
              <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full bg-white/10" />
              <p className="text-sm font-medium opacity-90 mb-1 relative">当前积分余额</p>
              <p className="text-5xl font-black relative">{balance}</p>
              <p className="text-xs opacity-75 mt-1 relative">积分可兑换套餐 · 越多越划算</p>
            </div>

            {/* 积分获取方式 */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground font-medium">积分获取方式</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {[
                    { label: '邀请好友', pts: '+50', icon: '🎁' },
                    { label: '每日签到', pts: '+5',  icon: '📅' },
                    { label: '完成任务', pts: '+10', icon: '✅' },
                    { label: '参与活动', pts: '不定', icon: '🎉' },
                  ].map(item => (
                    <div key={item.label} className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-muted/50 text-center">
                      <span className="text-xl">{item.icon}</span>
                      <p className="text-xs font-medium">{item.label}</p>
                      <p className="text-sm font-bold text-primary">{item.pts}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* 积分流水 */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Coins className="w-4 h-4 text-primary" />
                  积分流水明细
                </CardTitle>
              </CardHeader>
              <CardContent>
                {transactions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Coins className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">暂无积分记录，邀请好友或完成任务开始积累吧！</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {transactions.map(tx => (
                      <div key={tx.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${tx.delta > 0 ? 'bg-emerald-100 dark:bg-emerald-900/40' : 'bg-rose-100 dark:bg-rose-900/40'}`}>
                          {tx.delta > 0
                            ? <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            : <ArrowDownRight className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{ACTION_LABELS[tx.action] ?? tx.action}</p>
                          {tx.note && <p className="text-xs text-muted-foreground truncate">{tx.note}</p>}
                          <p className="text-xs text-muted-foreground">{new Date(tx.created_at).toLocaleString('zh-CN')}</p>
                        </div>
                        <span className={`text-sm font-bold shrink-0 ${tx.delta > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                          {tx.delta > 0 ? `+${tx.delta}` : tx.delta}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── Tab: 升级套餐 ─────────────────────────────── */}
          <TabsContent value="plans" className="mt-4">
            {/* 套餐页头部 banner */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-500 via-purple-500 to-indigo-600 p-6 text-white shadow-lg mb-5">
              <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-white/10 pointer-events-none" />
              <div className="absolute right-4 bottom-0 w-24 h-24 rounded-full bg-white/5 pointer-events-none" />
              <div className="relative">
                <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-full px-3 py-1 text-xs font-medium mb-3">
                  <Crown className="w-3.5 h-3.5" />解锁更多学习特权
                </div>
                <h2 className="text-2xl font-bold mb-1 text-balance">选择最适合你的套餐</h2>
                <p className="text-white/75 text-sm">年付更优惠 · 随时可取消 · 7天无理由退款</p>
              </div>
            </div>

            {/* 4 卡片一行 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {(plans.length > 0 ? plans : [
                { id: 'free',       name: '免费版', price_month: 0,   price_year: 0,    features: ['10次/月资源生成', '基础学习路径', '社区支持'], sort_order: 1 },
                { id: 'basic',      name: '基础版', price_month: 19,  price_year: 168,  features: ['50次/月资源生成', '个性化路径', '答疑中心', '工单支持'], sort_order: 2 },
                { id: 'pro',        name: '高级版', price_month: 49,  price_year: 428,  features: ['200次/月资源生成', '高级AI路径', 'AI深度答疑', '全部工具', '优先支持'], sort_order: 3 },
                { id: 'enterprise', name: '专业版', price_month: 99,  price_year: 828,  features: ['无限资源生成', '专属顾问', '优先答疑', '全部工具', '团队协作', '数据导出', '专属客服'], sort_order: 4 },
              ] as Plan[]).map((plan, i) => {
                const meta = PLAN_META[plan.id] ?? PLAN_META.free;
                const isCurrent = plan.id === currentPlanId;
                const PlanIcon = meta.icon;

                return (
                  <motion.div
                    key={plan.id}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.07 }}
                    className="h-full"
                  >
                    <Card className={`h-full flex flex-col relative overflow-hidden transition-all duration-200 ${
                      isCurrent
                        ? 'ring-2 ring-primary shadow-lg shadow-primary/10'
                        : plan.id === 'enterprise'
                          ? 'ring-1 ring-amber-300/50 hover:shadow-lg hover:shadow-amber-100/50 hover:-translate-y-1'
                          : 'hover:shadow-md hover:-translate-y-0.5'
                    }`}>
                      {/* 当前套餐标记 */}
                      {isCurrent && (
                        <div className="absolute top-3 right-3 z-10">
                          <Badge className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5">当前</Badge>
                        </div>
                      )}
                      {/* 推荐标记 */}
                      {plan.id === 'pro' && !isCurrent && (
                        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-violet-500 to-purple-500" />
                      )}

                      {/* 套餐头部 */}
                      <div className={`p-4 bg-gradient-to-br ${meta.gradient}`}>
                        <div className={`w-9 h-9 rounded-xl ${meta.badge} flex items-center justify-center mb-2.5`}>
                          <PlanIcon className="w-4.5 h-4.5" />
                        </div>
                        <p className="font-bold text-sm mb-1.5">{plan.name}</p>
                        {plan.price_month === 0 ? (
                          <p className="text-xl font-black">免费</p>
                        ) : (
                          <div>
                            <p className="text-xl font-black">
                              ¥{plan.price_month}
                              <span className="text-xs font-normal text-muted-foreground"> /月</span>
                            </p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">年付 ¥{plan.price_year}</p>
                          </div>
                        )}
                      </div>

                      <Separator />

                      {/* 功能列表 */}
                      <CardContent className="flex-1 p-3 space-y-1.5">
                        {plan.features.map((feat, fi) => (
                          <div key={fi} className="flex items-start gap-1.5 text-xs">
                            <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                            <span className="text-muted-foreground leading-snug">{feat}</span>
                          </div>
                        ))}
                      </CardContent>

                      {/* 操作按钮 */}
                      <div className="p-3 pt-0">
                        {isCurrent ? (
                          <Button variant="outline" size="sm" className="w-full h-8 text-xs" onClick={() => {}} disabled>
                            <Check className="w-3 h-3 mr-1" />使用中
                          </Button>
                        ) : plan.price_month === 0 ? (
                          <Button variant="outline" size="sm" className="w-full h-8 text-xs" onClick={() => {}} disabled>免费使用</Button>
                        ) : (
                          <Button
                            size="sm"
                            className={`w-full h-8 text-xs bg-gradient-to-r border-0 text-white ${
                              plan.id === 'enterprise'
                                ? 'from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600'
                                : plan.id === 'pro'
                                  ? 'from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700'
                                  : 'from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700'
                            }`}
                            onClick={() => handleUpgrade(plan.id)}
                          >
                            <Shield className="w-3 h-3 mr-1" />立即升级
                          </Button>
                        )}
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </div>

            {/* 功能对比表 */}
            {plans.length > 0 && (
              <Card className="mt-5">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />功能详细对比
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left px-4 py-3 font-medium text-muted-foreground w-32 whitespace-nowrap">功能</th>
                          {plans.map(p => (
                            <th key={p.id} className="px-3 py-3 text-center font-semibold whitespace-nowrap">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${PLAN_META[p.id]?.badge ?? ''}`}>
                                {p.name}
                              </span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { label: '资源生成', values: ['10次/月', '50次/月', '200次/月', '无限次'] },
                          { label: '学习路径', values: ['基础', '个性化', '高级AI', '专属顾问'] },
                          { label: '答疑中心', values: ['×', '✓', 'AI深度', '优先'] },
                          { label: '工具箱',   values: ['部分', '部分', '全部', '全部'] },
                          { label: '团队协作', values: ['×', '×', '×', '✓'] },
                          { label: '数据导出', values: ['×', '×', '×', '✓'] },
                          { label: '客服支持', values: ['社区', '工单', '优先', '专属'] },
                        ].map((row, ri) => (
                          <tr key={ri} className={`border-b border-border last:border-0 ${ri % 2 === 0 ? 'bg-muted/20' : ''}`}>
                            <td className="px-4 py-2.5 font-medium whitespace-nowrap">{row.label}</td>
                            {row.values.map((v, vi) => (
                              <td key={vi} className="px-3 py-2.5 text-center whitespace-nowrap">
                                <span className={v === '×' ? 'text-muted-foreground/40' : v === '✓' ? 'text-emerald-500' : 'text-foreground text-xs'}>
                                  {v}
                                </span>
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
