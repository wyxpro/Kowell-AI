import { useState, useEffect, useRef } from 'react';
import type * as THREE from 'three';
import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip,
} from 'recharts';
import {
  GraduationCap, Brain, Target, Zap, Star, Users, ArrowRight, CheckCircle2,
  Sparkles, BookOpen, Trophy, Code2, Network,
  MessageCircle, BarChart3, Shield, Infinity as InfinityIcon, Crown, Flame, Globe, MapPin,
  Quote, GraduationCap as GradCap, Loader2,
  Plus, Trash2, Edit, Download, Calendar, UserCheck, Play, Volume2, Info, X, ChevronRight, Activity, FileText, Award,
} from 'lucide-react';

/* ─────────────────────── 数据 ─────────────────────── */
const features = [
  {
    icon: Brain,
    title: '苏格拉底式AI辅导',
    desc: '引导思考而非直接给答案，深化理解与记忆，培养独立思维能力',
    color: 'from-violet-500/20 to-purple-500/20',
    iconColor: 'text-violet-500',
    badge: '核心特色',
    borderColor: 'border-violet-500/80',
    shadowColor: 'shadow-[0_20px_50px_rgba(139,92,246,0.18)] ring-violet-500/20',
    activeText: 'text-violet-500',
    bgImage: '/images/features/ai_tutor_bg.png',
  },
  {
    icon: Network,
    title: '知识图谱可视化',
    desc: '交互式知识体系全景图，清晰呈现概念关联，助你构建系统化知识网络',
    color: 'from-sky-500/20 to-cyan-500/20',
    iconColor: 'text-sky-500',
    badge: '独家技术',
    borderColor: 'border-sky-500/80',
    shadowColor: 'shadow-[0_20px_50px_rgba(14,165,233,0.18)] ring-sky-500/20',
    activeText: 'text-sky-500',
    bgImage: '/images/features/knowledge_graph_bg.png',
  },
  {
    icon: Target,
    title: '弱项精准强化',
    desc: '智能识别知识盲点，自动生成变式题库，反复练习直至完全掌握',
    color: 'from-rose-500/20 to-red-500/20',
    iconColor: 'text-rose-500',
    badge: '高效提升',
    borderColor: 'border-rose-500/80',
    shadowColor: 'shadow-[0_20px_50px_rgba(244,63,94,0.18)] ring-rose-500/20',
    activeText: 'text-rose-500',
    bgImage: '/images/features/weakness_bg.png',
  },
  {
    icon: Code2,
    title: '代码实验室',
    desc: '在线运行8种编程语言，AI即时代码审阅，边学边练无缝衔接',
    color: 'from-emerald-500/20 to-green-500/20',
    iconColor: 'text-emerald-500',
    badge: '编程专属',
    borderColor: 'border-emerald-500/80',
    shadowColor: 'shadow-[0_20px_50px_rgba(16,185,129,0.18)] ring-emerald-500/20',
    activeText: 'text-emerald-500',
    bgImage: '/images/features/code_lab_bg.png',
  },
  {
    icon: BarChart3,
    title: '学习画像分析',
    desc: '多维度深度分析学习行为，个性化路径推荐精准匹配你的成长节奏',
    color: 'from-amber-500/20 to-yellow-500/20',
    iconColor: 'text-amber-500',
    badge: '数据驱动',
    borderColor: 'border-amber-500/80',
    shadowColor: 'shadow-[0_20px_50px_rgba(245,158,11,0.18)] ring-amber-500/20',
    activeText: 'text-amber-500',
    bgImage: '/images/features/profile_analysis_bg.png',
  },
  {
    icon: Users,
    title: '社群协作学习',
    desc: '与志同道合的同学组队冲刺，排行榜激励机制让学习充满正向动力',
    color: 'from-pink-500/20 to-fuchsia-500/20',
    iconColor: 'text-pink-500',
    badge: '社群赋能',
    borderColor: 'border-pink-500/80',
    shadowColor: 'shadow-[0_20px_50px_rgba(236,72,153,0.18)] ring-pink-500/20',
    activeText: 'text-pink-500',
    bgImage: '/images/features/community_learning_bg.png',
  },
];

const competitorData = [
  { subject: 'AI个性化', 'Kowell AI': 95, Khan: 70, 学而思: 75, Duolingo: 60 },
  { subject: '苏格拉底式', 'Kowell AI': 92, Khan: 85, 学而思: 40, Duolingo: 35 },
  { subject: '代码实验室', 'Kowell AI': 90, Khan: 50, 学而思: 55, Duolingo: 20 },
  { subject: '知识图谱', 'Kowell AI': 95, Khan: 45, 学而思: 60, Duolingo: 30 },
  { subject: '弱项强化', 'Kowell AI': 93, Khan: 65, 学而思: 70, Duolingo: 55 },
  { subject: '社群驱动', 'Kowell AI': 85, Khan: 60, 学而思: 65, Duolingo: 90 },
];

const reviews = [
  {
    name: '陈同学',
    role: '计算机科学 大三',
    avatar: '陈',
    rating: 5,
    text: '苏格拉底模式真的改变了我的学习方式！以前总是死记硬背，现在每道题都能真正理解原理。期末考试提升了30分！',
    tag: '考试提升',
  },
  {
    name: '李同学',
    role: '人工智能 研究生',
    avatar: '李',
    rating: 5,
    text: '知识图谱功能太惊艳了，把整个AI领域的知识点都串联起来，找到了自己的学习方向，效率提升不止一倍。',
    tag: '知识体系',
  },
  {
    name: '王同学',
    role: '软件工程 大二',
    avatar: '王',
    rating: 5,
    text: '代码实验室里直接运行然后AI给出审阅意见，感觉像有了专属导师。两个月下来算法能力从入门到中级！',
    tag: '编程进步',
  },
  {
    name: '赵同学',
    role: '数据科学 大四',
    avatar: '赵',
    rating: 5,
    text: '弱项强化训练拯救了我的高等数学，系统自动找到我的痛点，针对性练习之后错误率降低了80%。',
    tag: '错误率下降',
  },
  {
    name: '张同学',
    role: '电子信息 大三',
    avatar: '张',
    rating: 5,
    text: '每周学习报告让我对自己的进度一清二楚，智能建议真的很精准。现在每天都期待打开 Kowell AI！',
    tag: '习惯养成',
  },
];

const plans = [
  {
    name: '免费版',
    price: '¥0',
    period: '/永久',
    desc: '开启个性化学习之旅',
    icon: Flame,
    color: 'from-slate-500 to-slate-600',
    features: ['AI答疑 50次/月', '学习画像基础版', '错题本无限制', '知识图谱浏览', '社群互动功能'],
    cta: '免费开始',
    highlight: false,
  },
  {
    name: '专业版',
    price: '¥29',
    period: '/月',
    desc: '解锁全部进阶功能',
    icon: Crown,
    color: 'from-primary to-emerald-500',
    features: ['AI答疑 无限次', '苏格拉底式辅导', '代码实验室全功能', '弱项强化训练', '知识图谱编辑', '学习报告深度版', '优先客服支持'],
    cta: '立即升级',
    highlight: true,
  },
  {
    name: '团队版',
    price: '¥199',
    period: '/月/10人',
    desc: '适合班级与团队协作',
    icon: Globe,
    color: 'from-violet-500 to-purple-600',
    features: ['包含专业版全部功能', '团队学习看板', '教师管理后台', '自定义知识图谱', '专属客户成功', '数据导出与分析'],
    cta: '联系我们',
    highlight: false,
  },
];

const userProfiles = [
  {
    icon: GradCap,
    color: 'from-violet-500 to-purple-600',
    glow: 'shadow-violet-500/25',
    title: '备考学生',
    desc: '高考/考研冲刺精准补弱，AI量身制定突破计划',
    tags: ['高考冲刺', '考研备战', '弱项强化'],
  },
  {
    icon: Code2,
    color: 'from-sky-500 to-cyan-600',
    glow: 'shadow-sky-500/25',
    title: '编程新手',
    desc: '从零到精通，代码实验室边学边练，即时反馈',
    tags: ['代码实验室', 'AI审阅', '8种语言'],
  },
  {
    icon: Brain,
    color: 'from-emerald-500 to-teal-600',
    glow: 'shadow-emerald-500/25',
    title: '知识系统化',
    desc: '知识图谱可视化，构建完整学科体系与认知框架',
    tags: ['知识图谱', '体系构建', '关联分析'],
  },
  {
    icon: Trophy,
    color: 'from-amber-500 to-orange-600',
    glow: 'shadow-amber-500/25',
    title: '竞赛选手',
    desc: '深度专项强化训练，目标精准突破竞赛瓶颈',
    tags: ['深度强化', '专项训练', '极限突破'],
  },
  {
    icon: Users,
    color: 'from-rose-500 to-pink-600',
    glow: 'shadow-rose-500/25',
    title: '团队协作',
    desc: '班级学习看板 + 教师管理后台，协同高效进步',
    tags: ['团队看板', '教师管理', '协作共进'],
  },
  {
    icon: BarChart3,
    color: 'from-indigo-500 to-blue-600',
    glow: 'shadow-indigo-500/25',
    title: '效率提升者',
    desc: '用数据驱动学习决策，每周深度报告精准洞察',
    tags: ['学习报告', '数据洞察', '效率最大化'],
  },
];

const stats = [
  { value: '50,000+', label: '活跃学习者' },
  { value: '98%', label: '用户满意度' },
  { value: '2.5x', label: '平均学习效率提升' },
  { value: '8', label: '支持编程语言' },
];

