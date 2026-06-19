import { useState, useEffect, useRef } from 'react';
import AppLayout from '@/components/layouts/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'motion/react';
import {
  TrendingUp, Target, Compass, Zap, Shield, Star, Globe, ArrowRight,
  CheckCircle2, AlertCircle, Clock, Rocket, Trophy, Users, Code2, Network, Brain,
  ChevronRight, BarChart3, Sparkles, GitBranch, Circle, Cpu, MessageSquare,
  BookOpen, Route, FileText, Loader2, CheckCircle, Bot,
} from 'lucide-react';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';

// ── 多智能体协作可视化面板 ─────────────────────────────────────────

type NodeStatus = 'idle' | 'running' | 'done' | 'error';

interface AgentNode {
  id: string;
  name: string;
  role: string;
  icon: React.ElementType;
  color: string;
  glow: string;
}

interface WorkflowDef {
  id: string;
  name: string;
  icon: React.ElementType;
  color: string;
  agents: AgentNode[];
  logs: string[];
}

const WORKFLOWS: WorkflowDef[] = [
  {
    id: 'resource',
    name: '资源生成工作流',
    icon: FileText,
    color: 'text-primary',
    agents: [
      { id: 'r1', name: '需求分析智能体', role: '解析用户画像与课程主题', icon: Brain, color: 'bg-violet-500', glow: 'shadow-violet-400/50' },
      { id: 'r2', name: '内容生成智能体', role: '生成教学案例、思维导图', icon: Cpu, color: 'bg-primary', glow: 'shadow-primary/50' },
      { id: 'r3', name: '质量审校智能体', role: '校验内容准确性与格式', icon: CheckCircle, color: 'bg-emerald-500', glow: 'shadow-emerald-400/50' },
      { id: 'r4', name: '格式编排智能体', role: '输出结构化最终资源', icon: FileText, color: 'bg-amber-500', glow: 'shadow-amber-400/50' },
    ],
    logs: [
      '需求分析智能体：已解析学习画像 6 个维度',
      '内容生成智能体：正在生成《教学案例》...',
      '内容生成智能体：正在生成《知识思维导图》...',
      '质量审校智能体：内容通过准确性校验',
      '格式编排智能体：输出 PDF + JSON 格式完成',
      '全流程完成，4 种资源已入库',
    ],
  },
  {
    id: 'tutoring',
    name: '答疑辅导工作流',
    icon: MessageSquare,
    color: 'text-sky-500',
    agents: [
      { id: 't1', name: '意图理解智能体', role: '解析学生问题与上下文', icon: Brain, color: 'bg-sky-500', glow: 'shadow-sky-400/50' },
      { id: 't2', name: '知识检索智能体', role: '从知识库检索相关内容', icon: BookOpen, color: 'bg-indigo-500', glow: 'shadow-indigo-400/50' },
      { id: 't3', name: '苏格拉底引导智能体', role: '组织引导式答疑策略', icon: Sparkles, color: 'bg-amber-500', glow: 'shadow-amber-400/50' },
      { id: 't4', name: '反馈评估智能体', role: '评估回答效果并记录', icon: CheckCircle, color: 'bg-emerald-500', glow: 'shadow-emerald-400/50' },
    ],
    logs: [
      '意图理解智能体：识别问题类型 → 概念解析',
      '知识检索智能体：命中 3 条知识库条目',
      '苏格拉底引导智能体：构建引导式回答结构',
      '反馈评估智能体：学生理解度评分 88/100',
      '已自动推荐 2 个关联知识点资源',
    ],
  },
  {
    id: 'path',
    name: '学习路径工作流',
    icon: Route,
    color: 'text-rose-500',
    agents: [
      { id: 'p1', name: '画像分析智能体', role: '分析学习画像与薄弱项', icon: Users, color: 'bg-rose-500', glow: 'shadow-rose-400/50' },
      { id: 'p2', name: '目标拆解智能体', role: '将学习目标拆解为阶段', icon: Target, color: 'bg-orange-500', glow: 'shadow-orange-400/50' },
      { id: 'p3', name: '资源匹配智能体', role: '为每阶段匹配最优资源', icon: Zap, color: 'bg-yellow-500', glow: 'shadow-yellow-400/50' },
      { id: 'p4', name: '路径优化智能体', role: '动态调整路径与进度', icon: Route, color: 'bg-teal-500', glow: 'shadow-teal-400/50' },
    ],
    logs: [
      '画像分析智能体：检测到 2 个薄弱知识领域',
      '目标拆解智能体：拆解为 4 个学习阶段',
      '资源匹配智能体：已匹配 12 项最优资源',
      '路径优化智能体：根据进度调整阶段权重',
      '新版个性化路径已生成，可在学习路径页查看',
    ],
  },
];

