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
  { subject: 'AI个性化', 智学伴: 95, Khan: 70, 学而思: 75, Duolingo: 60 },
  { subject: '苏格拉底式', 智学伴: 92, Khan: 85, 学而思: 40, Duolingo: 35 },
  { subject: '代码实验室', 智学伴: 90, Khan: 50, 学而思: 55, Duolingo: 20 },
  { subject: '知识图谱', 智学伴: 95, Khan: 45, 学而思: 60, Duolingo: 30 },
  { subject: '弱项强化', 智学伴: 93, Khan: 65, 学而思: 70, Duolingo: 55 },
  { subject: '社群驱动', 智学伴: 85, Khan: 60, 学而思: 65, Duolingo: 90 },
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
    text: '每周学习报告让我对自己的进度一清二楚，智能建议真的很精准。现在每天都期待打开智学伴！',
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

  const [activeCompetitor, setActiveCompetitor] = useState<string | null>(null);
  const competitorNames = ['智学伴', 'Khan', '学而思', 'Duolingo'];
  const competitorColors = ['hsl(162,63%,45%)', 'hsl(220,70%,55%)', 'hsl(36,80%,52%)', 'hsl(0,70%,55%)'];

  const radarData = competitorData.map(d => {
    const obj: Record<string, string | number> = { subject: d.subject };
    if (!activeCompetitor || activeCompetitor === '智学伴') obj['智学伴'] = d['智学伴'];
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
            <span className="font-bold text-xl text-foreground tracking-tight">智学伴</span>
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
            <p className="text-muted-foreground text-pretty max-w-xl mx-auto">无论你的目标是什么，智学伴都有专属方案助你高效达成</p>
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
                          fillOpacity={name === '智学伴' ? 0.25 : 0.08}
                          strokeWidth={name === '智学伴' ? 2.5 : 1.5}
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
              加入 50,000+ 用户，体验全新的智能辅导。让 智学伴 成为你学业提升的得力助手。
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
            <div className="flex flex-col gap-4">
              <span className="text-2xl font-extrabold text-violet-600 tracking-tight">智学伴</span>
              <p className="text-sm text-muted-foreground leading-relaxed">
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
              <span className="text-base font-bold text-primary">智学伴</span>
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
            <span>© 2026 智学伴. All rights reserved. Made with ♡ by wyxpro</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