/* ─────────────────────── 交互式多智能体玻璃态 Hero 背景 ─────────────────────── */
function HeroBackground() {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({
        x: (e.clientX / window.innerWidth - 0.5) * 2,
        y: (e.clientY / window.innerHeight - 0.5) * 2,
      });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden bg-gradient-to-b from-background via-background/95 to-background z-0">
      {/* 1. 科技感网格背景 */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)]" />

      {/* 2. 底层发光的霓虹渐变球 */}
      <motion.div
        animate={{
          x: [0, 50, -30, 0],
          y: [0, -40, 30, 0],
        }}
        transition={{
          duration: 15,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute top-1/4 left-1/4 w-[380px] h-[380px] rounded-full bg-primary/10 blur-[90px] pointer-events-none"
      />
      <motion.div
        animate={{
          x: [0, -40, 40, 0],
          y: [0, 50, -30, 0],
        }}
        transition={{
          duration: 18,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute bottom-1/4 right-1/4 w-[420px] h-[420px] rounded-full bg-emerald-500/8 blur-[100px] pointer-events-none"
      />
      <motion.div
        animate={{
          x: [0, 30, -40, 0],
          y: [0, 40, 40, 0],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute top-1/3 right-1/3 w-[320px] h-[320px] rounded-full bg-purple-500/8 blur-[90px] pointer-events-none"
      />


    </div>
  );
}

/* ─────────────────────── 评价轮播 ─────────────────────── */
/* 单张评价卡片 */
function ReviewCard({ review }: { review: typeof reviews[0] }) {
  const avatarColors = [
    'from-violet-500 to-purple-600',
    'from-sky-500 to-cyan-600',
    'from-emerald-500 to-teal-600',
    'from-amber-500 to-orange-600',
    'from-rose-500 to-pink-600',
    'from-indigo-500 to-blue-600',
  ];
  const colorIdx = review.name.charCodeAt(0) % avatarColors.length;
  return (
    <div className="w-72 shrink-0 rounded-2xl border border-border/60 bg-card/90 backdrop-blur-sm shadow-md p-5 mx-2 select-none">
      <div className="flex items-start gap-3 mb-3">
        <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${avatarColors[colorIdx]} flex items-center justify-center shrink-0 text-white font-bold text-sm shadow-md`}>
          {review.avatar}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold text-sm">{review.name}</span>
            <span className="text-[11px] text-muted-foreground">{review.role}</span>
          </div>
          <div className="flex mt-0.5 gap-0.5">
            {[...Array(review.rating)].map((_, i) => (
              <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />
            ))}
          </div>
        </div>
        <Quote className="w-5 h-5 text-primary/30 shrink-0" />
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed text-pretty mb-3">
        {review.text}
      </p>
      <Badge variant="secondary" className="text-[10px] px-2 py-0.5">{review.tag}</Badge>
    </div>
  );
}

/* 无限滚动行 */
function MarqueeRow({ items, direction = 'left', speed = 28 }: {
  items: typeof reviews;
  direction?: 'left' | 'right';
  speed?: number;
}) {
  const CARD_W = 304; // 288px card + 2*8px mx
  // 增加复制份数，确保即使在超宽屏幕（如 4K）上也始终填满、无空白区
  const repeatCount = Math.max(6, Math.ceil(4800 / (items.length * CARD_W)));
  const repeated = Array(repeatCount).fill(items).flat();

  const pausedRef = useRef(false);
  const posRef = useRef(0);
  const rafRef = useRef(0);
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const totalW = items.length * CARD_W;
    const step = direction === 'left' ? -speed / 60 : speed / 60;
    if (direction === 'right') {
      posRef.current = -totalW;
    } else {
      posRef.current = 0;
    }
    const animate = () => {
      if (!pausedRef.current) {
        posRef.current += step;
        if (posRef.current <= -totalW) posRef.current += totalW;
        if (posRef.current >= 0) posRef.current -= totalW;
        if (rowRef.current) rowRef.current.style.transform = `translateX(${posRef.current}px)`;
      }
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [direction, speed, items.length]);

  return (
    <div
      className="overflow-hidden py-4 -my-4"
      onMouseEnter={() => { pausedRef.current = true; }}
      onMouseLeave={() => { pausedRef.current = false; }}
    >
      <div ref={rowRef} className="flex py-2" style={{ willChange: 'transform' }}>
        {repeated.map((r, i) => <ReviewCard key={i} review={r} />)}
      </div>
    </div>
  );
}

function ReviewCarousel() {
  const row1 = reviews.slice(0, Math.ceil(reviews.length / 2));
  const row2 = reviews.slice(Math.ceil(reviews.length / 2));
  // 补足偶数以视觉均衡
  const fill = reviews[0];
  const r2 = row2.length < 3 ? [...row2, fill, fill] : row2;
  return (
    <div className="space-y-4 overflow-hidden">
      <MarqueeRow items={row1} direction="left" speed={26} />
      <MarqueeRow items={r2} direction="right" speed={22} />
    </div>
  );
}

/* ─────────────────────── 浮动卡片 3D ─────────────────────── */
function FloatingCard({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay }}
      whileHover={{ y: -6, rotateX: 2, rotateY: -1 }}
      style={{ transformStyle: 'preserve-3d' }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

const renderMockup = (type: string) => {
  switch (type) {
    case '苏格拉底式AI辅导':
      return (
        <div className="bg-zinc-950/90 rounded-lg p-2 font-mono text-[9px] border border-border/40 space-y-1.5 min-h-[90px] flex flex-col justify-center">
          <div className="flex items-center gap-1.5 text-zinc-500 pb-1 border-b border-border/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Socrates AI Tutor</span>
          </div>
          <div className="text-violet-400 bg-violet-500/10 p-1.5 rounded">
            "这个推导步骤可以再想想吗？如果引入拉格朗日乘子..."
          </div>
          <div className="text-zinc-300 pl-4">
            &gt; "哦！乘子可以把约束条件转化为目标项。"
          </div>
        </div>
      );
    case '知识图谱可视化':
      return (
        <div className="bg-zinc-950/90 rounded-lg p-2 border border-border/40 min-h-[90px] relative overflow-hidden flex flex-col justify-center items-center">
          <svg className="w-full h-12 opacity-60 absolute inset-0" viewBox="0 0 100 50">
            <line x1="20" y1="25" x2="50" y2="10" stroke="currentColor" strokeWidth="0.8" className="text-sky-500" />
            <line x1="20" y1="25" x2="50" y2="40" stroke="currentColor" strokeWidth="0.8" className="text-sky-500" />
            <line x1="50" y1="10" x2="80" y2="25" stroke="currentColor" strokeWidth="0.8" className="text-sky-500" />
            <circle cx="20" cy="25" r="2.5" className="fill-sky-500 animate-pulse" />
            <circle cx="50" cy="10" r="3" className="fill-indigo-500" />
            <circle cx="50" cy="40" r="3" className="fill-emerald-500" />
            <circle cx="80" cy="25" r="2.5" className="fill-sky-500" />
          </svg>
          <span className="text-[9px] text-sky-400 font-semibold bg-sky-500/10 px-1.5 py-0.5 rounded border border-sky-500/20 z-10">
            关联度: 94.2%
          </span>
        </div>
      );
    case '弱项精准强化':
      return (
        <div className="bg-zinc-950/90 rounded-lg p-2.5 border border-border/40 min-h-[90px] flex flex-col justify-center gap-1.5">
          <div className="flex justify-between items-center text-[10px]">
            <span className="text-zinc-400">弱项: 动态规划</span>
            <span className="text-rose-400 font-bold bg-rose-500/10 px-1 py-0.2 rounded">+35% 效率</span>
          </div>
          <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
            <div className="bg-gradient-to-r from-rose-500 to-pink-500 h-full rounded-full w-[82%]" />
          </div>
          <div className="text-[9px] text-zinc-500">建议练习：0-1 背包问题专项</div>
        </div>
      );
    case '代码实验室':
      return (
        <div className="bg-zinc-950/90 rounded-lg p-2 font-mono text-[9px] border border-border/40 min-h-[90px] flex flex-col justify-center">
          <div className="text-emerald-400">
            <span className="text-zinc-600">1</span> def evaluate(code):<br />
            <span className="text-zinc-600">2</span> &nbsp;&nbsp;&nbsp;&nbsp;return "Pass"
          </div>
          <div className="mt-1.5 pt-1.5 border-t border-border/20 flex justify-between text-[8px] text-zinc-500">
            <span>Compiler: Success</span>
            <span className="text-emerald-500">✓ Pass</span>
          </div>
        </div>
      );
    case '学习画像分析':
      return (
        <div className="bg-zinc-950/90 rounded-lg p-2.5 border border-border/40 min-h-[90px] flex flex-col justify-center gap-1.5">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-zinc-400">画像生成中...</span>
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
          </div>
          <div className="grid grid-cols-2 gap-1.5 text-[9px]">
            <div className="bg-zinc-900 p-1.5 rounded text-zinc-300">效率: 2.5x</div>
            <div className="bg-zinc-900 p-1.5 rounded text-zinc-300">满意度: 98%</div>
          </div>
        </div>
      );
    case '社群协作学习':
      return (
        <div className="bg-zinc-950/90 rounded-lg p-2 border border-border/40 min-h-[90px] flex flex-col justify-center gap-1.5">
          <div className="flex items-center justify-between text-[9px] text-zinc-400">
            <span>已选 2 个社区</span>
            <span className="text-pink-400 bg-pink-500/10 px-1 rounded">3.1k 热度</span>
          </div>
          <div className="text-[9px] text-zinc-300 truncate">
            🏫 考研备考圈 | AI 学习圈
          </div>
        </div>
      );
    default:
      return null;
  }
};

/* ─────────────────────── Hero 交互式动效组件 ─────────────────────── */
function HeroInteractiveVisual() {
  const [activeStep, setActiveStep] = useState(1);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveStep((prev) => (prev % 3) + 1);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  const steps = [
    { id: 1, title: '01 变量与内存模型', status: 'completed' },
    { id: 2, title: '02 双指针与二分搜索', status: 'active' },
    { id: 3, title: '03 动态规划专项强化', status: 'locked' }
  ];

  return (
    <div className="relative w-full max-w-[460px] aspect-[1.05/1] flex items-center justify-center select-none py-6">
      
      {/* 科技霓虹发光背板 */}
      <div className="absolute -top-10 -left-10 w-64 h-64 rounded-full bg-primary/10 blur-[80px] pointer-events-none" />
      <div className="absolute -bottom-10 -right-10 w-64 h-64 rounded-full bg-emerald-500/10 blur-[80px] pointer-events-none" />

      {/* Layer 1: Core Dashboard (主学区面板) */}
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.8 }}
        className="w-full bg-card/65 backdrop-blur-xl border border-border/80 rounded-3xl shadow-[0_30px_70px_rgba(0,0,0,0.12)] flex flex-col overflow-hidden h-[330px]"
      >
        {/* 面板伪标题栏 */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-muted/40 border-b border-border/40">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-400/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-400/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/80" />
          </div>
          <div className="text-[10px] font-medium text-muted-foreground bg-background/50 px-3.5 py-0.5 rounded-full border border-border/40 flex items-center gap-1">
            <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
            kowell-ai.com/classroom
          </div>
          <div className="w-8" />
        </div>

        {/* 主体工作区 */}
        <div className="flex flex-1 overflow-hidden">
          {/* 左侧：个性化学习路径导航 */}
          <div className="w-[45%] border-r border-border/40 p-3.5 flex flex-col gap-2.5 bg-muted/15">
            <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">
              Personalized Path
            </div>
            <div className="space-y-2 flex-1">
              {steps.map((s) => {
                const isCompleted = s.status === 'completed';
                const isActive = s.id === activeStep;
                return (
                  <div
                    key={s.id}
                    className={`p-2 rounded-xl border text-[10.5px] flex items-center gap-2 transition-all duration-300 ${
                      isCompleted
                        ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                        : isActive
                        ? 'bg-primary/5 border-primary/20 text-primary font-medium shadow-sm ring-1 ring-primary/10'
                        : 'bg-zinc-500/5 border-transparent text-muted-foreground opacity-55'
                    }`}
                  >
                    <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] shrink-0 ${
                      isCompleted
                        ? 'bg-emerald-500 text-white'
                        : isActive
                        ? 'bg-primary text-primary-foreground animate-pulse'
                        : 'bg-zinc-800 text-zinc-400'
                    }`}>
                      {isCompleted ? '✓' : s.id}
                    </div>
                    <span className="truncate">{s.title}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 右侧：代码实验室 */}
          <div className="flex-1 p-3.5 flex flex-col bg-background/40">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[9px] font-mono text-muted-foreground">socrates_practice.py</span>
              <span className="text-[8px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.2 rounded border border-emerald-500/20 font-medium">
                ✓ 运行通过
              </span>
            </div>
            <div className="flex-1 font-mono text-[10px] bg-muted/40 rounded-xl p-3 border border-border/30 text-muted-foreground leading-relaxed overflow-hidden">
              <span className="text-blue-500">def</span> <span className="text-yellow-500">find_target</span>(nums, val):<br />
              &nbsp;&nbsp;&nbsp;&nbsp;left, right = <span className="text-purple-500">0</span>, len(nums) - <span className="text-purple-500">1</span><br />
              &nbsp;&nbsp;&nbsp;&nbsp;<span className="text-blue-500">while</span> left &lt;= right:<br />
              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;mid = (left + right) // <span className="text-purple-500">2</span><br />
              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-zinc-500"># AI 辅导提示: 缩小区间...</span>
            </div>
          </div>
        </div>
      </motion.div>

    </div>
  );
}

export default function LandingPage() {
  const [activeIndex, setActiveIndex] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % 6);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Gamification State
  const [streakChecked, setStreakChecked] = useState(false);
  const [streakCount, setStreakCount] = useState(4);

  // Simulator State
  const [activeTab, setActiveTab] = useState(0);
  const [isSimulating, setIsSimulating] = useState(false);
  const [collabStatus, setCollabStatus] = useState("就绪。点击右侧按钮模拟完整的“画像诊断-路径规划-资源生成-代码纠错-综合评估”协作流程。");
  const [voiceActive, setVoiceActive] = useState(false);
  const [socratesChat, setSocratesChat] = useState([
    { role: 'ai', content: '您好！我是您的 Socrates 教学助理。听说您打算深入学习人工智能与数据结构？在开始之前，我想先了解一下，您以前用 C++ 或 Python 独立编写过最复杂的程序是什么？大概有多少行代码？' },
    { role: 'user', content: '我以前只学过一些基础的 Python，写过一个 100 行左右的学生管理系统，没接触过复杂的算法。' },
    { role: 'ai', content: '非常好，100行的学生管理系统是一个扎实的起点！这说明你已经掌握了变量、条件分支和基本的文件/列表操作。那么，当你听到“二叉树”或“链表”这些词时，你的脑海中会浮现出怎样的物理模型？你会如何尝试用 Python 的列表或字典去表示它们？' }
  ]);
  const [selectedNode, setSelectedNode] = useState(2);
  const [nodeData, setNodeData] = useState({
    title: '树与二叉树',
    status: '进行中',
    desc: '系统诊断推荐学习节点。研究二叉树的递归与非递归遍历。双击此节点将自动并发生成相关讲义大纲。'
  });
  const [simulatorResources, setSimulatorResources] = useState([
    { 
      id: 1, 
      title: "二叉树深度遍历讲义.md", 
      date: "2026-06-18 10:12", 
      size: "4.2 KB",
      content: "### 二叉树的三种深度遍历算法\n\n二叉树是以递归方式定义的数据结构，因此遍历也主要以递归实现为主。\n\n1. **先序遍历 (Pre-order)**: 根 -> 左 -> 右\n2. **中序遍历 (In-order)**: 左 -> 根 -> 右 (对于二叉搜索树，中序遍历结果即为有序序列)\n3. **后序遍历 (Post-order)**: 左 -> 右 -> 根\n\n```python\ndef inorderTraversal(root):\n    if not root:\n        return []\n    return inorderTraversal(root.left) + [root.val] + inorderTraversal(root.right)\n```"
    },
    { 
      id: 2, 
      title: "双向循环链表实操代码.cpp", 
      date: "2026-06-19 09:45", 
      size: "8.5 KB",
      content: "/* 双向循环链表的插入与删除 */\n#include <iostream>\nusing namespace std;\n\nstruct Node {\n    int data;\n    Node* prev;\n    Node* next;\n    Node(int val) : data(val), prev(nullptr), next(nullptr) {}\n};\n\nvoid insertAtHead(Node*& head, int val) {\n    Node* newNode = new Node(val);\n    if(!head) {\n        head = newNode;\n        head->next = head;\n        head->prev = head;\n        return;\n    }\n    Node* tail = head->prev;\n    newNode->next = head;\n    newNode->prev = tail;\n    tail->next = newNode;\n    head->prev = newNode;\n    head = newNode;\n}"
    },
    { 
      id: 3, 
      title: "阶段性画像诊断报告.json", 
      date: "2026-06-19 12:00", 
      size: "1.2 KB",
      content: "{\n  \"portrait_id\": \"port_8832a\",\n  \"user_id\": \"usr_admin\",\n  \"dimensions\": {\n    \"theory_foundation\": 85,\n    \"practical_coding\": 62,\n    \"problem_deconstruction\": 74,\n    \"logic_inference\": 90,\n    \"learning_grit\": 88,\n    \"knowledge_breadth\": 55\n  },\n  \"dominant_learning_style\": \"逻辑主导型 / 动手欠缺者\",\n  \"custom_adjustments\": \"建议缩短理论视频时长，增加Monaco沙箱编码与变式纠错训练。\"\n}"
    }
  ]);
  const [selectedResId, setSelectedResId] = useState(1);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newTitle, setNewTitle] = useState("二叉平衡树的核心旋转原理");
  const [newOpts, setNewOpts] = useState({ outline: true, mindmap: true, exercises: true, code: false });
  const [simulatorLogs, setSimulatorLogs] = useState([
    { time: "12:00:01", tag: "profile", msg: "画像智能体检测到用户登录。开始监听苏格拉底多轮问答对话..." },
    { time: "12:00:15", tag: "profile", msg: "多轮对话完成，已生成最新用户6维认知画像分值 JSON，写入 user_profiles 物理表。" },
    { time: "12:00:16", tag: "planner", msg: "路径智能体加载 6 维画像底牌，计算专业 DAG 依存度，重新渲染有向无环学习拓扑。" }
  ]);
  const [radarLevels, setRadarLevels] = useState([85, 62, 74, 90, 88, 55]);

  const addSimulatorLog = (tag: string, msg: string) => {
    const time = new Date().toTimeString().split(' ')[0];
    setSimulatorLogs(prev => {
      const updated = [...prev, { time, tag, msg }];
      if (updated.length > 25) updated.shift();
      return updated;
    });
  };

  const [speechTimer, setSpeechTimer] = useState<any>(null);
  const triggerVoiceSpeak = () => {
    if (speechTimer) {
      clearTimeout(speechTimer);
      setSpeechTimer(null);
      setVoiceActive(false);

      setSocratesChat(prev => [...prev, { role: 'user', content: '我想先学二叉树的深度遍历，因为明天有一场算法小测。' }]);
      addSimulatorLog("profile", "收到用户语音指令，识别文本：'我想先学二叉树深度遍历...'" );

      setTimeout(() => {
        setSocratesChat(prev => [...prev, {
          role: 'ai',
          content: '明天的测验确实很关键！那我们直接锁定二叉树深度递归。你知道二叉树中序遍历的递归终止条件为什么是 if root is None 吗？如果我们在底层不加这一句限制，程序在运行时会出现什么内存问题？'
        }]);
        addSimulatorLog("profile", "苏格拉底AI生成启发性应答，激活语音合成（MiniMax TTS）并发回前端。" );
      }, 1500);
    } else {
      setVoiceActive(true);
      addSimulatorLog("profile", "语音引擎启动，开始监听输入音频..." );
      const timer = setTimeout(() => {
        setVoiceActive(false);
        setSpeechTimer(null);
        setSocratesChat(prev => [...prev, { role: 'user', content: '我想先学二叉树的深度遍历，因为明天有一场算法小测。' }]);
        addSimulatorLog("profile", "收到用户语音指令，识别文本：'我想先学二叉树深度遍历...'" );

        setTimeout(() => {
          setSocratesChat(prev => [...prev, {
            role: 'ai',
            content: '明天的测验确实很关键！那我们直接锁定二叉树深度递归。你知道二叉树中序遍历的递归终止条件为什么是 if root is None 吗？如果我们在底层不加这一句限制，程序在运行时会出现什么内存问题？'
          }]);
          addSimulatorLog("profile", "苏格拉底AI生成启发性应答，激活语音合成（MiniMax TTS）并发回前端。" );
        }, 1500);
      }, 3000);
      setSpeechTimer(timer);
    }
  };

  const handleCheckin = () => {
    if (streakChecked) return;
    setStreakChecked(true);
    setStreakCount(prev => prev + 1);
    addSimulatorLog("eval", `触发打卡流水检测。写入 user_check_ins，获取打卡积分，当前 Streak: ${streakCount + 1}天。`);
  };

  const handleNodeClick = (nodeId: number, title: string, status: string, desc: string) => {
    setSelectedNode(nodeId);
    setNodeData({ title, status, desc });
    addSimulatorLog("planner", `用户交互点击路线图节点: [${title}]。当前状态: ${status}。`);
  };

  const selectResource = (id: number) => {
    setSelectedResId(id);
  };

  const renameResource = (id: number) => {
    const res = simulatorResources.find(r => r.id === id);
    if (!res) return;
    const newName = prompt("请输入新的资源文件名：", res.title);
    if (newName) {
      setSimulatorResources(prev => prev.map(r => r.id === id ? { ...r, title: newName, date: new Date().toISOString().replace('T', ' ').slice(0, 16) } : r));
      addSimulatorLog("resource", `物理库资源 ${id} 重命名为: ${newName}`);
    }
  };

  const deleteResource = (id: number) => {
    if (confirm("确定要删除这篇生成的 AI 资源讲义吗？此操作无法撤销。")) {
      setSimulatorResources(prev => prev.filter(r => r.id !== id));
      if (selectedResId === id) {
        const remaining = simulatorResources.filter(r => r.id !== id);
        setSelectedResId(remaining[0]?.id || 0);
      }
      addSimulatorLog("resource", `彻底擦除 resources 表中 id=${id} 的行记录，保证安全合规。`);
    }
  };

  const exportResource = (title: string) => {
    alert(`已成功通过 docx/pptxgenjs 导出标准格式的本地文档：${title}`);
    addSimulatorLog("resource", `用户导出本地文件：${title}`);
  };

  const createNewResourceSubmit = () => {
    const title = newTitle || "未命名大纲.md";
    setShowNewModal(false);

    const newId = Date.now();
    setSimulatorResources(prev => [
      ...prev,
      {
        id: newId,
        title: title + ".md",
        date: "生成中...",
        size: "计算中...",
        content: `正在调用 Claude-3.5-Sonnet 并发生成【${title}】的系统大纲与题目资源...\n\n`
      }
    ]);
    setSelectedResId(newId);

    addSimulatorLog("resource", `触发并发资源生成引擎。参数：主题='${title}', 讲义=${newOpts.outline}, 思维导图=${newOpts.mindmap}, 测验题=${newOpts.exercises}`);

    let progress = 0;
    const streamText = `### ${title}\n\n[多智能体协作：Claude-3.5 流式回传中]\n\n` + 
                       `#### 一、核心概念定义\n` +
                       `二叉平衡树 (AVL Tree) 是一种自平衡二叉搜索树。任意节点的左右两个子树的高度差（平衡因子）最大为 1。\n\n` + 
                       `#### 二、单向旋转调整 (LL / RR)\n` +
                       `当插入新节点导致不平衡时，需对受影响节点进行单向旋转复位，使得左右高度差归零。\n\n` +
                       `#### 三、精选随堂练习\n` +
                       `* 练习 1：若AVL树高度为 4，最少包含多少个节点？（答案：7）\n` +
                       `* 练习 2：简述左右双旋 (LR) 调整的两个阶段操作。`;
    
    const interval = setInterval(() => {
      setSimulatorResources(prev => {
        const exists = prev.find(r => r.id === newId);
        if (!exists) {
          clearInterval(interval);
          return prev;
        }

        progress += 30;
        if (progress >= streamText.length) {
          clearInterval(interval);
          addSimulatorLog("resource", `[${title}.md] 流式生成完毕。成功写入 PostgreSQL 物理表并开启 RLS 策略。`);
          return prev.map(r => r.id === newId ? {
            ...r,
            content: streamText,
            date: new Date().toISOString().replace('T', ' ').slice(0, 16),
            size: "2.8 KB"
          } : r);
        } else {
          return prev.map(r => r.id === newId ? {
            ...r,
            content: streamText.slice(0, progress) + " █ [流式传输中...]"
          } : r);
        }
      });
    }, 50);
  };

  const simulateFullWorkflow = () => {
    if (isSimulating) return;
    setIsSimulating(true);
    
    setActiveTab(0);
    setCollabStatus("运行中：Socrates Image画像诊断智能体正在处理用户历史问答...");
    addSimulatorLog("profile", "🤖 开始运行画像诊断多轮协作...");
    
    setTimeout(() => {
      setActiveTab(1);
      setCollabStatus("运行中：Planner Agent依据画像评估，动态规划有向无环依赖图 (DAG)...");
      handleNodeClick(2, '非线性探索: 树与二叉树', '进行中', '因先前Python沙箱表现不佳，规划器在此推荐学习递归二叉树。');
      
      setTimeout(() => {
        setActiveTab(2);
        setCollabStatus("运行中：Resource Agent拉起 Claude-3.5-Sonnet 并发流式生成平衡旋转教讲...");
        
        const customTitle = "二叉平衡树的核心旋转原理";
        const newId = 99;
        setSimulatorResources(prev => [
          ...prev,
          {
            id: newId,
            title: customTitle + ".md",
            date: "生成中...",
            size: "计算中...",
            content: "### AVL树旋转原理\n\n[正在流式生成中...]"
          }
        ]);
        setSelectedResId(newId);

        setTimeout(() => {
          const AVLcontent = `### AVL树旋转原理\n\n自平衡二叉搜索树通过 **左旋 (Left Rotate)** 和 **右旋 (Right Rotate)** 调节其高度。\n\n#### 1. 左旋 LL 调节\n若右子树过高导致不平衡，则将右子树提拔为根，旧根旋转为新根的左子树。\n\n#### 2. 右旋 RR 调节\n若左子树过高导致不平衡，则相反。\n\n#### 3. 典型习题与代码验证\n请在下一节【代码实验室】中尝试编写其递归旋转代码。`;
          setSimulatorResources(prev => prev.map(r => r.id === newId ? {
            ...r,
            content: AVLcontent,
            date: new Date().toISOString().replace('T', ' ').slice(0, 16),
            size: "1.5 KB"
          } : r));
          addSimulatorLog("resource", "二叉平衡树核心旋转大纲流式并发推送完成。");

          setTimeout(() => {
            setActiveTab(3);
            setCollabStatus("运行中：Coder Agent启动，监测 Monaco 编辑器中的代码逻辑，DeepSeek 提供审查...");
            addSimulatorLog("coder", "Monaco 实验室接收到 Python 类 AVL 树代码。拉起 DeepSeek-Coder-V2 检查...");
            addSimulatorLog("coder", "在第 12 行检测到 O(N) 递归递归深度堆栈隐患，成功吐出 Inline 改错气泡。");

            setTimeout(() => {
              setActiveTab(4);
              setCollabStatus("运行中：Evaluation Agent收集所有行为指标，由 Claude 生成学业周报大盘...");
              addSimulatorLog("eval", "综合收集：4轮问答、AVL树资源学习时间、Monaco代码改错耗时。启动雷达核验...");
              
              setRadarLevels([92, 70, 78, 93, 90, 60]);
              addSimulatorLog("eval", "学业雷达指标已全面回传，已完成画像分值动态自适应进化！");

              setTimeout(() => {
                setIsSimulating(false);
                setCollabStatus("模拟联动结束。数据底盘已同步进化。可切换 Tab 自主审查成果。");
                setActiveTab(5);
              }, 2000);
            }, 2000);
          }, 2500);
        }, 2000);
      }, 2000);
    }, 2000);
  };

  const computeRadarPoints = (levels: number[]) => {
    const r = 120;
    const cos30 = 0.866;
    const sin30 = 0.5;
    
    const p0 = [150, 150 - r * (levels[0] / 100)];
    const p1 = [150 + r * cos30 * (levels[1] / 100), 150 - r * sin30 * (levels[1] / 100)];
    const p2 = [150 + r * cos30 * (levels[2] / 100), 150 + r * sin30 * (levels[2] / 100)];
    const p3 = [150, 150 + r * (levels[3] / 100)];
    const p4 = [150 - r * cos30 * (levels[4] / 100), 150 + r * sin30 * (levels[4] / 100)];
    const p5 = [150 - r * cos30 * (levels[5] / 100), 150 - r * sin30 * (levels[5] / 100)];
    
    return `${p0[0]},${p0[1]} ${p1[0]},${p1[1]} ${p2[0]},${p2[1]} ${p3[0]},${p3[1]} ${p4[0]},${p4[1]} ${p5[0]},${p5[1]}`;
  };

  const [activeCompetitor, setActiveCompetitor] = useState<string | null>(null);
  const competitorNames = ['Kowell AI', 'Khan', '学而思', 'Duolingo'];
  const competitorColors = ['hsl(162,63%,45%)', 'hsl(220,70%,55%)', 'hsl(36,80%,52%)', 'hsl(0,70%,55%)'];

  const radarData = competitorData.map(d => {
    const obj: Record<string, string | number> = { subject: d.subject };
    if (!activeCompetitor || activeCompetitor === 'Kowell AI') obj['Kowell AI'] = d['Kowell AI'];
    if (!activeCompetitor || activeCompetitor === 'Khan') obj['Khan'] = d['Khan'];
    if (!activeCompetitor || activeCompetitor === '学而思') obj['学而思'] = d['学而思'];
    if (!activeCompetitor || activeCompetitor === 'Duolingo') obj['Duolingo'] = d['Duolingo'];
    return obj;
  });

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* ─── 顶部导航 ─── */}
      <motion.header
        className={`fixed top-0 left-0 right-0 z-50 py-4 backdrop-blur-md transition-all duration-300 ${
          scrolled ? 'bg-background/40 border-b border-border/20 shadow-sm' : 'bg-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto w-full px-4 md:px-8 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group pl-2 md:pl-8">
            <motion.div
              whileHover={{ rotate: 360 }}
              transition={{ duration: 0.6 }}
              className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-lg"
            >
              <GraduationCap className="w-5 h-5 text-primary-foreground" />
            </motion.div>
            <span className="font-bold text-xl text-foreground tracking-tight">Kowell AI</span>
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-base font-semibold">
            {['特色功能', '竞品分析', '用户评价', '会员计划'].map(label => (
              <a
                key={label}
                href={`#${label}`}
                className="text-foreground/70 hover:text-foreground transition-colors"
              >
                {label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-4">
            <Button variant="ghost" asChild className="hidden md:inline-flex text-base font-semibold">
              <Link to="/login">登录</Link>
            </Button>
            <Button asChild className="shadow-lg text-base font-semibold px-5 py-2">
              <Link to="/login">
                <Zap className="w-4.5 h-4.5 mr-2" />立即使用
              </Link>
            </Button>
          </div>
        </div>
      </motion.header>

      {/* ─── Hero Section ─── */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-28 pb-16 lg:pb-0">
        <HeroBackground />
        
        <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-8 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Left Column: Text & Buttons */}
            <div className="lg:col-span-7 flex flex-col items-center lg:items-start text-center lg:text-left">
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
              >
                <Badge className="mb-6 px-4 py-1.5 text-sm gap-2 bg-primary/15 text-primary border-primary/30">
                  <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                  多智能体个性化学习系统
                </Badge>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.9, delay: 0.1 }}
                className="text-4xl md:text-6xl xl:text-7xl font-bold mb-6 leading-tight text-balance"
              >
                <span className="bg-clip-text text-transparent"
                  style={{ backgroundImage: 'linear-gradient(135deg, hsl(162,63%,38%), hsl(180,55%,42%), hsl(220,60%,55%))' }}>
                  智能学习
                </span>
                <br />
                <span className="text-foreground">精准成长</span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
                className="text-lg md:text-xl text-muted-foreground mb-10 max-w-xl lg:mx-0 mx-auto leading-relaxed text-pretty"
              >
                基于苏格拉底式AI辅导、知识图谱可视化与弱项精准强化，
                为每位学习者构建专属的个性化学业提升路径。
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.3 }}
                className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start items-center w-full sm:w-auto"
              >
                <Button size="lg" asChild className="w-full sm:w-44 shadow-xl h-12 text-base">
                  <Link to="/login">
                    <Zap className="w-5 h-5 mr-2" />立即开始使用
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild className="w-full sm:w-36 h-12 text-base bg-background/10 backdrop-blur-sm">
                  <a href="#特色功能">
                    了解更多<ArrowRight className="w-4 h-4 ml-2" />
                  </a>
                </Button>
              </motion.div>

              {/* 统计数据 */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.5 }}
                className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-16 w-full max-w-2xl"
              >
                {stats.map((s, i) => (
                  <motion.div
                    key={i}
                    whileHover={{ scale: 1.05 }}
                    className="p-4 rounded-2xl bg-background/60 backdrop-blur-md border border-border/50 text-center shadow-lg"
                  >
                    <div className="text-2xl font-bold text-primary">{s.value}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
                  </motion.div>
                ))}
              </motion.div>
            </div>

            {/* Right Column: Interactive Visual */}
            <div className="lg:col-span-5 relative w-full flex items-center justify-center mt-12 lg:mt-0">
              <HeroInteractiveVisual />
            </div>

          </div>
        </div>
      </section>




      {/* ─── 特色功能 3D 轮播图 ─── */}
      <section id="特色功能" className="py-24 px-4 overflow-hidden relative bg-transparent">
        {/* Deleted previous background to make this area completely clean */}

        <div className="max-w-6xl mx-auto px-4 mb-16 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center"
          >
            <Badge className="mb-4 bg-primary/10 text-primary border-primary/25 px-3 py-1 text-xs">差异化优势</Badge>
            <h2 className="text-3xl md:text-5xl font-extrabold mb-4 tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground via-foreground/90 to-foreground/80">
              六大核心特色功能
            </h2>
            <p className="text-muted-foreground text-sm max-w-xl mx-auto leading-relaxed">
              每个功能都针对学习中的核心痛点精心设计，助你突破瓶颈
            </p>
          </motion.div>
        </div>

        {/* Accordion Stage */}
        <div className="relative max-w-6xl mx-auto px-4 py-8 z-10 w-full">
          <div className="flex flex-col md:flex-row gap-4 items-stretch h-[650px] md:h-[500px] w-full">
            {features.map((f, idx) => {
              const isActive = activeIndex === idx;

              return (
                <div
                  key={idx}
                  onMouseEnter={() => setActiveIndex(idx)}
                  className="relative rounded-[2rem] border border-white/10 overflow-hidden shadow-2xl group cursor-pointer flex flex-col justify-end"
                  style={{
                    flex: isActive ? (windowWidth < 768 ? 3.0 : 3.5) : 1.0,
                    transition: "flex 0.4s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.3s, box-shadow 0.3s",
                  }}
                >
                  {/* Real Image Background - 100% visible, no overlay wash out */}
                  <div
                    className="absolute inset-0 z-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
                    style={{ backgroundImage: `url(${f.bgImage})` }}
                  />

                  {/* Vibrant Purple-blue gradient overlay matching upload design style */}
                  <div className="absolute inset-0 z-10 bg-gradient-to-t from-violet-950/90 via-violet-950/45 to-transparent opacity-80 group-hover:opacity-95 transition-opacity" />

                  {/* Card Content Interior */}
                  <div className="w-full relative z-20 flex flex-col justify-end p-6 md:p-8 overflow-hidden h-full">
                    <div className="flex flex-col md:flex-row md:items-end md:justify-between w-full h-full gap-6">
                      <div className="flex-1 flex flex-col justify-end h-full">
                        <span className="text-3xl md:text-5xl font-light text-white/90 tracking-tight font-mono mb-2">
                          {String(idx + 1).padStart(2, '0')}
                        </span>
                        
                        <h3 className="text-lg md:text-2xl font-bold text-white tracking-tight leading-snug break-words">
                          {f.title}
                        </h3>

                        {/* Collapsible details container */}
                        <div 
                          className="transition-all duration-400 ease-[cubic-bezier(0.16,1,0.3,1)] overflow-hidden flex flex-col"
                          style={{
                            maxHeight: isActive ? "180px" : "0px",
                            opacity: isActive ? 1 : 0,
                            transform: isActive ? "translateY(0)" : "translateY(12px)",
                            marginTop: isActive ? "8px" : "0px",
                          }}
                        >
                          {/* Limit description to at most 2 lines */}
                          <p className="text-zinc-200 text-xs leading-relaxed line-clamp-2 max-w-sm mb-4">
                            {f.desc}
                          </p>
                          <Link
                            to="/login"
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-white hover:text-primary transition-colors duration-200 group/link w-fit"
                          >
                            <span>立即体验</span>
                            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover/link:translate-x-1" />
                          </Link>
                        </div>
                      </div>

                      {/* Floating mockup in glass frame displayed only when card is expanded */}
                      <div 
                        className="hidden md:flex items-center justify-center transition-all duration-400 ease-[cubic-bezier(0.16,1,0.3,1)]"
                        style={{
                          flex: isActive ? 1 : 0,
                          opacity: isActive ? 1 : 0,
                          transform: isActive ? "scale(1)" : "scale(0.92)",
                          maxWidth: isActive ? "240px" : "0px",
                          pointerEvents: isActive ? "auto" : "none",
                        }}
                      >
                        <div className="w-full bg-slate-950/45 backdrop-blur-md border border-white/10 rounded-2xl p-4 shadow-2xl">
                          {renderMockup(f.title)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>


      {/* ─── 适合人群（重新设计） ─── */}
      <section className="py-24 px-4 bg-muted/20 overflow-hidden">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <Badge className="mb-3 bg-secondary/15 text-secondary border-secondary/30">适合人群</Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-balance">为各类学习者量身打造</h2>
            <p className="text-muted-foreground text-pretty max-w-xl mx-auto">无论你的目标是什么，Kowell AI 都有专属方案助你高效达成</p>
          </motion.div>

          {/* 左侧大卡 + 右侧网格 */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
            {/* 主推卡 - 备考学生 */}
            <motion.div
              initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }} transition={{ duration: 0.6 }}
              whileHover={{ y: -4 }}
              className="lg:col-span-2"
            >
              <div className="relative h-full rounded-2xl overflow-hidden bg-gradient-to-br from-violet-500 via-purple-600 to-indigo-600 text-white shadow-2xl shadow-violet-500/30 p-8 flex flex-col min-h-[320px]">
                {/* 装饰圆 */}
                <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/8 blur-2xl" />
                <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full bg-white/5 blur-xl" />
                <div className="relative flex-1 flex flex-col">
                  <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center mb-5 shadow-inner">
                    <GradCap className="w-7 h-7" />
                  </div>
                  <div className="mb-2">
                    <span className="text-white/70 text-xs font-medium tracking-wider uppercase">最受欢迎</span>
                  </div>
                  <h3 className="text-2xl font-extrabold mb-3 text-balance">备考冲刺生</h3>
                  <p className="text-white/80 text-sm leading-relaxed flex-1 text-pretty">
                    高考 / 考研 / 竞赛全覆盖。AI弱项图谱精准定位盲点，个性化每日计划让备考少走弯路，成绩稳步突破。
                  </p>
                  <div className="mt-6 flex flex-wrap gap-2">
                    {['精准弱项分析', '每日刷题计划', '苏格拉底辅导', '考研全流程'].map(t => (
                      <span key={t} className="px-2.5 py-1 rounded-full bg-white/15 text-white text-[11px] font-medium border border-white/20">{t}</span>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>

            {/* 右侧 2×2 网格 */}
            <div className="lg:col-span-3 grid grid-cols-2 gap-5">
              {[
                {
                  icon: Code2,
                  color: 'from-sky-500 to-cyan-500',
                  shadowColor: 'shadow-sky-400/20',
                  accent: 'bg-sky-50 dark:bg-sky-900/20',
                  iconBg: 'bg-gradient-to-br from-sky-500 to-cyan-500',
                  title: '编程新手',
                  desc: '代码实验室边学边练，8种语言实时运行，AI即时批改，从入门到进阶有迹可循。',
                  tags: ['代码实验室', 'AI代码审阅'],
                },
                {
                  icon: Brain,
                  color: 'from-emerald-500 to-teal-500',
                  shadowColor: 'shadow-emerald-400/20',
                  accent: 'bg-emerald-50 dark:bg-emerald-900/20',
                  iconBg: 'bg-gradient-to-br from-emerald-500 to-teal-500',
                  title: '知识系统化',
                  desc: '可视化知识图谱帮你理清脉络，构建完整认知框架，让学科体系一目了然。',
                  tags: ['知识图谱', '关联推演'],
                },
                {
                  icon: Trophy,
                  color: 'from-amber-500 to-orange-500',
                  shadowColor: 'shadow-amber-400/20',
                  accent: 'bg-amber-50 dark:bg-amber-900/20',
                  iconBg: 'bg-gradient-to-br from-amber-500 to-orange-500',
                  title: '竞赛选手',
                  desc: '深度专项强化训练，针对竞赛题型定制冲刺路径，突破极限、拿下名次。',
                  tags: ['专项强化', '极限突破'],
                },
                {
                  icon: BarChart3,
                  color: 'from-rose-500 to-pink-500',
                  shadowColor: 'shadow-rose-400/20',
                  accent: 'bg-rose-50 dark:bg-rose-900/20',
                  iconBg: 'bg-gradient-to-br from-rose-500 to-pink-500',
                  title: '效率提升者',
                  desc: '数据洞察驱动学习决策，每周深度数据报告，用科学方法持续放大学习效率。',
                  tags: ['数据报告', '效率最大化'],
                },
              ].map((p, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }} transition={{ delay: i * 0.08, duration: 0.5 }}
                  whileHover={{ y: -4, scale: 1.02 }}
                  className="group"
                >
                  <div className={`relative h-full rounded-2xl border border-border/50 bg-card shadow-md hover:shadow-xl ${p.shadowColor} transition-all duration-300 overflow-hidden p-5 flex flex-col gap-3`}>
                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r opacity-70" style={{ backgroundImage: `linear-gradient(to right, ${p.color.replace('from-', '').replace(' to-', ', ')})` }} />
                    <div className={`w-10 h-10 rounded-xl ${p.iconBg} flex items-center justify-center shadow-md shrink-0`}>
                      <p.icon className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-sm mb-1.5">{p.title}</h3>
                      <p className="text-xs text-muted-foreground leading-relaxed text-pretty mb-3">{p.desc}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {p.tags.map(tag => (
                          <span key={tag} className={`text-[10px] px-2 py-0.5 rounded-full ${p.accent} text-muted-foreground border border-border/40`}>{tag}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── 核心功能交互式工作流 ─── */}
      <section id="工作流模拟" className="py-24 px-4 bg-muted/10 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 md:px-8 w-full">
          <div className="text-center mb-12">
            <Badge className="mb-4 bg-primary/10 text-primary border-primary/25 px-3 py-1 text-xs">INTERACTIVE SIMULATOR</Badge>
            <h2 className="text-3xl md:text-5xl font-extrabold mb-4 tracking-tight">核心功能交互式工作流</h2>
            <p className="text-muted-foreground text-sm max-w-xl mx-auto leading-relaxed">
              点击下方 Tab 查看 Kowell AI 核心学习链条中各模块的交互模拟，体验多智能体协作细节。
            </p>
          </div>

          {/* Trigger Box */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-5 rounded-2xl bg-card border border-primary/25 shadow-md shadow-primary/5 mb-8">
            <div className="flex-1">
              <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
                🤖 多智能体协同流式演示 (Simulation Control)
              </h4>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{collabStatus}</p>
            </div>
            <Button
              onClick={simulateFullWorkflow}
              disabled={isSimulating}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-md shrink-0 flex items-center gap-2"
            >
              {isSimulating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
              <span>一键联动模拟</span>
            </Button>
          </div>

          {/* Tabs Navigation */}
          <div className="flex flex-wrap gap-2 mb-6 border-b border-border/60 pb-3">
            {[
              "1. Socrates 画像",
              "2. 自适应 DAG 路径",
              "3. 资源生成 (CRUD)",
              "4. 代码实验室 (Monaco)",
              "5. 诊断评估雷达",
              "🤖 多智能体日志"
            ].map((tab, idx) => (
              <button
                key={idx}
                onClick={() => !isSimulating && setActiveTab(idx)}
                className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
                  activeTab === idx
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-muted'
                } ${isSimulating ? 'cursor-not-allowed opacity-50' : ''}`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Mockup Window */}
          <div className="bg-slate-950 text-slate-100 rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col h-[480px]">
            <div className="flex items-center justify-between px-6 py-3 border-b border-white/5 bg-slate-900/50">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-red-500/80" />
                <span className="w-3 h-3 rounded-full bg-yellow-500/80" />
                <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
              </div>
              <span className="text-xs font-semibold text-slate-400">
                {["Socrates Portrait - 画像构建", "Adaptive DAG Path - 自适应路线图", "Resource Manager - 资源管理抽屉 (CRUD)", "Monaco Sandbox - 在线代码实验室与改错", "Evaluation Radar - 综合诊断评估大盘", "Multi-Agent Terminal - 多智能体协同日志控制台"][activeTab]}
              </span>
              <div className="flex items-center gap-1.5 text-[10px] text-zinc-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Connected (DeepSeek)</span>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-6 relative">
              {/* Tab 0: Socrates Chat */}
              {activeTab === 0 && (
                <div className="flex flex-col h-full justify-between gap-4">
                  <div className="flex-1 overflow-y-auto space-y-4 pr-2 font-sans text-xs">
                    {socratesChat.map((msg, i) => (
                      <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 leading-relaxed shadow-sm ${
                          msg.role === 'user'
                            ? 'bg-primary text-primary-foreground rounded-tr-none'
                            : 'bg-slate-900 border border-white/5 rounded-tl-none'
                        }`}>
                          {msg.content}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-white/5 gap-3 shrink-0">
                    <button
                      onClick={triggerVoiceSpeak}
                      disabled={isSimulating}
                      className={`p-3 rounded-full flex items-center justify-center transition-all ${
                        voiceActive
                          ? 'bg-red-500 text-white animate-pulse'
                          : 'bg-slate-800 hover:bg-slate-700 text-primary'
                      }`}
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                    <div className="flex-1 text-[11px] text-slate-400 flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((bar) => (
                          <div
                            key={bar}
                            className={`w-1 bg-primary rounded-full transition-all duration-300 ${
                              voiceActive ? 'animate-bounce' : 'h-3'
                            }`}
                            style={{
                              height: voiceActive ? undefined : `${4 + bar * 3}px`,
                              animationDelay: `${bar * 150}ms`,
                              animationDuration: '1s'
                            }}
                          />
                        ))}
                      </div>
                      <span>{voiceActive ? '正在录音并传送音频给 Socrates AI...' : '点击麦克风模拟语音交互 (MiniMax TTS 驱动)'}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 1: DAG Path */}
              {activeTab === 1 && (
                <div className="flex flex-col md:flex-row h-full gap-6">
                  <div className="flex-1 border border-white/5 rounded-xl bg-slate-900/40 p-4 flex items-center justify-center">
                    <svg className="w-full h-[250px]" viewBox="0 0 600 300">
                      <line x1="80" y1="150" x2="200" y2="80" className={`stroke-2 transition-all duration-500 ${selectedNode === 1 ? 'stroke-primary' : 'stroke-zinc-700/60'}`} />
                      <line x1="80" y1="150" x2="200" y2="220" className={`stroke-2 transition-all duration-500 ${selectedNode === 2 ? 'stroke-primary' : 'stroke-zinc-700/60'}`} />
                      <line x1="200" y1="80" x2="350" y2="80" className={`stroke-2 transition-all duration-500 ${selectedNode === 3 ? 'stroke-primary' : 'stroke-zinc-700/60'}`} />
                      <line x1="200" y1="220" x2="350" y2="220" className={`stroke-2 transition-all duration-500 ${selectedNode === 4 ? 'stroke-primary' : 'stroke-zinc-700/60'}`} />
                      <line x1="350" y1="80" x2="480" y2="150" className={`stroke-2 transition-all duration-500 ${selectedNode === 5 ? 'stroke-primary' : 'stroke-zinc-700/60'}`} />
                      <line x1="350" y1="220" x2="480" y2="150" className={`stroke-2 transition-all duration-500 ${selectedNode === 5 ? 'stroke-primary' : 'stroke-zinc-700/60'}`} />

                      {[
                        { id: 0, cx: 80, cy: 150, label: 'Python基础', title: '数据结构底座: Python 基础', status: '已通关', desc: '掌握变量、控制流、函数及基础OOP。耗时 6.4 小时。', color: 'fill-emerald-500/25 stroke-emerald-500' },
                        { id: 1, cx: 200, cy: 80, label: '链表与栈', title: '线性结构通关: 链表与栈', status: '进行中', desc: '重点分析链表指针逻辑与栈的进出顺序，包含Monaco沙箱实操。', color: 'fill-primary/20 stroke-primary' },
                        { id: 2, cx: 200, cy: 220, label: '树与二叉树', title: '非线性探索: 树与二叉树', status: '进行中', desc: '研究二叉树遍历算法与堆结构。前置依赖：Python基础。', color: 'fill-primary/20 stroke-primary' },
                        { id: 3, cx: 350, cy: 80, label: '递归与分治', title: '算法核心: 递归与分治', status: '未解锁', desc: '深度探讨递归栈空间开销与大O复杂度优化。', color: 'fill-slate-800 stroke-zinc-700' },
                        { id: 4, cx: 350, cy: 220, label: 'DFS/BFS', title: '经典算法: 深度优先搜索', status: '未解锁', desc: '学习图深度遍历与拓扑排序。前置依赖：树与二叉树。', color: 'fill-slate-800 stroke-zinc-700' },
                        { id: 5, cx: 480, cy: 150, label: 'AI推理实践', title: '综合实践: AI推理智能体', status: '未解锁', desc: '整合自研算法，构建首个能进行问题拆解的智能体节点。', color: 'fill-slate-800 stroke-zinc-700' },
                      ].map((node) => (
                        <g
                          key={node.id}
                          className="cursor-pointer group"
                          onClick={() => handleNodeClick(node.id, node.title, node.status, node.desc)}
                        >
                          <circle
                            cx={node.cx}
                            cy={node.cy}
                            r="28"
                            className={`transition-all duration-300 ${node.color} ${selectedNode === node.id ? 'stroke-2' : 'stroke-1 hover:stroke-2'}`}
                          />
                          <text
                            x={node.cx}
                            y={node.cy + 4}
                            className="text-[9px] font-semibold fill-slate-200 pointer-events-none"
                            textAnchor="middle"
                          >
                            {node.label}
                          </text>
                        </g>
                      ))}
                    </svg>
                  </div>

                  <div className="w-full md:w-64 border border-white/5 rounded-xl bg-slate-900/40 p-5 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between pb-2 border-b border-white/5 mb-3">
                        <span className="font-bold text-xs">{nodeData.title}</span>
                        <span className={`text-[9px] px-2 py-0.5 rounded font-semibold border ${
                          nodeData.status === '已通关'
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                            : nodeData.status === '进行中'
                            ? 'bg-primary/10 border-primary/20 text-primary'
                            : 'bg-zinc-800 border-zinc-700 text-zinc-400'
                        }`}>{nodeData.status}</span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">{nodeData.desc}</p>
                    </div>
                    <div className="text-[9px] text-zinc-500 leading-relaxed border-t border-white/5 pt-3 mt-4">
                      💡 提示: 双击图中的“进行中”节点，可以直接调取多智能体为您生成专项复习文档大纲。
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Resource Manager */}
              {activeTab === 2 && (
                <div className="flex h-full border border-white/5 rounded-xl overflow-hidden font-sans text-xs bg-slate-900/40">
                  <div className="w-48 border-r border-white/5 flex flex-col bg-slate-950/40">
                    <div className="p-3 border-b border-white/5 flex justify-between items-center bg-slate-900/20">
                      <span className="font-bold text-[10px] text-slate-400">我的资源 (CRUD)</span>
                      <button
                        onClick={() => setShowNewModal(true)}
                        disabled={isSimulating}
                        className="px-2 py-1 rounded bg-primary text-primary-foreground text-[10px] font-bold hover:scale-102 transition-transform"
                      >
                        + 新建
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                      {simulatorResources.map((res) => (
                        <div
                          key={res.id}
                          onClick={() => selectResource(res.id)}
                          className={`group p-2 rounded-lg cursor-pointer flex items-center justify-between gap-2 transition-colors ${
                            selectedResId === res.id ? 'bg-primary/20 text-primary font-medium' : 'hover:bg-slate-900 text-slate-400'
                          }`}
                        >
                          <span className="truncate flex-1">📄 {res.title}</span>
                          {!isSimulating && (
                            <div className="opacity-0 group-hover:opacity-100 flex gap-1 shrink-0">
                              <button onClick={(e) => { e.stopPropagation(); renameResource(res.id); }} className="hover:text-primary">
                                <Edit className="w-3 h-3" />
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); deleteResource(res.id); }} className="hover:text-red-400">
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex-1 flex flex-col bg-slate-900/10">
                    {(() => {
                      const selected = simulatorResources.find(res => res.id === selectedResId);
                      if (!selected) {
                        return (
                          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 gap-2">
                            <FileText className="w-8 h-8 opacity-40" />
                            <span>请选择左侧资源或点击“新建”启动多智能体并发生成</span>
                          </div>
                        );
                      }
                      return (
                        <>
                          <div className="p-4 border-b border-white/5 flex justify-between items-center bg-slate-900/30">
                            <div>
                              <h4 className="font-bold text-slate-200">{selected.title}</h4>
                              <div className="text-[9px] text-slate-500 mt-0.5">修改时间: {selected.date} | 文件大小: {selected.size}</div>
                            </div>
                            <Button
                              onClick={() => exportResource(selected.title)}
                              variant="outline"
                              size="sm"
                              className="h-7 px-3 border-white/10 hover:bg-slate-800 text-[10px] font-bold text-slate-300 flex items-center gap-1 shrink-0"
                            >
                              <Download className="w-3 h-3" />
                              <span>导出讲义</span>
                            </Button>
                          </div>
                          <pre className="flex-1 p-4 font-mono text-[10px] text-slate-300 overflow-auto whitespace-pre-wrap leading-relaxed select-text">
                            {selected.content}
                          </pre>
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* Tab 3: Monaco Code Sandbox */}
              {activeTab === 3 && (
                <div className="flex flex-col h-full border border-white/5 rounded-xl bg-slate-950 font-mono text-[10px] leading-relaxed p-4 overflow-y-auto select-text text-slate-300">
                  <div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/5">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
                    <span>deepseek_coder_agent.py</span>
                  </div>
                  <div>
                    <span className="text-zinc-600">1 </span><span className="text-purple-400 font-semibold">class</span> <span className="text-yellow-400 font-bold">Node</span>:<br/>
                    <span className="text-zinc-600">2 </span>&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-purple-400 font-semibold">def</span> <span className="text-blue-400">__init__</span>(self, val):<br/>
                    <span className="text-zinc-600">3 </span>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;self.val = val<br/>
                    <span className="text-zinc-600">4 </span>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;self.left = <span className="text-cyan-400">None</span><br/>
                    <span className="text-zinc-600">5 </span>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;self.right = <span className="text-cyan-400">None</span><br/>
                    <span className="text-zinc-600">6 </span><br/>
                    <span className="text-zinc-600">7 </span><span className="text-zinc-500"># AI 提醒：递归计算树的深度</span><br/>
                    <span className="text-zinc-600">8 </span><span className="text-purple-400 font-semibold">def</span> <span className="text-blue-400">maxDepth</span>(root: Node) -&gt; <span className="text-cyan-400">int</span>:<br/>
                    <span className="text-zinc-600">9 </span>&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-purple-400 font-semibold">if</span> root <span className="text-purple-400">is</span> <span className="text-cyan-400">None</span>:<br/>
                    <span className="text-zinc-600">10</span>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-purple-400 font-semibold">return</span> <span className="text-amber-500">0</span><br/>
                    <span className="text-zinc-600">11</span>&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-zinc-500"># 此处如果出现深层大树可能导致递归栈溢出</span><br/>
                    <span className="text-zinc-600">12</span>&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-purple-400 font-semibold">return</span> max(maxDepth(root.left), maxDepth(root.right)) + <span className="text-amber-500">1</span>
                  </div>

                  {/* Inline Code Review bubble */}
                  <div className="mt-4 p-4 rounded-xl border border-primary/30 bg-primary/5 text-slate-200">
                    <div className="flex items-center gap-2 pb-1.5 border-b border-primary/20 mb-2 font-sans font-bold text-xs text-primary">
                      <span className="w-2 h-2 rounded-full bg-primary" />
                      <span>DeepSeek Code Reviewer (Inline)</span>
                    </div>
                    <div className="text-[10.5px] leading-relaxed">
                      第 12 行：此处采用朴素递归求最大深度，在大数据量或斜树下，最坏时间复杂度为 O(N)，且空间复杂度退化为 O(N)（栈开销）。<br />
                      <strong>优化策略</strong>：可以考虑使用迭代法（广度优先搜索 BFS 借助队列）来限制内存栈的暴涨。
                    </div>
                    <div className="mt-2.5 font-mono text-[9.5px] bg-slate-900 border border-white/5 rounded-lg p-2.5 text-zinc-400 select-all">
                      # BFS 迭代写法可以规避栈溢出风险
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 4: Evaluation Radar */}
              {activeTab === 4 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center h-full">
                  <div className="flex items-center justify-center">
                    <div className="w-[200px] h-[200px] relative">
                      <svg className="w-full h-full" viewBox="0 0 300 300">
                        <polygon points="150,30 253,90 253,210 150,270 47,210 47,90" className="fill-none stroke-zinc-700/60 stroke-1" />
                        <polygon points="150,70 219,110 219,190 150,230 81,190 81,110" className="fill-none stroke-zinc-700/40 stroke-1" />
                        <polygon points="150,110 185,130 185,170 150,190 115,170 115,130" className="fill-none stroke-zinc-700/20 stroke-1" />
                        
                        <line x1="150" y1="150" x2="150" y2="30" className="stroke-zinc-700/40 stroke-1" />
                        <line x1="150" y1="150" x2="253" y2="90" className="stroke-zinc-700/40 stroke-1" />
                        <line x1="150" y1="150" x2="253" y2="210" className="stroke-zinc-700/40 stroke-1" />
                        <line x1="150" y1="150" x2="150" y2="270" className="stroke-zinc-700/40 stroke-1" />
                        <line x1="150" y1="150" x2="47" y2="210" className="stroke-zinc-700/40 stroke-1" />
                        <line x1="150" y1="150" x2="47" y2="90" className="stroke-zinc-700/40 stroke-1" />

                        <text x="150" y="20" className="text-[10px] font-bold text-center fill-slate-200" textAnchor="middle">理论基础 ({radarLevels[0]})</text>
                        <text x="280" y="85" className="text-[10px] font-bold fill-slate-400" textAnchor="start">实操编写 ({radarLevels[1]})</text>
                        <text x="280" y="225" className="text-[10px] font-bold fill-slate-400" textAnchor="start">问题拆解 ({radarLevels[2]})</text>
                        <text x="150" y="290" className="text-[10px] font-bold text-center fill-slate-200" textAnchor="middle">逻辑推理 ({radarLevels[3]})</text>
                        <text x="20" y="225" className="text-[10px] font-bold fill-slate-400" textAnchor="end">学习毅力 ({radarLevels[4]})</text>
                        <text x="20" y="85" className="text-[10px] font-bold fill-slate-400" textAnchor="end">知识广度 ({radarLevels[5]})</text>

                        <polygon points={computeRadarPoints(radarLevels)} className="fill-primary/25 stroke-primary stroke-2 transition-all duration-1000" />
                      </svg>
                    </div>
                  </div>

                  <div className="font-sans text-xs flex flex-col justify-center gap-3">
                    <h4 className="font-bold text-sm text-slate-100">AI 学情诊断分析报告</h4>
                    <p className="text-[11px] text-slate-400">经过本周 {streakCount} 次 DAG 节点练习与 12 次沙箱测试，大模型生成了如下量化评级：</p>
                    
                    <div className="space-y-2">
                      {[
                        { label: '逻辑推理', val: radarLevels[3] },
                        { label: '理论基础', val: radarLevels[0] },
                        { label: '学习毅力', val: radarLevels[4] },
                        { label: '问题拆解', val: radarLevels[2] },
                        { label: '实操编写', val: radarLevels[1] },
                        { label: '知识广度', val: radarLevels[5] },
                      ].map((item, i) => (
                        <div key={i} className="space-y-1">
                          <div className="flex justify-between text-[10px] font-semibold text-slate-300">
                            <span>{item.label}</span>
                            <span>{item.val}%</span>
                          </div>
                          <div className="h-1 bg-slate-900 border border-white/5 rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full transition-all duration-1000" style={{ width: `${item.val}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-[10px] text-amber-400/90 leading-relaxed mt-2">
                      <strong className="block text-amber-400 mb-0.5">⚠️ AI 教师提升建议：</strong>
                      您在理论与逻辑上表现极佳，但在<span className="text-white font-semibold">代码编写实操</span>上得分较低。建议本周重点突破“树与二叉树”沙箱，编写二叉树的前中后序递归，增强手写代码肌肉记忆。
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 5: Logs */}
              {activeTab === 5 && (
                <div className="h-full border border-white/5 rounded-xl bg-slate-950 p-4 font-mono text-[10px] leading-relaxed overflow-y-auto space-y-2 select-text text-zinc-300 flex flex-col justify-start">
                  {simulatorLogs.map((log, i) => (
                    <div key={i} className="flex gap-2">
                      <span className="text-zinc-600shrink-0">[{log.time}]</span>
                      <span className={`px-1.5 py-0.2 rounded font-bold shrink-0 text-[8.5px] uppercase ${
                        log.tag === 'profile'
                          ? 'bg-violet-500/10 border border-violet-500/20 text-violet-400'
                          : log.tag === 'planner'
                          ? 'bg-blue-500/10 border border-blue-500/20 text-blue-400'
                          : log.tag === 'resource'
                          ? 'bg-pink-500/10 border border-pink-500/20 text-pink-400'
                          : log.tag === 'coder'
                          ? 'bg-amber-500/10 border border-amber-500/20 text-amber-400'
                          : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                      }`}>{log.tag}</span>
                      <span className="text-slate-300">{log.msg}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ─── 游戏化打卡与积分代币裂变 ─── */}
      <section id="游戏化打卡" className="py-24 px-4 bg-muted/15 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 md:px-8 w-full">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-primary/10 text-primary border-primary/25 px-3 py-1 text-xs">GAME & TOKENS</Badge>
            <h2 className="text-3xl md:text-5xl font-extrabold mb-4 tracking-tight">游戏化打卡与积分代币裂变</h2>
            <p className="text-muted-foreground text-sm max-w-xl mx-auto leading-relaxed">
              社交邀请获赠积分，每日签到翻倍奖励，控制大模型调用成本，激发主动学习热情。
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Calendar */}
            <div className="lg:col-span-5 bg-card border border-border/85 rounded-2xl p-6 shadow-xl flex flex-col gap-4">
              <div className="flex items-center justify-between pb-3 border-b border-border/20">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <Calendar className="w-4 h-4 text-amber-500 fill-amber-500/10" />
                  <span>每日打卡 Streak 体系</span>
                </div>
                <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 dark:text-amber-500 border-transparent">
                  已连续签到 {streakCount} 天
                </Badge>
              </div>

              <div className="grid grid-cols-7 gap-2 text-center text-xs">
                {['一', '二', '三', '四', '五', '六', '日'].map(day => (
                  <span key={day} className="text-muted-foreground font-medium py-1">{day}</span>
                ))}
                
                {[12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22].map(day => (
                  <div key={day} className="w-9 h-9 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 font-semibold flex items-center justify-center border border-emerald-500/20 mx-auto">
                    {day}
                  </div>
                ))}
                
                <button
                  onClick={handleCheckin}
                  disabled={streakChecked}
                  className={`w-9 h-9 rounded-full font-bold flex items-center justify-center transition-all mx-auto ${
                    streakChecked
                      ? 'bg-emerald-500 text-white shadow-md'
                      : 'bg-primary text-primary-foreground hover:scale-105 active:scale-95 animate-pulse shadow-md'
                  }`}
                >
                  23
                </button>
                
                {[24, 25].map(day => (
                  <div key={day} className="w-9 h-9 rounded-full bg-muted text-muted-foreground flex items-center justify-center mx-auto">
                    {day}
                  </div>
                ))}
              </div>

              <p className="text-center text-xs text-muted-foreground mt-2">
                {streakChecked ? (
                  <span className="text-emerald-500 font-bold">✓ 签到成功！已获赠 +10 Tokens！连签加成已激活。</span>
                ) : (
                  <span>今日（23日）尚未打卡，点击对应日期完成签到，赚取今日积分！</span>
                )}
              </p>
            </div>

            {/* Token Rules */}
            <div className="lg:col-span-7 space-y-4">
              <div className="flex gap-4 p-4 border border-border bg-card rounded-xl shadow-sm items-center hover:shadow-md transition-shadow">
                <div className="p-3 bg-amber-500/10 text-amber-500 rounded-xl">
                  <Star className="w-5 h-5 fill-amber-500/10" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-sm">每日打卡签到</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">签到即获积分，连续签到将触发积分翻倍系数。</p>
                </div>
                <span className="font-bold text-sm text-amber-600 dark:text-amber-500 shrink-0">+10 Tokens</span>
              </div>

              <div className="flex gap-4 p-4 border border-border bg-card rounded-xl shadow-sm items-center hover:shadow-md transition-shadow">
                <div className="p-3 bg-primary/10 text-primary rounded-xl">
                  <Users className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-sm">邀请好友加入</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">新用户填写您的邀请码注册并绑定邮箱后，双方共享奖励。</p>
                </div>
                <span className="font-bold text-sm text-primary shrink-0">+100 Tokens</span>
              </div>

              <div className="flex gap-4 p-4 border border-border bg-card rounded-xl shadow-sm items-center hover:shadow-md transition-shadow">
                <div className="p-3 bg-pink-500/10 text-pink-500 rounded-xl">
                  <Code2 className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-sm">共享优秀代码/笔记</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">在社群内分享已被沙箱安全编译且获得 AI 精英标记的代码案例。</p>
                </div>
                <span className="font-bold text-sm text-pink-600 dark:text-pink-500 shrink-0">+50 Tokens</span>
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* ─── 竞品分析（雷达图） ─── */}
      <section id="竞品分析" className="py-24 px-4 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <Badge className="mb-3 bg-violet-500/15 text-violet-500 border-violet-500/30">对标分析</Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-balance">领先同类竞品</h2>
            <p className="text-muted-foreground max-w-xl mx-auto text-pretty">
              在多个核心维度全面超越市场主流学习平台
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8 items-center">
            <FloatingCard>
              <div className="bg-card rounded-2xl p-6 shadow-lg border border-border">
                <div className="flex flex-wrap gap-2 mb-4 justify-center">
                  {competitorNames.map((name, i) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setActiveCompetitor(activeCompetitor === name ? null : name)}
                      className={`px-3 py-1 rounded-full text-sm border transition-all ${activeCompetitor === name || !activeCompetitor
                        ? 'opacity-100 scale-105'
                        : 'opacity-40'
                        }`}
                      style={{ borderColor: competitorColors[i], color: competitorColors[i] }}
                    >
                      {name}
                    </button>
                  ))}
                </div>
                <ResponsiveContainer width="100%" height={320}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="hsl(var(--border))" />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                    <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                    {competitorNames.map((name, i) => (
                      radarData[0][name] !== undefined && (
                        <Radar
                          key={name}
                          name={name}
                          dataKey={name}
                          stroke={competitorColors[i]}
                          fill={competitorColors[i]}
                          fillOpacity={name === 'Kowell AI' ? 0.25 : 0.08}
                          strokeWidth={name === 'Kowell AI' ? 2.5 : 1.5}
                        />
                      )
                    ))}
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </FloatingCard>

            <div className="space-y-4">
              {[
                { title: '苏格拉底式AI辅导', desc: '引导思考的独特对话模式，而非简单答案推送', icon: Brain, score: 92 },
                { title: '代码实验室集成', desc: '8种语言在线运行+AI审阅，学练一体无缝切换', icon: Code2, score: 90 },
                { title: '弱项自动识别', desc: '基于错误模式深度分析，精准定位知识盲点', icon: Target, score: 93 },
                { title: '知识图谱编辑', desc: '可交互的个人知识体系构建与可视化展示', icon: Network, score: 95 },
              ].map((item, i) => (
                <FloatingCard key={i} delay={i * 0.1}>
                  <div className="flex items-center gap-4 p-4 bg-card rounded-xl border border-border shadow-sm">
                    <div className="p-2.5 rounded-xl bg-primary/10 shrink-0">
                      <item.icon className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="text-sm font-semibold">{item.title}</h4>
                        <span className="text-sm font-bold text-primary">{item.score}</span>
                      </div>
                      <p className="text-xs text-muted-foreground text-pretty">{item.desc}</p>
                      <div className="h-1.5 bg-muted rounded-full mt-2 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          whileInView={{ width: `${item.score}%` }}
                          viewport={{ once: true }}
                          transition={{ duration: 1, delay: i * 0.15 }}
                          className="h-full bg-primary rounded-full"
                        />
                      </div>
                    </div>
                  </div>
                </FloatingCard>
              ))}
            </div>
          </div>



        </div>
      </section>

      {/* ─── 用户评价（双行错位无限轮播） ─── */}
      <section id="用户评价" className="py-24 overflow-hidden">
        <div className="max-w-6xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <Badge className="mb-3 bg-amber-500/15 text-amber-500 border-amber-500/30">口碑见证</Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-balance">学习者的真实故事</h2>
            <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
              {[...Array(5)].map((_, i) => <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />)}
              <span className="ml-2 font-medium text-foreground">5.0</span>
              <span className="ml-1 text-muted-foreground">/ 5.0 · 来自 50,000+ 用户</span>
            </div>
          </motion.div>
        </div>
        {/* 全宽双行轮播，使用负边距突破 max-w 限制 */}
        <div className="-mx-4 md:-mx-8">
          <ReviewCarousel />
        </div>
      </section>



      {/* ─── 会员计划 ─── */}
      <section id="会员计划" className="py-24 px-4 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <Badge className="mb-3 bg-emerald-500/15 text-emerald-500 border-emerald-500/30">价格方案</Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-balance">选择适合你的计划</h2>
            <p className="text-muted-foreground text-pretty">灵活的付费方案，从个人学习到团队协作一站满足</p>
          </motion.div>

          <div className="grid grid-cols-3 gap-3 md:gap-6 items-start">
            {plans.map((plan, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                whileHover={{ y: -6 }}
                className="h-full"
              >
                <div className={`relative h-full rounded-2xl flex flex-col overflow-hidden transition-all duration-300 ${
                  plan.highlight
                    ? 'border-2 border-primary shadow-2xl ring-4 ring-primary/10'
                    : 'border border-border/60 shadow-lg hover:shadow-xl'
                }`}>
                  {/* 顶部彩色渐变头 */}
                  <div className={`p-4 sm:p-7 bg-gradient-to-br ${plan.color} text-white relative overflow-hidden`}>
                    {/* 装饰光晕 */}
                    <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/10 blur-xl" />
                    <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-black/10 to-transparent" />
                    <div className="relative">
                      <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-5">
                        <div className="p-1.5 sm:p-2.5 rounded-xl bg-white/20 shadow-inner backdrop-blur-sm">
                          <plan.icon className="w-4 h-4 sm:w-5 sm:h-5" />
                        </div>
                        <span className="font-bold text-sm sm:text-lg">{plan.name}</span>
                      </div>
                      <div className="flex items-baseline gap-1 mb-1">
                        <span className="text-2xl sm:text-5xl font-extrabold tracking-tight">{plan.price}</span>
                        <span className="text-white/70 text-xs sm:text-sm">{plan.period}</span>
                      </div>
                      <p className="text-white/75 text-[10px] sm:text-sm truncate">{plan.desc}</p>
                    </div>
                  </div>

                  {/* 功能列表 */}
                  <div className="p-3 sm:p-6 bg-card flex-1 flex flex-col">
                    <ul className="space-y-2.5 flex-1 mb-4 sm:mb-6">
                      {plan.features.map((feat, j) => (
                        <li key={j} className="flex items-start gap-1.5 sm:gap-2.5">
                          <div className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                            plan.highlight ? 'bg-primary/10' : 'bg-muted'
                          }`}>
                            <CheckCircle2 className={`w-2.5 h-2.5 sm:w-3 sm:h-3 ${plan.highlight ? 'text-primary' : 'text-muted-foreground'}`} />
                          </div>
                          <span className="text-[11px] sm:text-sm text-foreground/80 leading-relaxed">{feat}</span>
                        </li>
                      ))}
                    </ul>
                    <Button
                      className={`w-full h-9 sm:h-11 text-xs sm:text-sm font-semibold ${plan.highlight ? 'shadow-lg shadow-primary/20' : ''}`}
                      variant={plan.highlight ? 'default' : 'outline'}
                      asChild
                    >
                      <Link to="/login">
                        <span className="hidden sm:inline">{plan.cta}</span><span className="sm:hidden">选择</span><ArrowRight className="w-3.5 h-3.5 ml-1 sm:ml-1.5 shrink-0" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA 底部（模仿上传图排版重新设计） ─── */}
      <section className="relative py-20 px-4 overflow-hidden bg-background border-t border-border/10">
        {/* 左侧和右侧柔和的渐变微光 */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-violet-500/10 blur-[90px] pointer-events-none" />
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-emerald-500/5 blur-[90px] pointer-events-none" />

        <div className="relative z-10 max-w-4xl mx-auto text-center flex flex-col items-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-3xl md:text-5xl font-extrabold mb-6 text-foreground tracking-tight leading-tight">
              准备好开启你的 <span className="bg-gradient-to-r from-violet-600 via-primary to-amber-500 bg-clip-text text-transparent">智能学习之旅</span> 了吗？
            </h2>
            <p className="text-muted-foreground mb-10 text-sm md:text-base max-w-2xl mx-auto leading-relaxed">
              加入 50,000+ 用户，体验全新的智能辅导。让 Kowell AI 成为你学业提升的得力助手。
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              {/* 立即开始按钮 */}
              <Link
                to="/login"
                className="relative flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-base shadow-lg shadow-violet-500/25 transition-all hover:scale-102 active:scale-98 min-w-[160px]"
              >
                <span>立即开始</span>
                <ArrowRight className="w-4.5 h-4.5" />
              </Link>

              {/* 了解更多按钮 */}
              <a
                href="#六大核心特色功能"
                className="flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-background border border-border/80 text-foreground hover:bg-muted/40 font-bold text-base transition-all hover:scale-102 active:scale-98 min-w-[160px]"
              >
                <BookOpen className="w-4.5 h-4.5 text-muted-foreground" />
                <span>了解更多</span>
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── Footer（电脑端模仿上传图排版，移动端自适应） ─── */}
      <footer className="border-t border-border/60 bg-muted/30 py-12 px-6">
        <div className="max-w-6xl mx-auto">
          {/* 电脑端三列布局 */}
          <div className="hidden md:grid grid-cols-3 gap-12 pb-10">
            {/* 左侧：品牌与描述 */}
            {/* 左侧：品牌与描述 */}
            <div className="flex flex-col gap-4">
              <span className="text-2xl font-extrabold text-foreground tracking-tight">Kowell AI</span>
              <p className="text-sm text-foreground leading-relaxed">
                多智能体个性化学习系统
              </p>
            </div>

            {/* 中间：快速链接 */}
            <div className="flex flex-col gap-4">
              <span className="font-bold text-sm text-foreground">快速链接</span>
              <div className="flex flex-col gap-3 text-sm text-muted-foreground">
                <Link to="/home" className="hover:text-primary transition-colors">学习空间</Link>
                <Link to="/tutoring" className="hover:text-primary transition-colors">智能答疑</Link>
                <Link to="/learning-path" className="hover:text-primary transition-colors">学习路径</Link>
                <Link to="/report" className="hover:text-primary transition-colors">数据报告</Link>
              </div>
            </div>

            {/* 右侧：联系我们 */}
            <div className="flex flex-col gap-4">
              <span className="font-bold text-sm text-foreground">联系我们</span>
              <div className="flex flex-col gap-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-emerald-500 fill-emerald-500/10" />
                  <span>zhixueba2026</span>
                </span>
                <span className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-muted-foreground/80" />
                  <span>support@zhixueba.ai</span>
                </span>
                <span className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-muted-foreground/80" />
                  <span>中国 · 互联网教育</span>
                </span>
              </div>
            </div>
          </div>

          {/* 移动端/平板端自适应一排显示 */}
          <div className="md:hidden flex flex-col items-center gap-6 pb-6">
            <div className="flex items-center gap-2 group">
              <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shadow-md">
                <GraduationCap className="w-4.5 h-4.5 text-primary-foreground" />
              </div>
              <span className="text-base font-bold text-foreground">Kowell AI</span>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-[11px] text-muted-foreground text-center">
              <span className="font-semibold text-foreground">快速链接</span>
              <Link to="/home" className="hover:text-primary transition-colors">学习空间</Link>
              <Link to="/tutoring" className="hover:text-primary transition-colors">智能答疑</Link>
              <Link to="/learning-path" className="hover:text-primary transition-colors">学习路径</Link>
              <Link to="/report" className="hover:text-primary transition-colors">数据报告</Link>
              
              <span className="text-border/60 mx-1">|</span>

              <span className="font-semibold text-foreground">联系我们</span>
              <span className="flex items-center gap-1"><MessageCircle className="w-3.5 h-3.5 text-emerald-500" />微信：zhixueba2026</span>
              <span className="flex items-center gap-1"><Globe className="w-3.5 h-3.5" />support@zhixueba.ai</span>
              <span>中国 · 互联网教育</span>
            </div>
          </div>

          {/* 底部分割线与版权 */}
          <div className="border-t border-border/20 pt-8 text-center text-xs text-muted-foreground/75">
            <span>© 2026 Kowell AI. All rights reserved. Made with ♡ by wyxpro</span>
          </div>
        </div>
      </footer>

      {/* Modal Dialog for Resource Generation */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-card border border-border rounded-2xl p-6 shadow-2xl relative text-foreground"
          >
            <div className="flex justify-between items-center pb-4 border-b border-border mb-4">
              <h3 className="text-lg font-bold text-foreground">新建 AI 讲义大纲</h3>
              <button onClick={() => setShowNewModal(false)} className="p-1 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">学科方向与章节主题</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-muted/30 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="例如：二叉排序树的插入与平衡调整"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">生成资源类型 (支持流式并行并发)</label>
                <div className="grid grid-cols-2 gap-3 mt-1">
                  <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground cursor-pointer">
                    <input type="checkbox" checked={newOpts.outline} onChange={(e) => setNewOpts({...newOpts, outline: e.target.checked})} className="rounded text-primary border-border focus:ring-0" />
                    <span>讲义大纲 (Outline)</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground cursor-pointer">
                    <input type="checkbox" checked={newOpts.mindmap} onChange={(e) => setNewOpts({...newOpts, mindmap: e.target.checked})} className="rounded text-primary border-border focus:ring-0" />
                    <span>SVG思维导图</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground cursor-pointer">
                    <input type="checkbox" checked={newOpts.exercises} onChange={(e) => setNewOpts({...newOpts, exercises: e.target.checked})} className="rounded text-primary border-border focus:ring-0" />
                    <span>经典期末测试题</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground cursor-pointer">
                    <input type="checkbox" checked={newOpts.code} onChange={(e) => setNewOpts({...newOpts, code: e.target.checked})} className="rounded text-primary border-border focus:ring-0" />
                    <span>示例沙箱源码</span>
                  </label>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-border">
              <Button variant="outline" size="sm" onClick={() => setShowNewModal(false)}>取消</Button>
              <Button size="sm" onClick={createNewResourceSubmit}>启动多智能体生成</Button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