// 单工作流面板（节点 + 日志各自独立）
function WorkflowPanel({ wf }: { wf: WorkflowDef }) {
  const [nodeStatus, setNodeStatus] = useState<Record<string, NodeStatus>>({});
  const [visibleLogs, setVisibleLogs] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const logsRef = useRef<HTMLDivElement>(null);

  const runWorkflow = async () => {
    setRunning(true);
    setNodeStatus({});
    setVisibleLogs([]);
    const agents = wf.agents;
    const logs = wf.logs;
    for (let i = 0; i < agents.length; i++) {
      setNodeStatus(prev => ({ ...prev, [agents[i].id]: 'running' }));
      await new Promise(r => setTimeout(r, 800));
      const logIdx = Math.floor((i / agents.length) * logs.length);
      for (let l = logIdx; l < Math.min(logIdx + 2, logs.length); l++) {
        await new Promise(r => setTimeout(r, 260));
        setVisibleLogs(prev => [...prev, logs[l]]);
      }
      setNodeStatus(prev => ({ ...prev, [agents[i].id]: 'done' }));
      await new Promise(r => setTimeout(r, 180));
    }
    for (let l = Math.ceil((agents.length / agents.length) * logs.length); l < logs.length; l++) {
      await new Promise(r => setTimeout(r, 300));
      setVisibleLogs(prev => [...prev, logs[l]]);
    }
    setRunning(false);
  };

  // 自动滚动日志
  useEffect(() => {
    if (logsRef.current) logsRef.current.scrollTop = logsRef.current.scrollHeight;
  }, [visibleLogs]);

  return (
    <div className="space-y-4">
      {/* 工作流标题行 */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${wf.color} bg-opacity-20`} style={{ background: 'hsl(var(--muted))' }}>
            <wf.icon className={`w-4 h-4 ${wf.color}`} />
          </div>
          <div>
            <h4 className="text-sm font-semibold">{wf.name}</h4>
            <p className="text-[10px] text-muted-foreground">{wf.agents.length} 个协作节点</p>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={runWorkflow} disabled={running} className="gap-1.5 h-7 text-xs px-3 shrink-0">
          {running ? <><Loader2 className="w-3 h-3 animate-spin" />运行中</> : <><Zap className="w-3 h-3" />启动</>}
        </Button>
      </div>

      {/* 节点状态 */}
      <div className="relative">
        {/* 连接线 */}
        <div className="absolute top-[28px] left-[12.5%] right-[12.5%] h-px bg-border z-0 hidden md:block" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 relative z-10">
          {wf.agents.map((agent, idx) => {
            const status = nodeStatus[agent.id] ?? 'idle';
            return (
              <motion.div
                key={agent.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.06, type: 'spring', stiffness: 300, damping: 26 }}
                className="flex flex-col items-center gap-1.5"
              >
                <div className="relative">
                  {status === 'running' && (
                    <>
                      <motion.div
                        className={`absolute -inset-3 rounded-full ${agent.color} opacity-10`}
                        animate={{ scale: [1, 1.7, 1], opacity: [0.08, 0.22, 0.08] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      />
                      <motion.div
                        className={`absolute -inset-1.5 rounded-full ${agent.color} opacity-15`}
                        animate={{ scale: [1, 1.3, 1], opacity: [0.12, 0.28, 0.12] }}
                        transition={{ duration: 1, repeat: Infinity, delay: 0.25 }}
                      />
                    </>
                  )}
                  {status === 'done' && (
                    <motion.div
                      className={`absolute -inset-1 rounded-full border-2 opacity-30`}
                      style={{ borderColor: 'hsl(var(--primary))' }}
                      initial={{ scale: 0.7, opacity: 0 }}
                      animate={{ scale: 1, opacity: 0.3 }}
                      transition={{ duration: 0.35 }}
                    />
                  )}
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all duration-500 shadow-sm ${
                    status === 'done'    ? `${agent.color} border-transparent ${agent.glow}` :
                    status === 'running' ? `${agent.color} border-white/40 ${agent.glow}` :
                    'bg-muted border-border'
                  }`}>
                    {status === 'running'
                      ? <Loader2 className="w-5 h-5 text-white animate-spin" />
                      : status === 'done'
                        ? <agent.icon className="w-5 h-5 text-white" />
                        : <agent.icon className="w-5 h-5 text-muted-foreground/30" />
                    }
                  </div>
                  <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-card flex items-center justify-center ${
                    status === 'done' ? 'bg-emerald-500' : status === 'running' ? 'bg-amber-400' : 'bg-muted-foreground/20'
                  }`}>
                    {status === 'done' && (
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400 }}>
                        <CheckCircle2 className="w-2 h-2 text-white" />
                      </motion.div>
                    )}
                    {status === 'running' && (
                      <motion.div className="w-1 h-1 rounded-full bg-white"
                        animate={{ opacity: [1, 0, 1] }} transition={{ duration: 0.55, repeat: Infinity }} />
                    )}
                  </div>
                </div>
                <div className="text-center px-0.5">
                  <p className={`text-[10px] font-semibold leading-tight text-balance transition-colors ${status !== 'idle' ? 'text-foreground' : 'text-muted-foreground/50'}`}>
                    {agent.name}
                  </p>
                  <p className="text-[9px] text-muted-foreground leading-tight mt-0.5 text-pretty">{agent.role}</p>
                </div>
                {idx < wf.agents.length - 1 && (
                  <div className="hidden md:block absolute z-20" style={{ top: '22px', left: `calc(${(idx + 1) * 25}% - 9px)` }}>
                    <ChevronRight className={`w-4 h-4 transition-colors duration-500 ${nodeStatus[wf.agents[idx].id] === 'done' ? 'text-primary' : 'text-muted-foreground/20'}`} />
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* 协作消息日志 — 节点下方 */}
      <div className="rounded-xl border border-border bg-muted/20 overflow-hidden">
        <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-border bg-muted/30">
          <motion.div
            className="w-1.5 h-1.5 rounded-full bg-emerald-500"
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.4, repeat: Infinity }}
          />
          <span className="text-[10px] font-medium text-muted-foreground">协作消息日志</span>
          {visibleLogs.length > 0 && (
            <span className="ml-auto text-[10px] text-muted-foreground tabular-nums">{visibleLogs.length} 条</span>
          )}
        </div>
        <div ref={logsRef} className="p-2.5 space-y-1 max-h-32 overflow-y-auto">
          <AnimatePresence initial={false}>
            {visibleLogs.length === 0 ? (
              <p className="text-[10px] text-muted-foreground/40 italic px-1">点击「启动」查看实时消息传递...</p>
            ) : visibleLogs.map((log, i) => (
              <motion.div key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2 }}
                className="flex items-start gap-1.5"
              >
                <span className="text-[9px] text-muted-foreground font-mono shrink-0 mt-0.5 tabular-nums opacity-60">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="text-[10px] text-foreground/80 leading-relaxed text-pretty">{log}</span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function MultiAgentSection() {
  return (
    <Card className="overflow-hidden border-border/60">
      <CardHeader className="pb-3 bg-gradient-to-r from-primary/8 to-transparent border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Network className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">多智能体协作可视化</h3>
            <p className="text-[11px] text-muted-foreground">3 条工作流 · 实时监控节点状态与协作消息</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 divide-y xl:divide-y-0 xl:divide-x divide-border">
          {WORKFLOWS.map((wf, idx) => (
            <motion.div
              key={wf.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1, type: 'spring', stiffness: 260, damping: 24 }}
              className="pt-5 xl:pt-0 first:pt-0 xl:px-4 xl:first:pl-0 xl:last:pr-0"
            >
              <WorkflowPanel wf={wf} />
            </motion.div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────
const featureMatrix = [
  { feature: 'AI实时答疑',       khan: 90, duolingo: 30, xueersi: 90, ape: 85, ifly: 90, us: 85 },
  { feature: '个性化路径',        khan: 85, duolingo: 95, xueersi: 90, ape: 80, ifly: 85, us: 88 },
  { feature: '知识图谱',          khan: 60, duolingo: 40, xueersi: 95, ape: 60, ifly: 92, us: 70 },
  { feature: '游戏化学习',        khan: 50, duolingo: 98, xueersi: 50, ape: 55, ifly: 30, us: 55 },
  { feature: '多智能体透明化',    khan: 0,  duolingo: 0,  xueersi: 0,  ape: 0,  ifly: 0,  us: 90 },
  { feature: '代码学习',          khan: 75, duolingo: 0,  xueersi: 20, ape: 10, ifly: 15, us: 80 },
  { feature: '学习社群',          khan: 80, duolingo: 75, xueersi: 40, ape: 50, ifly: 30, us: 75 },
  { feature: '学习报告',          khan: 80, duolingo: 88, xueersi: 90, ape: 85, ifly: 90, us: 78 },
];

const radarData = [
  { subject: 'AI辅导', us: 85, avg: 72 },
  { subject: '个性化', us: 88, avg: 87 },
  { subject: '知识图谱', us: 70, avg: 69 },
  { subject: '游戏化', us: 55, avg: 57 },
  { subject: '多智能体', us: 90, avg: 0 },
  { subject: '代码学习', us: 80, avg: 24 },
  { subject: '画像系统', us: 85, avg: 58 },
];

// 对标差距分析
const gapAnalysis = [
  {
    dimension: '知识图谱深度',
    competitor: '学而思 (3万+知识点)',
    currentGap: 35,
    strategy: '接入文心大模型自动构建，可视化展示知识关联',
    priority: 'P0',
    status: 'done',
    icon: Network,
  },
  {
    dimension: '苏格拉底式辅导',
    competitor: 'Khanmigo (引导思考)',
    currentGap: 45,
    strategy: '优化 Prompt 为引导式提问，增加「思考提示」模式',
    priority: 'P0',
    status: 'done',
    icon: Brain,
  },
  {
    dimension: '代码学习增强',
    competitor: 'Khan Academy (在线代码)',
    currentGap: 20,
    strategy: '在线代码编辑器 + AI 代码审阅 + 编程面试模拟',
    priority: 'P1',
    status: 'done',
    icon: Code2,
  },
  {
    dimension: '弱项强化训练',
    competitor: '猿辅导 (AI个性化练习)',
    currentGap: 30,
    strategy: '基于错题本数据，AI 定向生成强化练习',
    priority: 'P0',
    status: 'done',
    icon: Target,
  },
  {
    dimension: '游戏化粘性',
    competitor: 'Duolingo (连胜+积分)',
    currentGap: 43,
    strategy: '连续打卡 + 成就徽章 + 学习积分体系',
    priority: 'P1',
    status: 'done',
    icon: Trophy,
  },
  {
    dimension: '拍照输入',
    competitor: '作业帮/小猿搜题',
    currentGap: 60,
    strategy: '接入多模态大模型支持图片上传 + OCR 识别',
    priority: 'P2',
    status: 'todo',
    icon: Globe,
  },
  {
    dimension: '语音交互',
    competitor: '科大讯飞 / 豆包爱学',
    currentGap: 70,
    strategy: '接入 MiniMax TTS 实现语音答疑与播报',
    priority: 'P2',
    status: 'todo',
    icon: Zap,
  },
];

// 差异化竞争方向
const differentiators = [
  {
    title: '多智能体透明化',
    desc: '其他产品 AI 为黑盒，Kowell AI 实时展示 AI 决策过程和智能体协作可视化，增强用户信任感。',
    advantage: '独家优势',
    color: 'from-primary/20 to-primary/5',
    border: 'border-primary/30',
    icon: Brain,
    score: 90,
  },
  {
    title: '高校场景深耕',
    desc: '专注大学课程（数据结构、算法、AI 课程），避开 K-12 红海市场，精准定位高等教育。',
    advantage: '蓝海市场',
    color: 'from-sky-500/20 to-sky-500/5',
    border: 'border-sky-300 dark:border-sky-700',
    icon: Target,
    score: 85,
  },
  {
    title: '代码学习增强',
    desc: '多数产品无代码能力。在线代码运行、AI 代码批改、编程面试模拟，服务计算机专业学生。',
    advantage: '竞争缺口',
    color: 'from-violet-500/20 to-violet-500/5',
    border: 'border-violet-300 dark:border-violet-700',
    icon: Code2,
    score: 80,
  },
  {
    title: '画像驱动一切',
    desc: '6 维学习画像深度影响推荐、路径、答疑风格，形成数据壁垒，越用越懂你。',
    advantage: '数据壁垒',
    color: 'from-emerald-500/20 to-emerald-500/5',
    border: 'border-emerald-300 dark:border-emerald-700',
    icon: Users,
    score: 85,
  },
];

// 战略路线图
const roadmap = [
  {
    phase: '短期',
    period: '1-2 个月',
    color: 'bg-emerald-500',
    goals: [
      { text: '错题本弱项强化训练', done: true },
      { text: '连续打卡 + 成就徽章体系', done: true },
      { text: '学习报告（周报/月报）', done: true },
      { text: 'AI辅导苏格拉底式引导模式', done: true },
      { text: '知识图谱可视化', done: true },
      { text: '代码实验室 + AI代码审阅', done: true },
    ],
    icon: Rocket,
  },
  {
    phase: '中期',
    period: '3-6 个月',
    color: 'bg-amber-500',
    goals: [
      { text: '游戏化积分排行榜体系', done: false },
      { text: '多模态输入（图片/拍照搜题）', done: false },
      { text: '智能推荐（画像驱动内容流）', done: false },
      { text: '学习小组 + 协作白板', done: false },
      { text: '语音答疑（MiniMax TTS）', done: false },
    ],
    icon: TrendingUp,
  },
  {
    phase: '长期',
    period: '6-12 个月',
    color: 'bg-primary',
    goals: [
      { text: '高校课程管理系统打通', done: false },
      { text: 'AI 导师个性化形象与风格', done: false },
      { text: '3D 知识图谱（学习元宇宙）', done: false },
      { text: '跨校学分互认生态', done: false },
    ],
    icon: Sparkles,
  },
];

const priorityColor: Record<string, string> = {
  P0: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  P1: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  P2: 'bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-300',
  P3: 'bg-muted text-muted-foreground',
};

const COMPETITOR_KEYS = ['us', 'khan', 'duolingo', 'xueersi', 'ape', 'ifly'] as const;
const COMPETITOR_LABELS: Record<string, string> = {
  us: 'Kowell AI', khan: 'Khan Academy', duolingo: 'Duolingo',
  xueersi: '学而思', ape: '猿辅导', ifly: '科大讯飞',
};
const COMPETITOR_COLORS: Record<string, string> = {
  us: 'hsl(var(--primary))', khan: '#10b981', duolingo: '#84cc16',
  xueersi: '#f59e0b', ape: '#3b82f6', ifly: '#8b5cf6',
};

export default function StrategyPage() {
  const [activeTab, setActiveTab] = useState<'gap' | 'agent' | 'diff' | 'matrix' | 'roadmap'>('gap');

  const completedGaps = gapAnalysis.filter(g => g.status === 'done').length;
  const totalScore = Math.round(radarData.reduce((a, b) => a + b.us, 0) / radarData.length);
  const avgScore = Math.round(radarData.reduce((a, b) => a + b.avg, 0) / radarData.length);

  return (
    <AppLayout>
      <div className="space-y-5">
        {/* 标题区 */}
        <div className="rounded-2xl bg-gradient-to-br from-primary via-primary/80 to-primary/60 p-6 text-white relative overflow-hidden">
          <div className="absolute right-0 top-0 opacity-10 pointer-events-none">
            <Compass className="w-48 h-48" />
          </div>
          <div className="relative">
            <div className="flex items-start justify-between gap-3">
              <Badge className="bg-white/20 text-white border-0 mb-3">竞争情报与战略规划</Badge>
            </div>
            <h1 className="text-xl md:text-2xl font-bold mb-1 text-balance">竞争洞察 · 战略展望</h1>
            <p className="text-white/80 text-sm max-w-xl text-pretty">
              对标国内外 12 款顶级 AI 教育产品，聚焦差距与差异化竞争，打造"国内首个多智能体透明化 AI 学习平台"。
            </p>
            <div className="flex flex-wrap gap-4 mt-4">
              {[
                { label: '综合竞争力', value: `${totalScore}分`, sub: `超均值 ${totalScore - avgScore} 分` },
                { label: '差距已追赶', value: `${completedGaps}/${gapAnalysis.length}`, sub: '对标维度' },
                { label: '独家差异化', value: '4 项', sub: '核心竞争方向' },
              ].map(s => (
                <div key={s.label} className="bg-white/15 backdrop-blur-sm rounded-xl px-4 py-3 min-w-[100px]">
                  <p className="text-xl font-bold">{s.value}</p>
                  <p className="text-[11px] text-white/60">{s.label}</p>
                  <p className="text-[11px] text-white/80">{s.sub}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 标签栏 */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1 p-1 rounded-xl bg-muted w-fit">
            {([
              { key: 'gap',   label: '对标差距分析', icon: Target    },
              { key: 'agent', label: '多智能体可视化', icon: Bot      },
              { key: 'diff',  label: '差异化优势',   icon: Shield    },
              { key: 'matrix',label: '功能矩阵',     icon: BarChart3 },
              { key: 'roadmap',label: '战略路线图',  icon: Compass   },
            ] as const).map(t => (
              <button
                key={t.key}
                type="button"
                onClick={() => setActiveTab(t.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === t.key ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <t.icon className="w-3.5 h-3.5 hidden md:block" />
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* 对标差距分析 */}
        {activeTab === 'gap' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 雷达图 */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">能力雷达对比</CardTitle>
                  <p className="text-xs text-muted-foreground">Kowell AI vs 竞品均值</p>
                </CardHeader>
                <CardContent>
                  <div className="w-full min-w-0 overflow-hidden">
                    <ResponsiveContainer width="100%" height={280}>
                      <RadarChart data={radarData}>
                        <PolarGrid gridType="polygon" />
                        <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} />
                        <Radar name="Kowell AI" dataKey="us" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.25} strokeWidth={2} />
                        <Radar name="竞品均值" dataKey="avg" stroke="hsl(var(--muted-foreground))" fill="hsl(var(--muted-foreground))" fillOpacity={0.1} strokeWidth={1.5} strokeDasharray="4,2" />
                        <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', fontSize: '12px' }} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex items-center gap-4 justify-center text-xs text-muted-foreground mt-2">
                    <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 rounded bg-primary" />Kowell AI</div>
                    <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 rounded bg-muted-foreground border-dashed" />竞品均值</div>
                  </div>
                </CardContent>
              </Card>

              {/* 差距进度 */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">差距追赶进度</CardTitle>
                  <p className="text-xs text-muted-foreground">对标各维度当前完成情况</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  {gapAnalysis.map(g => (
                    <div key={g.dimension}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-medium truncate flex-1">{g.dimension}</span>
                        <div className="flex items-center gap-1.5 shrink-0 ml-2">
                          <Badge className={`text-[10px] ${priorityColor[g.priority]}`}>{g.priority}</Badge>
                          {g.status === 'done'
                            ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            : <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                          }
                        </div>
                      </div>
                      <Progress
                        value={g.status === 'done' ? 100 - g.currentGap * 0.3 : 100 - g.currentGap}
                        className="h-1.5"
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* 详情表 */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">6.1 对标差距详细分析</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[600px]">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left pb-2 font-medium text-muted-foreground text-xs w-36 whitespace-nowrap">对标维度</th>
                        <th className="text-left pb-2 font-medium text-muted-foreground text-xs whitespace-nowrap">对标产品</th>
                        <th className="text-left pb-2 font-medium text-muted-foreground text-xs whitespace-nowrap">追赶策略</th>
                        <th className="text-center pb-2 font-medium text-muted-foreground text-xs whitespace-nowrap w-16">优先级</th>
                        <th className="text-center pb-2 font-medium text-muted-foreground text-xs whitespace-nowrap w-16">状态</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {gapAnalysis.map(g => (
                        <tr key={g.dimension} className="hover:bg-muted/30 transition-colors">
                          <td className="py-2.5 pr-3 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <g.icon className="w-3.5 h-3.5 text-primary shrink-0" />
                              <span className="font-medium text-xs">{g.dimension}</span>
                            </div>
                          </td>
                          <td className="py-2.5 pr-3 text-xs text-muted-foreground whitespace-nowrap">{g.competitor}</td>
                          <td className="py-2.5 pr-3 text-xs text-muted-foreground">{g.strategy}</td>
                          <td className="py-2.5 text-center whitespace-nowrap">
                            <Badge className={`text-[10px] ${priorityColor[g.priority]}`}>{g.priority}</Badge>
                          </td>
                          <td className="py-2.5 text-center whitespace-nowrap">
                            {g.status === 'done'
                              ? <span className="text-[10px] text-emerald-600 font-medium">✅ 已完成</span>
                              : <span className="text-[10px] text-muted-foreground">⏳ 规划中</span>
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* 多智能体可视化 */}
        {activeTab === 'agent' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <MultiAgentSection />
          </motion.div>
        )}

        {/* 差异化优势 */}
        {activeTab === 'diff' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {differentiators.map((d, i) => (
                <motion.div key={d.title} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
                  <Card className={`h-full border ${d.border}`}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${d.color} flex items-center justify-center`}>
                          <d.icon className="w-5 h-5 text-primary" />
                        </div>
                        <Badge variant="secondary" className="text-xs">{d.advantage}</Badge>
                      </div>
                      <CardTitle className="text-base mt-3">{d.title}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-sm text-muted-foreground leading-relaxed text-pretty">{d.desc}</p>
                      <div>
                        <div className="flex justify-between text-xs mb-1.5">
                          <span className="text-muted-foreground">竞争优势指数</span>
                          <span className="font-semibold text-primary">{d.score}/100</span>
                        </div>
                        <Progress value={d.score} className="h-2" />
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>

            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0 mt-0.5">
                    <Star className="w-4 h-4 text-primary-foreground" />
                  </div>
                  <div>
                    <p className="font-semibold mb-1">7.4 核心竞争力定位</p>
                    <blockquote className="text-sm text-muted-foreground border-l-2 border-primary pl-3 leading-relaxed italic">
                      "国内首个多智能体透明化 AI 学习平台" —— 让 AI 辅导的每一步决策都可见、可理解、可信赖，专为高等教育学生打造。
                    </blockquote>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* 功能矩阵 */}
        {activeTab === 'matrix' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">6.3 功能优先级矩阵</CardTitle>
                <p className="text-xs text-muted-foreground">按用户价值、技术难度、差异化程度综合评分</p>
              </CardHeader>
              <CardContent>
                <div className="w-full min-w-0 overflow-hidden">
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={featureMatrix} layout="vertical" margin={{ left: 20, right: 20, top: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} />
                      <YAxis dataKey="feature" type="category" tick={{ fontSize: 10 }} width={88} />
                      <Tooltip
                        contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', fontSize: '12px' }}
                        formatter={(v: number, name: string) => [v, COMPETITOR_LABELS[name] || name]}
                      />
                      {COMPETITOR_KEYS.map(k => (
                        <Bar key={k} dataKey={k} name={k} fill={COMPETITOR_COLORS[k]} opacity={k === 'us' ? 1 : 0.5} radius={k === 'us' ? [0, 3, 3, 0] : 2} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap gap-3 mt-3 justify-center">
                  {COMPETITOR_KEYS.map(k => (
                    <div key={k} className="flex items-center gap-1.5 text-xs">
                      <div className="w-2.5 h-2.5 rounded-sm" style={{ background: COMPETITOR_COLORS[k] }} />
                      <span className={k === 'us' ? 'font-semibold text-primary' : 'text-muted-foreground'}>{COMPETITOR_LABELS[k]}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">差异化竞争建议优先级</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[500px]">
                    <thead>
                      <tr className="border-b border-border">
                        {['功能', '用户价值', '技术难度', '差异化程度', '综合优先级'].map(h => (
                          <th key={h} className="text-left pb-2 font-medium text-muted-foreground text-xs whitespace-nowrap pr-4">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {[
                        { f: '知识图谱可视化', uv: '高', td: '中', d: '高', p: 'P0', done: true },
                        { f: '苏格拉底式辅导', uv: '高', td: '低', d: '高', p: 'P0', done: true },
                        { f: '弱项强化训练',   uv: '高', td: '低', d: '中', p: 'P0', done: true },
                        { f: '代码运行沙箱',   uv: '中', td: '高', d: '高', p: 'P1', done: true },
                        { f: '拍照搜题',       uv: '中', td: '中', d: '低', p: 'P2', done: false },
                        { f: '语音答疑',       uv: '中', td: '中', d: '中', p: 'P2', done: false },
                        { f: '协作白板',       uv: '低', td: '高', d: '中', p: 'P3', done: false },
                        { f: '情绪识别',       uv: '中', td: '高', d: '高', p: 'P3', done: false },
                      ].map(r => (
                        <tr key={r.f} className="hover:bg-muted/30 transition-colors">
                          <td className="py-2 pr-4 font-medium text-xs whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              {r.done && <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />}
                              {r.f}
                            </div>
                          </td>
                          <td className="py-2 pr-4 text-xs whitespace-nowrap"><span className={r.uv === '高' ? 'text-emerald-600 font-medium' : 'text-muted-foreground'}>{r.uv}</span></td>
                          <td className="py-2 pr-4 text-xs whitespace-nowrap"><span className={r.td === '高' ? 'text-red-500' : r.td === '中' ? 'text-amber-500' : 'text-emerald-600'}>{r.td}</span></td>
                          <td className="py-2 pr-4 text-xs whitespace-nowrap"><span className={r.d === '高' ? 'text-primary font-medium' : 'text-muted-foreground'}>{r.d}</span></td>
                          <td className="py-2 whitespace-nowrap"><Badge className={`text-[10px] ${priorityColor[r.p]}`}>{r.p}</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* 战略路线图 */}
        {activeTab === 'roadmap' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {roadmap.map((phase, pi) => (
                <motion.div key={phase.phase} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: pi * 0.1 }}>
                  <Card className="h-full flex flex-col">
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl ${phase.color} flex items-center justify-center shrink-0`}>
                          <phase.icon className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <CardTitle className="text-base">{phase.phase}目标</CardTitle>
                          <p className="text-xs text-muted-foreground">{phase.period}</p>
                        </div>
                      </div>
                      <Progress
                        value={(phase.goals.filter(g => g.done).length / phase.goals.length) * 100}
                        className="h-1.5 mt-2"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        {phase.goals.filter(g => g.done).length}/{phase.goals.length} 已完成
                      </p>
                    </CardHeader>
                    <CardContent className="flex-1 space-y-2">
                      {phase.goals.map(g => (
                        <div key={g.text} className={`flex items-start gap-2 p-2 rounded-lg text-xs transition-colors ${
                          g.done ? 'bg-emerald-50 dark:bg-emerald-900/10' : 'bg-muted/30'
                        }`}>
                          {g.done
                            ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                            : <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                          }
                          <span className={g.done ? 'text-emerald-700 dark:text-emerald-300' : 'text-muted-foreground'}>{g.text}</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>

            {/* 综合战略总结 */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Compass className="w-4 h-4 text-primary" />七、总结与战略建议
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    {
                      title: '核心定位',
                      content: '专注高等教育学生，以多智能体透明化 AI 辅导为独特卖点，打造"可解释 AI 学习平台"。',
                      icon: Target, color: 'text-primary bg-primary/10',
                    },
                    {
                      title: '竞争策略',
                      content: '避开 K-12 红海，深耕大学课程场景；代码学习是最大竞争缺口，持续强化。',
                      icon: Shield, color: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/20',
                    },
                    {
                      title: '增长飞轮',
                      content: '画像越精准 → 推荐越准确 → 学习效果越好 → 用户留存越高 → 数据越丰富 → 形成壁垒。',
                      icon: TrendingUp, color: 'text-amber-600 bg-amber-100 dark:bg-amber-900/20',
                    },
                    {
                      title: '护城河',
                      content: '多智能体可视化决策链 + 6维学习画像数据 + 高校场景深度集成，构建三重护城河。',
                      icon: Star, color: 'text-violet-600 bg-violet-100 dark:bg-violet-900/20',
                    },
                  ].map(s => (
                    <div key={s.title} className="flex items-start gap-3 p-3 rounded-xl bg-muted/30">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${s.color}`}>
                        <s.icon className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold mb-0.5">{s.title}</p>
                        <p className="text-xs text-muted-foreground leading-relaxed text-pretty">{s.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

      </div>
    </AppLayout>
  );
}
