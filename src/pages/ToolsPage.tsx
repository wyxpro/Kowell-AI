import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layouts/AppLayout';
import { motion } from 'motion/react';
import {
  CheckSquare, StickyNote, BookMarked, Target, GitBranch,
  Code2, BarChart3, ChevronRight, Sparkles, Zap,
} from 'lucide-react';

const tools = [
  {
    label: '今日待办',
    desc: '管理每日学习任务，定时提醒不遗漏',
    icon: CheckSquare,
    href: '/todos',
    from: 'from-emerald-500',
    to: 'to-teal-400',
    iconBg: 'bg-emerald-50 dark:bg-emerald-900/30',
    iconColor: 'text-emerald-500',
    shadow: 'hover:shadow-emerald-100 dark:hover:shadow-emerald-900/30',
    badge: null,
  },
  {
    label: '我的笔记',
    desc: '随时记录学习心得，支持标签与搜索',
    icon: StickyNote,
    href: '/notes',
    from: 'from-amber-500',
    to: 'to-yellow-400',
    iconBg: 'bg-amber-50 dark:bg-amber-900/30',
    iconColor: 'text-amber-500',
    shadow: 'hover:shadow-amber-100 dark:hover:shadow-amber-900/30',
    badge: null,
  },
  {
    label: '错题本',
    desc: '自动归类错误，反复训练直至掌握',
    icon: BookMarked,
    href: '/wrong-book',
    from: 'from-rose-500',
    to: 'to-pink-400',
    iconBg: 'bg-rose-50 dark:bg-rose-900/30',
    iconColor: 'text-rose-500',
    shadow: 'hover:shadow-rose-100 dark:hover:shadow-rose-900/30',
    badge: null,
  },
  {
    label: '弱项强化',
    desc: '智能识别知识盲点，针对性提升突破',
    icon: Target,
    href: '/weakness-training',
    from: 'from-violet-500',
    to: 'to-purple-400',
    iconBg: 'bg-violet-50 dark:bg-violet-900/30',
    iconColor: 'text-violet-500',
    shadow: 'hover:shadow-violet-100 dark:hover:shadow-violet-900/30',
    badge: '推荐',
  },
  {
    label: '知识图谱',
    desc: '可视化知识体系，清晰概念关联',
    icon: GitBranch,
    href: '/knowledge-graph',
    from: 'from-sky-500',
    to: 'to-cyan-400',
    iconBg: 'bg-sky-50 dark:bg-sky-900/30',
    iconColor: 'text-sky-500',
    shadow: 'hover:shadow-sky-100 dark:hover:shadow-sky-900/30',
    badge: null,
  },
  {
    label: '代码实验室',
    desc: '在线运行 8 种编程语言，AI 审阅即时反馈',
    icon: Code2,
    href: '/code-lab',
    from: 'from-indigo-500',
    to: 'to-blue-400',
    iconBg: 'bg-indigo-50 dark:bg-indigo-900/30',
    iconColor: 'text-indigo-500',
    shadow: 'hover:shadow-indigo-100 dark:hover:shadow-indigo-900/30',
    badge: null,
  },
  {
    label: '数据报告',
    desc: '多维度分析学习进度，智能建议可行',
    icon: BarChart3,
    href: '/report',
    from: 'from-primary',
    to: 'to-emerald-400',
    iconBg: 'bg-primary/10',
    iconColor: 'text-primary',
    shadow: 'hover:shadow-primary/10',
    badge: null,
  },
];

export default function ToolsPage() {
  const navigate = useNavigate();

  return (
    <AppLayout>
      <div className="space-y-6 max-w-5xl mx-auto">
        {/* 顶部标题横幅 */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/90 via-primary to-emerald-500 p-6 text-white shadow-lg"
        >
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-full px-3 py-1 text-xs font-medium mb-3">
              <Sparkles className="w-3.5 h-3.5" />快捷入口
            </div>
            <h1 className="text-2xl font-bold mb-1">学习工具箱</h1>
            <p className="text-white/80 text-sm">整合所有学习工具于一处，快速跳转提升学习效率</p>
          </div>
          <div className="absolute -right-8 -top-8 w-36 h-36 rounded-full bg-white/10 pointer-events-none" />
          <div className="absolute -right-4 -bottom-12 w-52 h-52 rounded-full bg-white/5 pointer-events-none" />
        </motion.div>

        {/* 工具卡片网格 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tools.map((tool, idx) => (
            <motion.div
              key={tool.href}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              whileHover={{ y: -3, transition: { duration: 0.2 } }}
            >
              <button
                type="button"
                onClick={() => navigate(tool.href)}
                className={`group w-full text-left bg-card rounded-2xl border border-border p-5 shadow-sm transition-all duration-200 hover:shadow-lg ${tool.shadow} hover:border-transparent flex flex-col gap-4`}
              >
                <div className="flex items-start justify-between">
                  <div className={`w-12 h-12 rounded-xl ${tool.iconBg} flex items-center justify-center`}>
                    <tool.icon className={`w-6 h-6 ${tool.iconColor}`} />
                  </div>
                  {tool.badge && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                      {tool.badge}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-semibold text-balance mb-1">{tool.label}</h3>
                  <p className="text-sm text-muted-foreground text-pretty leading-relaxed">{tool.desc}</p>
                </div>
                <div className="flex items-center gap-2 text-sm font-medium group-hover:gap-3 transition-all duration-200">
                  <span className={`bg-gradient-to-r ${tool.from} ${tool.to} bg-clip-text text-transparent`}>点击使用</span>
                  <ChevronRight className={`w-4 h-4 ${tool.iconColor} group-hover:translate-x-1 transition-transform duration-200 flex-shrink-0`} />
                </div>
              </button>
            </motion.div>
          ))}
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-center text-xs text-muted-foreground flex items-center justify-center gap-1.5 pb-2"
        >
          <Zap className="w-3.5 h-3.5 text-primary" />
          所有功能均保留原有界面与逻辑，只是将入口收纳到工具箱中
        </motion.p>
      </div>
    </AppLayout>
  );
}
