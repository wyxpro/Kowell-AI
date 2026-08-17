import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import AppLayout from '@/components/layouts/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { motion, AnimatePresence } from 'motion/react';
import {
  Bot, Brain, FileText, Target, Code, ArrowRight, Activity, Network, Layers,
  RotateCcw, Loader2, MessageSquare, Send, Eye, TrendingUp, XCircle,
  RefreshCw,
} from 'lucide-react';
import {
  cancelRun,
  getRunSnapshot,
  retryRun,
  subscribeToRun,
  type AgentRunSnapshot,
  type OrchestrationSubscription,
} from '@/services/ai/orchestration';
import type { AgentStep } from '@/types/types';

const AGENTS = [
  { id: 'analyst', stepKeys: ['analyst'], name: '画像分析智能体', role: '需求与学习画像分析', icon: Brain, colorClass: 'bg-primary/10 text-primary border-primary/20', description: '提取需求、分析学习上下文与目标。' },
  { id: 'curator', stepKeys: ['curator'], name: '知识检索智能体', role: '知识检索与整理', icon: Activity, colorClass: 'bg-sky-100 text-sky-600 border-sky-200 dark:bg-sky-900/30 dark:text-sky-400', description: '组织可信知识、参考资料与资源脉络。' },
  { id: 'designer', stepKeys: ['designer'], name: '内容设计智能体', role: '资源结构设计', icon: Layers, colorClass: 'bg-orange-100 text-orange-600 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400', description: '规划多类型资源的结构、层级和呈现方式。' },
  { id: 'creator', stepKeys: ['creator_document', 'creator_mindmap', 'creator_exercise', 'creator_reading', 'creator_code', 'creator_micro_lesson'], name: '资源生成智能体', role: '多模态内容生成', icon: FileText, colorClass: 'bg-violet-100 text-violet-600 border-violet-200 dark:bg-violet-900/30 dark:text-violet-400', description: '生成文档、导图、练习、阅读与代码资源。' },
  { id: 'reviewer', stepKeys: ['reviewer', 'reviewer_repair'], name: '评估反馈智能体', role: '质量审核', icon: Target, colorClass: 'bg-emerald-100 text-emerald-600 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400', description: '检查资源质量并输出审核结果。' },
  { id: 'publisher', stepKeys: ['publisher_path_planner'], name: '发布编排智能体', role: '资源发布', icon: Code, colorClass: 'bg-amber-100 text-amber-600 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400', description: '整理产物状态并完成资源交付。' },
];

type AgentNodeStatus = 'idle' | 'active' | 'completed' | 'failed' | 'cancelled';

function statusLabel(status?: string) {
  const labels: Record<string, string> = { queued: '排队中', running: '运行中', completed: '已完成', failed: '失败', cancelled: '已取消', pending: '待生成' };
  return labels[status ?? ''] ?? status ?? '未知';
}

function findAgentSteps(steps: AgentStep[], stepKeys: readonly string[]): AgentStep[] {
  return steps.filter(step => stepKeys.includes(step.step_key));
}

function nodeStatus(steps: AgentStep[], stepKeys: readonly string[]): AgentNodeStatus {
  const matching = findAgentSteps(steps, stepKeys);
  if (!matching.length) return 'idle';
  if (matching.some(step => step.status === 'running' || step.status === 'queued')) return 'active';
  if (matching.some(step => step.status === 'failed')) return 'failed';
  if (matching.every(step => step.status === 'completed')) return 'completed';
  if (matching.some(step => step.status === 'cancelled')) return 'cancelled';
  return 'idle';
}

