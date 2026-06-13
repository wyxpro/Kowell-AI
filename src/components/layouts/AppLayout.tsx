import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import NotificationBell from '@/components/common/NotificationBell';
import GlobalSearch from '@/components/common/GlobalSearch';
import { AnimatePresence, motion } from 'motion/react';
import {
  Home, BookOpen, Route, MessageCircle, BarChart3, Users, User, LogOut, Menu,
  GraduationCap, Search, Trophy, Medal, TrendingUp,
  Code2, Target, Compass, Wrench, Brain,
  GitBranch, ChevronDown, Gift,
} from 'lucide-react';

// ─── 工具箱工具列表 ────
const TOOLBOX_ITEMS = [
  { label: '错题本',     icon: BookOpen,  href: '/tools',             color: 'text-rose-500',    bg: 'bg-rose-50 dark:bg-rose-900/30'     },
  { label: '弱项强化',   icon: Target,    href: '/weakness-training', color: 'text-violet-500',  bg: 'bg-violet-50 dark:bg-violet-900/30' },
  { label: '知识图谱',   icon: GitBranch, href: '/knowledge-graph',   color: 'text-sky-500',     bg: 'bg-sky-50 dark:bg-sky-900/30'       },
  { label: '代码实验室', icon: Code2,     href: '/code-lab',          color: 'text-indigo-500',  bg: 'bg-indigo-50 dark:bg-indigo-900/30' },
];

const navGroups = [
  {
    label: '学习中心',
    items: [
      { path: '/',                   label: '首页',     icon: Home          },
      { path: '/resources/generate', label: '资源中心', icon: BookOpen      },
      { path: '/learning-path',      label: '学习路径', icon: Route         },
      { path: '/portrait',           label: '画像构建', icon: Brain         },
      { path: '/tutoring',           label: '智能答疑', icon: MessageCircle },
      { path: '/evaluation',         label: '学习评估', icon: BarChart3     },
      { path: '/report',             label: '数据报告', icon: TrendingUp    },
    ],
  },
  {
    label: '社区与成就',
    items: [
      { path: '/community',   label: '学习社群', icon: Users  },
      { path: '/badges',      label: '成就徽章', icon: Trophy },
      { path: '/leaderboard', label: '排行榜',   icon: Medal  },
    ],
  },
];

