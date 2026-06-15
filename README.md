# 🎓 Kowell AI — 多智能体智能学习平台
[![React](https://img.shields.io/badge/React-18.x-blue.svg)](https://reactjs.org/) [![Vite](https://img.shields.io/badge/Vite-5.x-646CFF.svg)](https://vitejs.dev/) [![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6.svg)](https://www.typescriptlang.org/) [![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.x-38B2AC.svg)](https://tailwindcss.com/) [![Supabase](https://img.shields.io/badge/Supabase-BaaS-3ECF8E.svg)](https://supabase.com/) [![Zustand](https://img.shields.io/badge/Zustand-State-764ABC.svg)](https://github.com/pmndrs/zustand)
---

## 📋 项目简介
**Kowell AI**是一款面向高等教育阶段（本科、研究生、高职）学生的个性化智能学习平台。系统聚焦于计算机、人工智能、电子信息等专业方向，构建了「画像构建-资源生成-路径规划-学习辅导-效果评估」的Agent闭环个性化教学服务。通过高度集成的多智能体协作、数据可视化、三维交互与富文本编辑工具，为学生提供科学且生动的沉浸式学习体验。

**项目亮点：**
- 🤖 深度集成多路 AI 大模型（聊天、评估、生成、推荐）
- 🎨 支持 Three.js 3D 场景与 Framer Motion 流体动效
- 🔐 完整的 Supabase Auth + RLS 身份认证与行级权限体系
- 💳 内置积分系统、套餐订阅与微信支付 Webhook
- 📱 响应式双端布局（桌面侧边栏 + 移动端适配）

---

## 🛠️ 技术栈

### 前端核心

| 技术 | 版本 | 用途 |
|------|------|------|
| **React** | 18.x | 声明式 UI 框架，组件化开发 |
| **TypeScript** | 5.x | 全链路静态类型校验 |
| **Vite** (Rolldown) | latest | 毫秒级 HMR，高速生产打包 |
| **React Router** | v7.x | SPA 路由，支持 lazy 按需加载 |
| **Recharts** | 学习趋势、评估雷达等数据图表 |
| **Three.js** | 3D 交互场景（知识图谱等） |
| **docx / pptxgenjs** | 在线导出 Word/PPT 格式资源 |
| **eventsource-parser** | AI 流式输出 (SSE) 实时解析 |
| **Biome** | 统一的 Lint 与格式化工具链 |
| **Zustand** | 5.x | 轻量全局状态管理 + `persist` 持久化 |
| **Tailwind CSS 3.x** | 原子化样式，CSS 变量主题系统 |
| **Radix UI** | 无头可访问性基础组件（50+ 组件封装） |
| **Shadcn/ui** 风格 | 基于 Radix 的高保真 UI 组件库 |
| **Framer Motion** | 页面过渡、微动画、流体交互效果 |

### 后端与数据

| 技术 | 用途 |
|------|------|
| **Supabase BaaS** | PostgreSQL 数据库、GoTrue Auth、实时订阅 |
| **Supabase Edge Functions** | 13 个 Deno 无服务器函数（AI、支付、TTS 等） |
| **Supabase Storage** | 文件/图片上传与访问控制 |
| **数据库迁移** | 8 个版本化 SQL Migration 脚本 |


---

## 📁 目录结构

```text
Kowell AI/
├── docs/
│   └── prd.md                    # 完整产品需求文档（13节，377行）
├── public/                       # 静态资源（图标、模型素材等）
├── src/
│   ├── components/
│   │   ├── ai/
│   │   │   └── AIChatPanel.tsx   # 通用 AI 对话面板（SSE 流式输出）
│   │   ├── common/
│   │   │   ├── AuthContext.tsx   # 路由鉴权守卫
│   │   │   ├── CheckInWidget.tsx # 每日打卡组件
│   │   │   ├── ErrorBoundary.tsx # 全局错误边界
│   │   │   ├── GlobalSearch.tsx  # 全局搜索弹窗
│   │   │   ├── NotificationBell.tsx # 通知铃铛
│   │   │   └── RouteGuard.tsx    # 路由权限拦截
│   │   ├── layouts/
│   │   │   └── AppLayout.tsx     # 主布局（侧边栏+顶栏+内容区）
│   │   ├── tutoring/             # 答疑专属子组件
│   │   ├── voice/                # 语音通话 UI 组件
│   │   └── ui/                   # 50+ Radix/Shadcn 基础组件
│   ├── contexts/
│   │   └── AuthContext.tsx       # 用户认证 Context（含 Profile 管理）
│   ├── db/
│   │   └── supabase.ts           # Supabase 客户端初始化
│   ├── hooks/
│   │   ├── use-debounce.ts       # 防抖 Hook
│   │   ├── use-go-back.ts        # 路由回退 Hook
│   │   ├── use-mobile.tsx        # 移动端断点检测
│   │   └── use-supabase-upload.ts# 文件上传封装
│   ├── pages/                    # 29 个业务页面（620 KB，21,720+ 行）
│   ├── services/                 # API 服务调用层
│   ├── store/
│   │   └── useAppStore.ts        # 全局状态（主题/侧边栏/打卡/连续天数）
│   ├── types/
│   │   └── types.ts              # 20+ 核心业务类型定义（320行）
│   ├── App.tsx                   # 根组件（Router + AuthProvider + RouteGuard）
│   ├── routes.tsx                # 27 条路由配置（全部 lazy 异步加载）
│   └── index.css                 # Tailwind 基础层 + CSS 变量主题
├── supabase/
│   ├── functions/                # 13 个 Edge Functions（见 API 章节）
│   ├── migrations/               # 8 个版本化数据库迁移脚本
│   └── schema.sql                # 完整数据库 Schema（184 KB）
├── .env                          # 环境变量（Supabase URL + Anon Key）
├── package.json                  # 79 个生产依赖 + 16 个开发依赖
├── tailwind.config.js            # Tailwind 主题扩展
└── vite.config.ts                # Vite 构建配置
```

---

## ⚡ 核心功能模块和工作流程

### 🗺️ 功能模块总览

```
智学伴系统（27条路由）
├── 🏠 公开页面
│   ├── /landing         官网介绍页（含产品特性、套餐展示）
│   ├── /              首页总览（快捷入口、学习进度概览、今日推荐）
│   └── /login          登录/注册（邮箱密码 + Supabase Auth）
├── 👤 个人中心模块
│   ├── /profile         个人资料编辑与学习记录查看
│   └── /portrait        学习画像构建（6维对话式 + 语音通话）
├── 📚 资源模块
│   ├── /resources        资源列表（分类筛选/已读未读状态）
│   ├── /resources/generate  AI 生成 7 类资源（SSE 流式进度）
│   ├── /resources/:id    资源详情（在线阅读/下载/版本管理）
│   └── /resources/:id/edit  资源内容编辑（文档/思维导图/题库）
├── 🎯 学习核心模块
│   ├── /learning-path    多阶段学习路径地图（节点/进度/资源关联）
│   ├── /tutoring         智能答疑（数字人教师 + 多模态解答）
│   └── /evaluation       学习效果评估（多维报告 + 趋势图表）
├── 🧰 学习工具箱
│   ├── /todos            今日待办（任务打卡 + 优先级管理）
│   ├── /notes            我的笔记（富文本编辑 + 错题数据统计）
│   ├── /wrong-book       错题本（按知识点分类 + 解析查看）
│   ├── /weakness-training 弱项强化（AI 推荐精准特训资源）
│   ├── /knowledge-graph   知识图谱（Three.js 可视化关联关系）
│   ├── /code-lab          代码实验室（多语言在线编辑+沙箱运行）
│   └── /report            学习报告（周/月维度统计 + AI 建议）
├── 🏆 激励社交模块
│   ├── /badges            成就徽章（4稀有度分级系统）
│   ├── /leaderboard       学习排行榜（时长积分综合排名）
│   └── /community         学习社群（发帖/分享资源/回复互动）
└── 💡 拓展功能
    ├── /agent-viz         智能体工作流可视化（状态动画+日志）
    ├── /strategy          竞争战略看板（含多智能体协作面板）
    ├── /invite            邀请有礼（专属邀请码+积分体系）
    └── /order/:orderId    订单详情（套餐购买记录）
```

### 🔄 核心学习闭环流程

```mermaid
flowchart TD
    A([用户注册/登录]) --> B[填写专业·学历·目标]
    B --> C[对话式构建学习画像\n6维度动态模型]
    C --> D[AI 规划个性化学习路径]

    D --> E{日常学习循环}
    E -->|主动学习| F[资源中心\nAI生成7类资源]
    E -->|遇到困难| G[智能答疑\n数字人+多模态]
    E -->|动手实践| H[代码实验室\n多语言沙箱]
    E -->|查漏补缺| I[错题本+弱项强化]

    F & G & H & I --> J[完成学习节点\n更新进度]
    J --> K[阶段效果评估\n知识/效率/薄弱点]
    K -->|画像动态更新| C
    K --> L[成就徽章+积分奖励]
    L --> M[排行榜排名上升]
    M -->|社群分享激励| E
```

### 🧩 模块详解

#### 1. 🧠 学习画像系统
- **6维度建模**：知识基础 / 认知风格 / 易错偏好 / 学习节奏 / 学习目标 / 专业方向
- **对话式采集**：自然语言输入，AI 渐进式引导完善各维度
- **动态更新机制**：完成 10+ 题或累计学习 2+ 小时后自动触发画像更新
- **语音通话模式**：仿移动通话 UI，支持静音/切换摄像头/挂断等操作

#### 2. 📖 智能资源生成
- 支持按**专业 → 课程 → 章节**三级粒度精准生成
- 一键生成 7 类结构化资源：**教学案例、知识思维导图、练习题库、动画演示、课件PPT、代码实操案例、学习视频**
- SSE 流式进度展示，生成完成后可在线编辑和多版本管理
- 支持 docx / pptx 格式导出下载

#### 3. 🤖 智能答疑（数字人教师）
- 默认渲染**教室场景背景**，支持预设/自定义背景切换
- 三种解答形式自由选择：**详细文字解答、图解说明、短视频讲解**
- 问题自动关联推荐 3 个相关知识点资源
- 错题/疑问一键存入个人错题本

#### 4. 🏆 游戏化激励体系
- 4 级稀有度徽章：**普通 / 稀有 / 史诗 / 传说**
- 每日打卡维护学习连续天数 streak
- 全站排行榜实时学习时长积分榜单
- 邀请好友获积分，积分可兑换套餐或资源

---

## ⚙️ 部署指南

### 📋 环境要求

| 依赖 | 最低版本 |
|------|----------|
| Node.js | `v20.x` |
| npm | `v10.x` |
| pnpm（可选推荐） | `v9.x` |

### 🚀 本地开发步骤

**Step 1 — 克隆/下载项目**
```bash
# 进入项目目录
cd "Kowell AI"
```

**Step 2 — 配置环境变量**

在根目录创建或确认 `.env` 文件包含以下变量：
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_APP_ID=your-app-id
```

**Step 3 — 安装依赖**
```bash
npm install
# 或推荐使用 pnpm（更快更省磁盘）
pnpm install
```

**Step 4 — 初始化数据库**

在 Supabase 控制台的 SQL Editor 中，按顺序执行 `supabase/migrations/` 下的 8 个迁移文件：
```
00001_create_all_tables.sql
00002_add_enhancement_tables_and_columns.sql
00003_pa_new_features_tables.sql
00004_fix_auth_trigger_and_rls.sql
00005_add_role_to_user_profiles.sql
00006_invite_points_plans.sql
00007_create_payment_tables.sql
00008_add_plan_fields_to_user_profiles.sql
```

**Step 5 — 启动开发服务器**
```bash
npm run dev
```
> 访问 `http://localhost:5173` 即可看到应用

### 🏗️ 生产构建

```bash
# 代码质量检查（TS 类型 + Biome lint）
npm run lint

# 构建生产包（输出至 dist/ 目录）
npm run build
```

将 `dist/` 目录部署至任意静态托管平台：
- **Vercel / Netlify**：直接连接 Git 仓库，自动部署
- **Nginx**：配置 `try_files $uri /index.html;` 支持 SPA 路由
- **CDN**：上传 `dist/` 内容到对象存储并开启静态托管

---

## 📦 API 接口

### 🔑 Supabase 数据库表（核心）

| 表名 | 功能描述 |
|------|----------|
| `user_profiles` | 用户基础信息（专业/学历/目标/套餐等级） |
| `learning_portraits` | 学习画像 6 维数据（JSON 结构化存储） |
| `courses` | 课程定义与章节列表 |
| `resources` | 学习资源（含类型/状态/版本/评分） |
| `learning_paths` | 学习路径与阶段进度 |
| `exercises` | 习题库（含选项/解析/AI标记） |
| `user_exercise_submissions` | 用户答题记录（含 AI 评分反馈） |
| `wrong_book_entries` | 错题本（关联题目+笔记+掌握状态） |
| `daily_todos` | 每日待办任务 |
| `notes` | 学习笔记（关联资源/题目） |
| `user_check_ins` | 打卡记录（每日学习时长） |
| `badges` / `user_badges` | 成就徽章定义与用户解锁记录 |
| `community_posts` / `community_replies` | 社群帖子与回复 |
| `invite_records` / `point_transactions` | 邀请记录与积分流水 |
| `subscription_plans` / `payment_orders` | 套餐定义与支付订单 |

### ☁️ Supabase Edge Functions（13 个无服务器函数）

| Function 名称 | 功能 |
|--------------|------|
| `ai-chat` | AI 对话主接口（支持 SSE 流式输出，画像构建/答疑双场景） |
| `ai-generate` | AI 批量生成学习资源（触发 7 类资源并行创建） |
| `ai-evaluate` | AI 学习效果评估（分析答题数据，输出多维报告） |
| `ai-recommend` | AI 个性化资源推荐（基于画像与学习进度） |
| `image-generations` | AI 图像生成（图解/思维导图配图） |
| `kling-video-create` | 可灵 AI 视频生成任务创建 |
| `kling-video-query` | 可灵 AI 视频生成任务状态查询 |
| `minimax-tts` | MiniMax 文字转语音（答疑中心朗读功能） |
| `web-reader` | 网页内容抓取与摘要（资源拓展阅读） |
| `create-payment-order` | 创建套餐支付订单 |
| `wechat-payment-webhook` | 微信支付异步回调处理 |
| `admin-setup` | 管理员初始化配置 |
| `_shared` | 跨 Function 共享工具函数 |

### 🔐 认证 API（AuthContext）

```typescript
// 邮箱注册（自动触发 user_profiles 行创建）
signUpWithEmail(email, password, { username, major, education })

// 邮箱登录
signInWithEmail(email, password)

// 登出
signOut()

// 刷新用户画像缓存
refreshProfile()
```

---

## 👾 项目代码及界面规模

### 📊 代码规模统计

| 指标 | 数值 |
|------|------|
| **TSX / TS 源文件总数** | **109 个** |
| **源码总大小** | **926.6 KB** |
| **源码总行数** | **21,720 行** |
| **业务页面数量** | **29 个页面** |
| **页面源码总大小** | **620.1 KB** |
| **UI 基础组件数量** | **50+ 个** |
| **路由配置数量** | **27 条路由** |
| **数据库迁移脚本** | **8 个版本** |
| **Edge Functions** | **13 个函数** |
| **数据库 Schema** | **184 KB（完整）** |
| **生产依赖数量** | **79 个** |

### 📄 最大页面文件（复杂度 TOP 5）

| 页面文件 | 大小 | 主要功能 |
|---------|------|----------|
| `LandingPage.tsx` | 54.2 KB | 官网营销页，多区块动效设计 |
| `LearningPathPage.tsx` | 48.4 KB | 多阶段路径图、节点交互 |
| `StrategyPage.tsx` | 43.4 KB | 竞争战略 + 多智能体协作面板 |
| `ResourceGeneratePage.tsx` | 43.1 KB | AI 资源生成流程全交互 |
| `EvaluationPage.tsx` | 39.6 KB | 多维学习评估报告与趋势图 |

### 🗄️ 全局状态管理（Zustand Store）

`useAppStore` 持久化状态涵盖：
- **主题偏好**（light / dark / system）
- **侧边栏折叠状态**（桌面端）
- **今日打卡状态**（防重复打卡）
- **连续学习天数 Streak**
- **未读通知计数**

---

## 💡 常见问题

**Q1：启动后页面显示空白或 AI 功能无响应，怎么处理？**
> 90% 的情况是 `.env` 环境变量未配置或配置错误。请确认 `.env` 文件存在于项目根目录，且 `VITE_SUPABASE_URL` 与 `VITE_SUPABASE_ANON_KEY` 填写了正确的 Supabase 项目凭证。

**Q2：数据库报错"表不存在"或注册后无法创建用户资料？**
> 请确保已按顺序执行 `supabase/migrations/` 目录下全部 8 个 SQL 迁移脚本。其中 `00004_fix_auth_trigger_and_rls.sql` 包含了注册时自动创建 `user_profiles` 行的触发器，必须执行。

**Q3：如何切换平台主题颜色风格？**
> 修改 `src/index.css` 中 `:root` 和 `.dark` 选择器下的 CSS 变量（如 `--primary`、`--background`、`--card`），或在 `tailwind.config.js` 中扩展自定义颜色。所有组件均通过 CSS 变量响应主题变化，无需逐一修改。

