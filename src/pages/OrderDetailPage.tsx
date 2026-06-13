import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/db/supabase';
import AppLayout from '@/components/layouts/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import QRCodeDataUrl from '@/components/ui/qrcodedataurl';
import { Loader2, CheckCircle, XCircle, ArrowLeft, RefreshCw, Clock } from 'lucide-react';
import { motion } from 'motion/react';

interface Order {
  id: string;
  order_no: string;
  plan_name: string;
  billing_cycle: string;
  amount: number;
  status: 'pending' | 'paid' | 'cancelled' | 'refunded';
  wechat_pay_url: string | null;
  created_at: string;
  paid_at: string | null;
}

const STATUS_CONFIG = {
  pending:   { label: '待支付',   color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',  icon: Clock },
  paid:      { label: '已支付',   color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300', icon: CheckCircle },
  cancelled: { label: '已取消',   color: 'bg-muted text-muted-foreground', icon: XCircle },
  refunded:  { label: '已退款',   color: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300', icon: RefreshCw },
};

export default function OrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchOrder = useCallback(async () => {
    if (!orderId) return;
    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();
    if (data) setOrder(data as Order);
  }, [orderId]);

  useEffect(() => {
    fetchOrder().finally(() => setLoading(false));
  }, [fetchOrder]);

  // 每2秒轮询订单状态（仅 pending 时）
  useEffect(() => {
    if (!order) return;
    if (order.status === 'pending') {
      pollRef.current = setInterval(async () => {
        const { data } = await supabase
          .from('orders')
          .select('*')
          .eq('id', orderId)
          .single();
        if (data && data.status !== 'pending') {
          setOrder(data as Order);
          clearInterval(pollRef.current!);
          if (data.status === 'paid') {
            toast.success('🎉 支付成功！套餐已升级');
          }
        }
      }, 2000);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [order?.status, orderId]);

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!order) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-64 gap-4 text-muted-foreground">
          <XCircle className="w-12 h-12 opacity-30" />
          <p>订单不存在</p>
          <Button variant="outline" onClick={() => navigate(-1)}>返回</Button>
        </div>
      </AppLayout>
    );
  }

  const cfg = STATUS_CONFIG[order.status];
  const StatusIcon = cfg.icon;

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto space-y-4">
        {/* 顶部返回 */}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate('/invite?tab=plans')} className="gap-1.5">
            <ArrowLeft className="w-4 h-4" />返回套餐
          </Button>
        </div>

        {/* 订单信息卡 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span>订单详情</span>
              <Badge className={`${cfg.color} border-0 gap-1`}>
                <StatusIcon className="w-3 h-3" />
                {cfg.label}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-y-2 text-sm">
              <span className="text-muted-foreground">订单号</span>
              <span className="font-mono text-xs text-right break-all">{order.order_no}</span>
              <span className="text-muted-foreground">套餐</span>
              <span className="text-right font-medium">{order.plan_name}</span>
              <span className="text-muted-foreground">周期</span>
              <span className="text-right">{order.billing_cycle === 'year' ? '年付' : '月付'}</span>
              <span className="text-muted-foreground">金额</span>
              <span className="text-right font-bold text-primary text-lg">¥{Number(order.amount).toFixed(2)}</span>
              <span className="text-muted-foreground">下单时间</span>
              <span className="text-right text-xs">{new Date(order.created_at).toLocaleString('zh-CN')}</span>
              {order.paid_at && (
                <>
                  <span className="text-muted-foreground">支付时间</span>
                  <span className="text-right text-xs">{new Date(order.paid_at).toLocaleString('zh-CN')}</span>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 待支付：显示微信二维码 */}
        {order.status === 'pending' && order.wechat_pay_url && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="border-amber-200 dark:border-amber-800">
              <CardContent className="p-6 flex flex-col items-center gap-4">
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                  <Clock className="w-4 h-4 animate-pulse" />
                  <span className="text-sm font-medium">请在微信中扫码完成支付</span>
                </div>
                <div className="p-3 bg-white rounded-2xl shadow-sm">
                  <QRCodeDataUrl text={order.wechat_pay_url} width={200} />
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  支付后页面自动刷新 · 请勿关闭此页面
                </p>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  正在等待支付结果...
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* 支付成功 */}
        {order.status === 'paid' && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
            <Card className="border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/10">
              <CardContent className="p-6 flex flex-col items-center gap-4 text-center">
                <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-emerald-500" />
                </div>
                <div>
                  <p className="font-bold text-lg text-emerald-700 dark:text-emerald-400">支付成功！</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {order.plan_name}已激活，开始享受专属学习特权吧
                  </p>
                </div>
                <Button onClick={() => navigate('/home')} className="w-full">
                  开始学习
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* 已取消 */}
        {order.status === 'cancelled' && (
          <Card>
            <CardContent className="p-6 flex flex-col items-center gap-3 text-center">
              <XCircle className="w-10 h-10 text-muted-foreground opacity-40" />
              <p className="text-sm text-muted-foreground">订单已取消</p>
              <Button variant="outline" onClick={() => navigate('/invite?tab=plans')}>
                重新选择套餐
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