// ─── 侧边栏内容（含 inline 工具箱 accordion） ───────────────────
function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();

  const toolboxPaths = TOOLBOX_ITEMS.map(t => t.href);
  const isToolboxActive = toolboxPaths.some(p => location.pathname === p) || location.pathname === '/tools';

  // 初始值：若当前在工具箱路径则直接展开
  const [toolboxOpen, setToolboxOpen] = useState(() => isToolboxActive);

  // 进入工具箱路径时保持展开，离开时不强制关闭（保留用户状态）
  useEffect(() => {
    if (isToolboxActive) setToolboxOpen(true);
  }, [isToolboxActive]);

  // 子菜单导航：工具箱保持展开，仅移动端侧边栏关闭
  const handleToolNav = (path: string) => {
    navigate(path);
    onNavigate?.();
  };

  // 主按钮点击：激活状态下不允许折叠（防止 useEffect 抖动）
  const handleToolboxToggle = () => {
    if (isToolboxActive) {
      // 已在工具箱页面：只允许展开，不折叠
      setToolboxOpen(true);
    } else {
      setToolboxOpen(v => !v);
    }
  };

  return (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
      {/* Logo */}
      <div className="p-4 flex items-center gap-3">
        <Link to="/landing" className="flex items-center gap-3 min-w-0 group" onClick={onNavigate}>
          <div className="w-9 h-9 rounded-xl bg-sidebar-primary flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
            <GraduationCap className="w-5 h-5 text-sidebar-primary-foreground" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-bold text-sidebar-foreground">智学伴</h1>
            <p className="text-xs text-sidebar-foreground/60">个性化学习系统</p>
          </div>
        </Link>
      </div>
      <Separator className="bg-sidebar-border" />
      <ScrollArea className="flex-1 px-3 py-3">
        <nav className="space-y-4">
          {navGroups.map((group) => (
            <div key={group.label}>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40 px-3 mb-1">{group.label}</p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = location.pathname === item.path ||
                    (item.path !== '/' && item.path.length > 1 && location.pathname.startsWith(item.path));
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={onNavigate}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                        isActive
                          ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm'
                          : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                      }`}
                    >
                      <item.icon className="w-4 h-4 shrink-0" />
                      {item.label}
                    </Link>
                  );
                })}

                {/* 工具箱 inline accordion — 跟随学习中心分组 */}
                {group.label === '学习中心' && (
                  <div>
                    <button
                      type="button"
                      onClick={handleToolboxToggle}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                        isToolboxActive
                          ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm'
                          : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                      }`}
                    >
                      <Wrench className="w-4 h-4 shrink-0" />
                      <span className="flex-1 text-left">学习工具箱</span>
                      <motion.div
                        animate={{ rotate: toolboxOpen ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <ChevronDown className="w-3.5 h-3.5 opacity-60" />
                      </motion.div>
                    </button>
                    {/* 子菜单：点击子项后保持展开 */}
                    <AnimatePresence initial={false}>
                      {toolboxOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.22, ease: 'easeInOut' }}
                          className="overflow-hidden"
                        >
                          <div className="ml-3 mt-0.5 pl-3 border-l border-sidebar-border space-y-0.5 py-1">
                            {TOOLBOX_ITEMS.map(tool => {
                              const active = location.pathname === tool.href;
                              return (
                                <button
                                  key={tool.href}
                                  type="button"
                                  onClick={() => handleToolNav(tool.href)}
                                  className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 ${
                                    active
                                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                                      : 'text-sidebar-foreground/60 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground'
                                  }`}
                                >
                                  <div className={`w-5 h-5 rounded-md ${tool.bg} flex items-center justify-center shrink-0`}>
                                    <tool.icon className={`w-3 h-3 ${tool.color}`} />
                                  </div>
                                  {tool.label}
                                </button>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            </div>
          ))}
        </nav>
      </ScrollArea>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { user, profile, signOut } = useAuth();
  const location = useLocation();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* 桌面端侧边栏 */}
      <aside className="hidden md:block w-60 shrink-0 border-r border-sidebar-border">
        <div className="sticky top-0 h-screen">
          <SidebarContent />
        </div>
      </aside>

      {/* 移动端侧边栏 */}
      <Sheet open={open} onOpenChange={setOpen}>
        <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-background/80 backdrop-blur-md border-b border-border px-4 py-3 flex items-center gap-3">
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="shrink-0 h-9 w-9">
              <Menu className="w-5 h-5" />
            </Button>
          </SheetTrigger>
          <div className="flex items-center gap-2 min-w-0">
            <GraduationCap className="w-5 h-5 text-primary shrink-0" />
            <span className="font-bold text-sm truncate">智学伴</span>
          </div>
          {user && (
            <div className="ml-auto flex items-center gap-1.5 shrink-0">
              <NotificationBell />
              <UserMenu profile={profile} signOut={signOut} />
            </div>
          )}
        </div>
        <SheetContent side="left" className="p-0 w-60 bg-sidebar border-sidebar-border">
          <SheetTitle className="sr-only">导航菜单</SheetTitle>
          <SidebarContent onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* 主内容区 */}
      <main className="flex-1 min-w-0 md:pt-0 pt-14 flex flex-col">
        {/* 桌面端顶部栏 */}
        <div className="hidden md:flex items-center justify-between gap-2 px-6 py-3 border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-30">
          {/* 搜索框 — 扩大宽度 */}
          <Button
            variant="outline"
            size="sm"
            className="text-muted-foreground hover:text-foreground gap-2 h-8 w-72 justify-start"
            onClick={() => setSearchOpen(true)}
          >
            <Search className="w-3.5 h-3.5 shrink-0" />
            <span className="text-xs flex-1 text-left">搜索资源、课程...</span>
            <kbd className="hidden lg:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono shrink-0">
              <span>Ctrl</span>+<span>K</span>
            </kbd>
          </Button>

          {/* 右侧操作区：通知 → 产品可视化 → 邀请 → 头像 */}
          <div className="flex items-center gap-1.5">
            {/* 通知铃 */}
            {user && <NotificationBell />}

            {/* 产品可视化 */}
            <Link to="/strategy">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" title="产品可视化">
                <Compass className="w-4 h-4" />
              </Button>
            </Link>

            <Separator orientation="vertical" className="h-5 mx-0.5" />

            {/* 邀请有礼·积分与套餐 */}
            {user && (
              <Link to="/invite">
                <Button size="sm" className="h-8 gap-1.5 text-xs font-semibold bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-white border-0 shadow-sm px-3">
                  <Gift className="w-3.5 h-3.5" />
                  <span className="hidden lg:inline">邀请有礼 · 积分套餐</span>
                  <span className="lg:hidden">邀请</span>
                </Button>
              </Link>
            )}

            {/* 头像 */}
            {user && <UserMenu profile={profile} signOut={signOut} />}
          </div>
        </div>

        <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}

// ─── 用户菜单下拉（点击头像直接跳转个人中心；下拉含个人中心+退出） ───
function UserMenu({ profile, signOut }: { profile: { username?: string | null; avatar_url?: string | null } | null; signOut: () => void }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      {/* 点击头像直接进入个人中心 */}
      <button
        type="button"
        onClick={() => navigate('/profile')}
        className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-muted transition-colors text-sm font-medium"
        title="个人中心"
      >
        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden shrink-0">
          {profile?.avatar_url
            ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
            : <User className="w-3.5 h-3.5 text-primary" />
          }
        </div>
        <span className="hidden sm:inline text-xs max-w-[80px] truncate">{profile?.username || '我的'}</span>
        <ChevronDown className="w-3 h-3 text-muted-foreground" onClick={(e) => { e.stopPropagation(); setOpen(v => !v); }} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-1.5 w-48 bg-popover border border-border rounded-xl shadow-lg overflow-hidden z-50"
          >
            <div className="px-3 py-2.5 border-b border-border">
              <p className="text-xs font-semibold truncate">{profile?.username || '用户'}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">个人账户</p>
            </div>
            <div className="p-1">
              <button type="button" onClick={() => { navigate('/profile'); setOpen(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm hover:bg-muted transition-colors text-left">
                <User className="w-3.5 h-3.5 text-muted-foreground" />个人中心
              </button>
              <Separator className="my-1" />
              <button type="button" onClick={() => { signOut(); setOpen(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm hover:bg-destructive/10 text-destructive transition-colors text-left">
                <LogOut className="w-3.5 h-3.5" />退出登录
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