export default function AgentVizPage() {
  const [searchParams] = useSearchParams();
  const runId = searchParams.get('runId');
  const [snapshot, setSnapshot] = useState<AgentRunSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(runId));
  const [actionLoading, setActionLoading] = useState(false);
  const subscriptionRef = useRef<OrchestrationSubscription | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const receiveSnapshot = useCallback((next: AgentRunSnapshot) => {
    setSnapshot(next);
    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    void subscriptionRef.current?.unsubscribe();
    subscriptionRef.current = null;
    setSnapshot(null);
    setError(null);
    setLoading(Boolean(runId));

    if (!runId) return () => { active = false; };

    void (async () => {
      try {
        const initial = await getRunSnapshot(runId);
        if (!active) return;
        receiveSnapshot(initial);
        const subscription = await subscribeToRun(runId, {
          onSnapshot: receiveSnapshot,
          onError: subscriptionError => {
            if (active) setError(subscriptionError.message);
          },
        });
        if (active) subscriptionRef.current = subscription;
        else await subscription.unsubscribe();
      } catch (loadError) {
        if (active) {
          setError((loadError as Error).message);
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
      void subscriptionRef.current?.unsubscribe();
      subscriptionRef.current = null;
    };
  }, [receiveSnapshot, runId]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [snapshot]);

  const steps = snapshot?.steps ?? [];
  const artifacts = snapshot?.artifacts ?? [];
  const completedSteps = steps.filter(step => step.status === 'completed').length;
  const progress = snapshot?.run.status === 'completed' ? 100 : steps.length ? Math.round((completedSteps / steps.length) * 100) : 0;
  const isTerminal = snapshot?.run.status === 'completed' || snapshot?.run.status === 'failed' || snapshot?.run.status === 'cancelled';
  const activeStep = steps.find(step => step.status === 'running' || step.status === 'queued');
  const logs = useMemo(() => [
    ...steps.map(step => ({
      id: step.id,
      from: step.step_key,
      to: '工作流',
      time: step.completed_at ?? step.started_at ?? step.created_at ?? '',
      message: `${statusLabel(step.status)}${step.error ? ` · ${step.error}` : ''}`,
    })),
    ...artifacts.map(artifact => ({
      id: artifact.id,
      from: '产物',
      to: artifact.artifact_type,
      time: artifact.updated_at ?? artifact.created_at ?? '',
      message: `${statusLabel(artifact.status)}${artifact.title ? ` · ${artifact.title}` : ''}${artifact.error ? ` · ${artifact.error}` : ''}`,
    })),
  ], [artifacts, steps]);

  const performAction = async (action: () => Promise<unknown>) => {
    if (!runId) return;
    try {
      setActionLoading(true);
      await action();
      receiveSnapshot(await getRunSnapshot(runId));
    } catch (actionError) {
      setError((actionError as Error).message);
    } finally {
      setActionLoading(false);
    }
  };

  const getAgentStatusColor = (stepKeys: readonly string[]) => {
    const status = nodeStatus(steps, stepKeys);
    if (status === 'active') return 'ring-2 ring-primary shadow-md scale-[1.02]';
    if (status === 'completed') return 'ring-1 ring-emerald-400/60';
    if (status === 'failed') return 'ring-1 ring-destructive/70';
    if (status === 'cancelled') return 'ring-1 ring-muted-foreground/50';
    return '';
  };

  const getStatusBadge = (stepKeys: readonly string[]) => {
    const status = nodeStatus(steps, stepKeys);
    if (status === 'active') return <Badge className="text-[10px] px-1.5 animate-pulse bg-primary">运行中</Badge>;
    if (status === 'completed') return <Badge className="text-[10px] px-1.5 bg-emerald-500">已完成</Badge>;
    if (status === 'failed') return <Badge variant="destructive" className="text-[10px] px-1.5">失败</Badge>;
    if (status === 'cancelled') return <Badge variant="secondary" className="text-[10px] px-1.5">已取消</Badge>;
    return <Badge variant="outline" className="text-[10px] px-1.5 text-muted-foreground">等待中</Badge>;
  };

  return (
    <AppLayout>
      <div className="space-y-5 max-w-6xl mx-auto">
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2"><Bot className="w-5 h-5 text-primary" />多智能体协作可视化</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{runId ? `真实 Agent run：${runId}` : '未指定 runId；此页面仅展示真实 Agent run，不使用模拟流程。'}</p>
          </div>
          {runId && (
            <div className="flex items-center gap-2">
              <Button onClick={() => performAction(() => getRunSnapshot(runId))} variant="outline" size="sm" disabled={actionLoading}><RotateCcw className="w-4 h-4 mr-1" />刷新</Button>
              {!isTerminal && <Button onClick={() => performAction(() => cancelRun(runId))} variant="outline" size="sm" disabled={actionLoading}><XCircle className="w-4 h-4 mr-1" />取消</Button>}
              <Button onClick={() => performAction(() => retryRun(runId, steps.find(step => step.status === 'failed')?.id))} size="sm" disabled={actionLoading || (!isTerminal && !steps.some(step => step.status === 'failed'))} className="gap-1">
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}重试
              </Button>
            </div>
          )}
        </motion.div>

        {error && <Card className="border-destructive/40"><CardContent className="p-3 text-sm text-destructive">读取或订阅 run 失败：{error}</CardContent></Card>}

        {(loading || snapshot) && (
          <Card className="p-3">
            <div className="flex items-center justify-between mb-2"><span className="text-xs font-medium">真实工作流进度 {snapshot && `· ${statusLabel(snapshot.run.status)}`}</span><span className="text-xs text-primary font-bold">{progress}%</span></div>
            <Progress value={progress} className="h-1.5" />
            {activeStep && <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5"><Send className="w-3 h-3 text-primary shrink-0" />当前步骤：{activeStep.step_key}（{statusLabel(activeStep.status)}）</p>}
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground flex items-center gap-2"><Network className="w-4 h-4" />智能体节点状态</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {AGENTS.map((agent, idx) => {
                const agentSteps = findAgentSteps(steps, agent.stepKeys);
                const step = agentSteps.find(item => item.status === 'running' || item.status === 'queued') ?? agentSteps[agentSteps.length - 1];
                return <motion.div key={agent.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.06 }}>
                  <Card className={`h-full transition-all duration-300 ${getAgentStatusColor(agent.stepKeys)}`}><CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2"><div className="flex items-center gap-2.5"><div className={`rounded-xl p-2 border ${agent.colorClass}`}><agent.icon className="w-4 h-4" /></div><div><p className="text-sm font-semibold leading-tight">{agent.name}</p><p className="text-[11px] text-muted-foreground">{agent.role}</p></div></div>{getStatusBadge(agent.stepKeys)}</div>
                    <p className="text-xs text-muted-foreground text-pretty leading-relaxed">{step ? `步骤键：${step.step_key}${step.started_at ? ` · 开始于 ${new Date(step.started_at).toLocaleTimeString('zh', { hour12: false })}` : ''}` : agent.description}</p>
                    {step?.error && <p className="text-xs text-destructive leading-relaxed">{step.error}</p>}
                  </CardContent></Card>
                </motion.div>;
              })}
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground flex items-center gap-2"><MessageSquare className="w-4 h-4" />真实步骤与产物日志</h2>
            <Card className="h-[480px] flex flex-col"><div ref={logRef} className="flex-1 overflow-y-auto p-3 space-y-2">
              {loading ? <div className="flex h-full items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div> : logs.length === 0 ? <div className="flex flex-col items-center justify-center h-full text-center gap-3"><div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center"><Eye className="w-5 h-5 text-muted-foreground" /></div><p className="text-sm text-muted-foreground">{runId ? '等待真实步骤或产物写入…' : '从资源生成页启动真实 Agent 工作流后，可在此查看。'}</p></div> : <AnimatePresence>{logs.map(log => <motion.div key={log.id} initial={{ opacity: 0, x: -12, height: 0 }} animate={{ opacity: 1, x: 0, height: 'auto' }} className="bg-muted/50 rounded-lg p-2.5 border border-border/50"><div className="flex items-center justify-between mb-1 gap-1 flex-wrap"><div className="flex items-center gap-1 text-[11px] font-medium"><span className="text-primary">{log.from}</span><ArrowRight className="w-2.5 h-2.5 text-muted-foreground" /><span className="text-secondary">{log.to}</span></div><span className="text-[10px] text-muted-foreground font-mono shrink-0">{log.time ? new Date(log.time).toLocaleTimeString('zh', { hour12: false }) : ''}</span></div><p className="text-xs text-muted-foreground leading-relaxed">{log.message}</p></motion.div>)}</AnimatePresence>}
            </div>{logs.length > 0 && <div className="p-2 border-t border-border/50"><p className="text-[11px] text-center text-muted-foreground">共 {steps.length} 个步骤 · {artifacts.length} 个产物 · {snapshot ? statusLabel(snapshot.run.status) : '读取中'}</p></div>}</Card>
          </div>
        </div>

        <Card><CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Layers className="w-4 h-4 text-primary" />系统架构总览</CardTitle></CardHeader><CardContent className="space-y-3"><div className="grid grid-cols-1 md:grid-cols-3 gap-3">{[
          { layer: '应用层', icon: Eye, items: ['用户画像界面', '资源生成中心', '智能答疑系统', '学习路径规划'], color: 'bg-primary/10 text-primary' },
          { layer: '智能体层', icon: Bot, items: ['分析', '检索', '设计', '生成', '审核', '发布'], color: 'bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400' },
          { layer: '数据层', icon: TrendingUp, items: ['Agent Runs', 'Agent Steps', 'Agent Artifacts', '学习资源库'], color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' },
        ].map((layer, index) => <div key={index} className="p-4 rounded-xl bg-muted/40 border border-border/50 space-y-3"><div className="flex items-center gap-2"><div className={`p-1.5 rounded-lg ${layer.color}`}><layer.icon className="w-3.5 h-3.5" /></div><span className="text-sm font-semibold">{layer.layer}</span></div><div className="flex flex-wrap gap-1">{layer.items.map(item => <Badge key={item} variant="secondary" className="text-[10px] px-1.5 py-0">{item}</Badge>)}</div></div>)}</div>
          <div className="flex flex-wrap items-center justify-center gap-6 pt-2 text-xs text-muted-foreground"><Link to="/portrait" className="flex items-center gap-1.5 hover:text-primary transition-colors"><Brain className="w-3.5 h-3.5" />进入画像构建</Link><Link to="/resources/generate" className="flex items-center gap-1.5 hover:text-primary transition-colors"><FileText className="w-3.5 h-3.5" />进入资源生成</Link><Link to="/learning-path" className="flex items-center gap-1.5 hover:text-primary transition-colors"><Target className="w-3.5 h-3.5" />进入学习路径</Link></div>
        </CardContent></Card>
      </div>
    </AppLayout>
  );
}
