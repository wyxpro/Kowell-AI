import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import AppLayout from '@/components/layouts/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { motion, AnimatePresence } from 'motion/react';
import {
  Bot, Brain, FileText, Target, Code, Sparkles, ArrowRight,
  Activity, Network, Layers, Play, RotateCcw, Loader2,
  MessageSquare, Send, Eye, TrendingUp,
} from 'lucide-react';

// 智能体定义
const AGENTS = [
  {
    id: 'portrait',
    name: '画像分析智能体',
    role: '学习画像构建',
    icon: Brain,
    colorClass: 'bg-primary/10 text-primary border-primary/20',
    dotColor: 'bg-primary',
    description: '通过对话分析学生特征，构建多维度学习画像',
    tasks: ['专业方向识别', '知识基础评估', '认知风格分析', '目标规划'],
  },
  {
    id: 'resource',
    name: '资源生成智能体',
    role: '多模态资源生成',
    icon: FileText,
    colorClass: 'bg-orange-100 text-orange-600 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800',
    dotColor: 'bg-orange-500',
    description: '依据画像生成文档、思维导图、练习题等多类型资源',
    tasks: ['课程文档生成', '思维导图构建', '练习题库创建', '拓展阅读推荐'],
  },
  {
    id: 'tutor',
    name: '辅导答疑智能体',
    role: '智能答疑与辅导',
    icon: Bot,
    colorClass: 'bg-sky-100 text-sky-600 border-sky-200 dark:bg-sky-900/30 dark:text-sky-400 dark:border-sky-700',
    dotColor: 'bg-sky-500',
    description: '提供实时答疑服务，支持苏格拉底式引导教学',
    tasks: ['问题语义理解', '知识库检索', '多模态答案生成', '关联推荐'],
  },
  {
    id: 'path',
    name: '路径规划智能体',
    role: '学习路径优化',
    icon: Target,
    colorClass: 'bg-violet-100 text-violet-600 border-violet-200 dark:bg-violet-900/30 dark:text-violet-400 dark:border-violet-700',
    dotColor: 'bg-violet-500',
    description: '基于画像和进度，动态规划个性化学习路径',
    tasks: ['进度实时评估', '知识图谱分析', '路径动态调整', '资源精准推送'],
  },
  {
    id: 'eval',
    name: '评估反馈智能体',
    role: '学习效果评估',
    icon: Activity,
    colorClass: 'bg-emerald-100 text-emerald-600 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-700',
    dotColor: 'bg-emerald-500',
    description: '综合分析学习数据，生成多维评估报告和改进建议',
    tasks: ['行为数据分析', '薄弱点识别', '评估报告生成', '策略动态调整'],
  },
  {
    id: 'code',
    name: '代码辅助智能体',
    role: '编程实践辅导',
    icon: Code,
    colorClass: 'bg-amber-100 text-amber-600 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700',
    dotColor: 'bg-amber-500',
    description: '提供代码示例、错误诊断和编程最佳实践指导',
    tasks: ['代码智能生成', '错误诊断修复', '优化建议输出', '最佳实践库'],
  },
];

