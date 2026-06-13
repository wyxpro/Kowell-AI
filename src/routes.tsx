import { lazy, Suspense, type ReactNode } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import ErrorBoundary from '@/components/common/ErrorBoundary';

const LandingPage = lazy(() => import('./pages/LandingPage'));
const HomePage = lazy(() => import('./pages/HomePage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const PortraitPage = lazy(() => import('./pages/PortraitPage'));
const ResourcesPage = lazy(() => import('./pages/ResourcesPage'));
const ResourceGeneratePage = lazy(() => import('./pages/ResourceGeneratePage'));
const ResourceDetailPage = lazy(() => import('./pages/ResourceDetailPage'));
const ResourceEditPage = lazy(() => import('./pages/ResourceEditPage'));
const LearningPathPage = lazy(() => import('./pages/LearningPathPage'));
const TutoringPage = lazy(() => import('./pages/TutoringPage'));
const EvaluationPage = lazy(() => import('./pages/EvaluationPage'));
const AgentVizPage = lazy(() => import('./pages/AgentVizPage'));
const CommunityPage = lazy(() => import('./pages/CommunityPage'));
const WrongBookPage = lazy(() => import('./pages/WrongBookPage'));
const TodoPage = lazy(() => import('./pages/TodoPage'));
const ToolsPage = lazy(() => import('./pages/ToolsPage'));
const NotesPage = lazy(() => import('./pages/NotesPage'));
const ReportPage = lazy(() => import('./pages/ReportPage'));
const BadgesPage = lazy(() => import('./pages/BadgesPage'));
const LeaderboardPage = lazy(() => import('./pages/LeaderboardPage'));
const KnowledgeGraphPage = lazy(() => import('./pages/KnowledgeGraphPage'));
const CodeLabPage = lazy(() => import('./pages/CodeLabPage'));
const WeaknessTrainingPage = lazy(() => import('./pages/WeaknessTrainingPage'));
const StrategyPage = lazy(() => import('./pages/StrategyPage'));
const InvitePage = lazy(() => import('./pages/InvitePage'));
const OrderDetailPage = lazy(() => import('./pages/OrderDetailPage'));

function PageLoader() {
  return (
    <div className="p-6 space-y-4">
      <Skeleton className="h-8 w-48 bg-muted" />
      <Skeleton className="h-64 bg-muted rounded-xl" />
      <Skeleton className="h-32 bg-muted rounded-xl" />
    </div>
  );
}

function wrap(element: ReactNode): ReactNode {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>{element}</Suspense>
    </ErrorBoundary>
  );
}

export interface RouteConfig {
  name: string;
  path: string;
  element: ReactNode;
  visible?: boolean;
  public?: boolean;
}

export const routes: RouteConfig[] = [
  { name: '官网', path: '/landing', element: wrap(<LandingPage />), public: true },
  { name: '首页', path: '/', element: wrap(<HomePage />), public: true },
  { name: '登录', path: '/login', element: wrap(<LoginPage />), public: true },
  { name: '个人中心', path: '/profile', element: wrap(<ProfilePage />) },
  { name: '学习画像', path: '/portrait', element: wrap(<PortraitPage />) },
  { name: '资源中心', path: '/resources', element: wrap(<ResourcesPage />) },
  { name: '生成资源', path: '/resources/generate', element: wrap(<ResourceGeneratePage />) },
  { name: '资源详情', path: '/resources/:id', element: wrap(<ResourceDetailPage />) },
  { name: '编辑资源', path: '/resources/:id/edit', element: wrap(<ResourceEditPage />) },
  { name: '学习路径', path: '/learning-path', element: wrap(<LearningPathPage />) },
  { name: '答疑中心', path: '/tutoring', element: wrap(<TutoringPage />) },
  { name: '学习评估', path: '/evaluation', element: wrap(<EvaluationPage />) },
  { name: '智能体可视化', path: '/agent-viz', element: wrap(<AgentVizPage />) },
  { name: '学习社群', path: '/community', element: wrap(<CommunityPage />) },
  { name: '错题本', path: '/wrong-book', element: wrap(<WrongBookPage />) },
  { name: '今日待办', path: '/todos', element: wrap(<TodoPage />) },
  { name: '我的笔记', path: '/notes', element: wrap(<NotesPage />) },
  { name: '学习工具箱', path: '/tools', element: wrap(<ToolsPage />) },
  { name: '学习报告', path: '/report', element: wrap(<ReportPage />) },
  { name: '成就徽章', path: '/badges', element: wrap(<BadgesPage />) },
  { name: '排行榜', path: '/leaderboard', element: wrap(<LeaderboardPage />) },
  { name: '知识图谱', path: '/knowledge-graph', element: wrap(<KnowledgeGraphPage />) },
  { name: '代码实验室', path: '/code-lab', element: wrap(<CodeLabPage />) },
  { name: '弱项强化', path: '/weakness-training', element: wrap(<WeaknessTrainingPage />) },
  { name: '产品可视化',        path: '/strategy', element: wrap(<StrategyPage />) },
  { name: '邀请有礼积分套餐', path: '/invite',   element: wrap(<InvitePage />) },
  { name: '订单详情', path: '/order/:orderId', element: wrap(<OrderDetailPage />) },
];