// 工作流定义（含消息序列）
const WORKFLOWS = [
  {
    id: 'generate',
    name: '资源生成工作流',
    icon: FileText,
    description: '学生请求 → 画像分析 → 资源生成 → 质量评估',
    color: 'text-orange-500',
    sequence: [
      { from: 'user', to: 'portrait', msg: '请为我生成《机器学习》线性回归讲解文档', delay: 0 },
      { from: 'portrait', to: 'resource', msg: '画像分析完成：CS专业/视觉型学习者/中级基础', delay: 800 },
      { from: 'resource', to: 'eval', msg: '资源草稿已生成：课程文档 + 思维导图 + 练习题', delay: 1600 },
      { from: 'eval', to: 'path', msg: '质量审核通过，评分 92/100，推荐关联至学习路径', delay: 2400 },
      { from: 'path', to: 'user', msg: '个性化资源已就绪，已推送至您的学习路径', delay: 3200 },
    ],
  },
  {
    id: 'tutoring',
    name: '答疑辅导工作流',
    icon: Bot,
    description: '问题提交 → 画像匹配 → 智能答疑 → 效果追踪',
    color: 'text-sky-500',
    sequence: [
      { from: 'user', to: 'tutor', msg: '请解释反向传播算法的计算过程', delay: 0 },
      { from: 'tutor', to: 'portrait', msg: '查询用户画像：学习风格/知识基础/易错点', delay: 700 },
      { from: 'portrait', to: 'tutor', msg: '画像返回：偏好实例学习，矩阵运算基础薄弱', delay: 1400 },
      { from: 'tutor', to: 'code', msg: '请生成反向传播 Python 实例演示', delay: 2100 },
      { from: 'code', to: 'tutor', msg: '代码示例已生成（含逐步注释）', delay: 2800 },
      { from: 'tutor', to: 'eval', msg: '答疑会话结束，请记录本次知识点掌握情况', delay: 3500 },
    ],
  },
  {
    id: 'path',
    name: '学习路径工作流',
    icon: Target,
    description: '进度更新 → 评估分析 → 路径调整 → 资源推送',
    color: 'text-violet-500',
    sequence: [
      { from: 'user', to: 'eval', msg: '完成练习：数据结构第3章，正确率68%', delay: 0 },
      { from: 'eval', to: 'portrait', msg: '评估结果：链表/树知识点掌握偏弱，需强化', delay: 800 },
      { from: 'portrait', to: 'path', msg: '画像已更新：弱项标记 + 学习历史记录', delay: 1500 },
      { from: 'path', to: 'resource', msg: '路径调整：插入链表专项练习 + 图解讲义', delay: 2300 },
      { from: 'resource', to: 'user', msg: '新资源已推送：3份针对性练习 + 1份图解', delay: 3100 },
    ],
  },
];

interface LogEntry {
  id: string;
  from: string;
  to: string;
  msg: string;
  time: string;
  workflowId: string;
}

interface AgentState {
  status: 'idle' | 'active' | 'sending' | 'completed';
  progress: number;
}

export default function AgentVizPage() {
  const [selectedWorkflow, setSelectedWorkflow] = useState(WORKFLOWS[0]);
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState(-1);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [agentStates, setAgentStates] = useState<Record<string, AgentState>>({});
  const [totalProgress, setTotalProgress] = useState(0);
  const logRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const resetAll = useCallback(() => {
    timerRef.current.forEach(t => clearTimeout(t));
    timerRef.current = [];
    setRunning(false);
    setStep(-1);
    setLogs([]);
    setTotalProgress(0);
    const states: Record<string, AgentState> = {};
    AGENTS.forEach(a => { states[a.id] = { status: 'idle', progress: 0 }; });
    states['user'] = { status: 'idle', progress: 0 };
    setAgentStates(states);
  }, []);

  useEffect(() => {
    resetAll();
  }, [selectedWorkflow, resetAll]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  const runWorkflow = () => {
    if (running) return;
    resetAll();
    setRunning(true);

    const seq = selectedWorkflow.sequence;
    const totalSteps = seq.length;

    seq.forEach((s, i) => {
      const t1 = setTimeout(() => {
        setStep(i);
        setTotalProgress(Math.round(((i + 1) / totalSteps) * 100));

        // 更新 from 和 to 智能体状态
        setAgentStates(prev => ({
          ...prev,
          [s.from]: { status: 'sending', progress: Math.min(100, (i + 1) * 20) },
          [s.to]: { status: 'active', progress: Math.min(100, (i + 1) * 20) },
        }));

        // 添加日志
        const fromAgent = s.from === 'user' ? '用户' : (AGENTS.find(a => a.id === s.from)?.name ?? s.from);
        const toAgent = s.to === 'user' ? '用户' : (AGENTS.find(a => a.id === s.to)?.name ?? s.to);
        setLogs(prev => [...prev, {
          id: `${i}-${Date.now()}`,
          from: fromAgent,
          to: toAgent,
          msg: s.msg,
          time: new Date().toLocaleTimeString('zh', { hour12: false }),
          workflowId: selectedWorkflow.id,
        }]);

        // 发送方稍后变为 completed
        const t2 = setTimeout(() => {
          setAgentStates(prev => ({
            ...prev,
            [s.from]: { ...prev[s.from], status: 'completed' },
          }));
        }, 500);
        timerRef.current.push(t2);
      }, s.delay);
      timerRef.current.push(t1);
    });

    // 全部完成
    const lastDelay = seq[seq.length - 1].delay + 1200;
    const tfinal = setTimeout(() => {
      setRunning(false);
      setTotalProgress(100);
      setAgentStates(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(k => { next[k] = { ...next[k], status: 'completed' }; });
        return next;
      });
    }, lastDelay);
    timerRef.current.push(tfinal);
  };

  const getAgentStatusColor = (id: string) => {
    const s = agentStates[id]?.status;
    if (s === 'active') return 'ring-2 ring-primary shadow-md scale-[1.02]';
    if (s === 'sending') return 'ring-2 ring-secondary shadow-md';
    if (s === 'completed') return 'ring-1 ring-emerald-400/60';
    return '';
  };

  const getStatusBadge = (id: string) => {
    const s = agentStates[id]?.status;
    if (s === 'active') return <Badge className="text-[10px] px-1.5 animate-pulse bg-primary">运行中</Badge>;
    if (s === 'sending') return <Badge variant="secondary" className="text-[10px] px-1.5 animate-pulse">发送中</Badge>;
    if (s === 'completed') return <Badge className="text-[10px] px-1.5 bg-emerald-500">已完成</Badge>;
    return <Badge variant="outline" className="text-[10px] px-1.5 text-muted-foreground">就绪</Badge>;
  };

  const currentSeqMsg = step >= 0 && step < selectedWorkflow.sequence.length
    ? selectedWorkflow.sequence[step] : null;

  return (
    <AppLayout>
      <div className="space-y-5 max-w-6xl mx-auto">
        {/* 标题 */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Bot className="w-5 h-5 text-primary" />多智能体协作可视化
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">实时展示 6 个智能体协同工作的消息传递与任务分工</p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={resetAll} variant="outline" size="sm" disabled={running}>
              <RotateCcw className="w-4 h-4 mr-1" />重置
            </Button>
            <Button onClick={runWorkflow} size="sm" disabled={running} className="gap-1">
              {running ? <><Loader2 className="w-4 h-4 animate-spin" />运行中...</> : <><Play className="w-4 h-4" />启动演示</>}
            </Button>
          </div>
        </motion.div>

        {/* 工作流选择 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {WORKFLOWS.map(wf => (
            <button
              key={wf.id}
              type="button"
              onClick={() => { if (!running) setSelectedWorkflow(wf); }}
              disabled={running}
              className={`text-left p-3.5 rounded-xl border transition-all ${
                selectedWorkflow.id === wf.id
                  ? 'border-primary bg-primary/5 shadow-sm'
                  : 'border-border hover:bg-muted/50 hover:border-primary/30'
              } ${running ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <wf.icon className={`w-4 h-4 ${selectedWorkflow.id === wf.id ? 'text-primary' : wf.color}`} />
                <span className="text-sm font-semibold">{wf.name}</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{wf.description}</p>
            </button>
          ))}
        </div>

        {/* 进度条 */}
        <AnimatePresence>
          {(running || totalProgress > 0) && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
              <Card className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium">工作流进度</span>
                  <span className="text-xs text-primary font-bold">{totalProgress}%</span>
                </div>
                <Progress value={totalProgress} className="h-1.5" />
                {currentSeqMsg && (
                  <motion.p
                    key={step}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5"
                  >
                    <Send className="w-3 h-3 text-primary shrink-0" />
                    正在传递：{currentSeqMsg.msg}
                  </motion.p>
                )}
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* 左侧：智能体网格 */}
          <div className="lg:col-span-2 space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
              <Network className="w-4 h-4" />智能体节点状态
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {AGENTS.map((agent, idx) => (
                <motion.div
                  key={agent.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.06 }}
                >
                  <Card className={`h-full transition-all duration-300 ${getAgentStatusColor(agent.id)}`}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className={`rounded-xl p-2 border ${agent.colorClass}`}>
                            <agent.icon className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold leading-tight">{agent.name}</p>
                            <p className="text-[11px] text-muted-foreground">{agent.role}</p>
                          </div>
                        </div>
                        {getStatusBadge(agent.id)}
                      </div>
                      <p className="text-xs text-muted-foreground text-pretty leading-relaxed">{agent.description}</p>
                      {agentStates[agent.id]?.status === 'active' && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="flex items-center gap-1.5 text-xs text-primary"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse inline-block" />
                          <span>处理中...</span>
                        </motion.div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>

          {/* 右侧：消息日志 */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />协作消息日志
            </h2>
            <Card className="h-[480px] flex flex-col">
              <div
                ref={logRef}
                className="flex-1 overflow-y-auto p-3 space-y-2"
              >
                {logs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                      <Eye className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">点击「启动演示」查看<br />智能体间的消息传递</p>
                  </div>
                ) : (
                  <AnimatePresence>
                    {logs.map((log) => (
                      <motion.div
                        key={log.id}
                        initial={{ opacity: 0, x: -12, height: 0 }}
                        animate={{ opacity: 1, x: 0, height: 'auto' }}
                        transition={{ duration: 0.3 }}
                        className="bg-muted/50 rounded-lg p-2.5 border border-border/50"
                      >
                        <div className="flex items-center justify-between mb-1 gap-1 flex-wrap">
                          <div className="flex items-center gap-1 text-[11px] font-medium">
                            <span className="text-primary">{log.from}</span>
                            <ArrowRight className="w-2.5 h-2.5 text-muted-foreground" />
                            <span className="text-secondary">{log.to}</span>
                          </div>
                          <span className="text-[10px] text-muted-foreground font-mono shrink-0">{log.time}</span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">{log.msg}</p>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                )}
              </div>
              {logs.length > 0 && (
                <div className="p-2 border-t border-border/50">
                  <p className="text-[11px] text-center text-muted-foreground">
                    共 {logs.length} 条消息 · {totalProgress === 100 ? '✅ 工作流完成' : '⏳ 运行中...'}
                  </p>
                </div>
              )}
            </Card>
          </div>
        </div>

        {/* 系统架构 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" />系统架构总览
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                {
                  layer: '应用层', icon: Eye,
                  items: ['用户画像界面', '资源生成中心', '智能答疑系统', '学习路径规划'],
                  color: 'bg-primary/10 text-primary',
                },
                {
                  layer: '智能体层', icon: Bot,
                  items: ['画像分析智能体', '资源生成智能体', '辅导答疑智能体', '路径规划智能体', '评估反馈智能体', '代码辅助智能体'],
                  color: 'bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400',
                },
                {
                  layer: '数据层', icon: Activity,
                  items: ['用户画像库', '学习资源库', '学习路径库', '评估历史库', '错题知识库'],
                  color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
                },
              ].map((l, i) => (
                <div key={i} className="p-4 rounded-xl bg-muted/40 border border-border/50 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg ${l.color}`}>
                      <l.icon className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-sm font-semibold">{l.layer}</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {l.items.map((item, j) => (
                      <Badge key={j} variant="secondary" className="text-[10px] px-1.5 py-0">{item}</Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-6 pt-2 text-xs text-muted-foreground">
              <Link to="/portrait" className="flex items-center gap-1.5 hover:text-primary transition-colors">
                <Brain className="w-3.5 h-3.5" />进入画像构建
              </Link>
              <Link to="/resources/generate" className="flex items-center gap-1.5 hover:text-primary transition-colors">
                <FileText className="w-3.5 h-3.5" />进入资源生成
              </Link>
              <Link to="/tutoring" className="flex items-center gap-1.5 hover:text-primary transition-colors">
                <Bot className="w-3.5 h-3.5" />进入答疑中心
              </Link>
              <Link to="/learning-path" className="flex items-center gap-1.5 hover:text-primary transition-colors">
                <Target className="w-3.5 h-3.5" />进入学习路径
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
