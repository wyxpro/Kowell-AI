# 🎓 Kowell AI — 多智能体智能学习平台

[![React](https://img.shields.io/badge/React-18.x-blue.svg)](https://reactjs.org/) [![Vite](https://img.shields.io/badge/Vite-5.x-646CFF.svg)](https://vitejs.dev/) [![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6.svg)](https://www.typescriptlang.org/) [![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.x-38B2AC.svg)](https://tailwindcss.com/) [![Supabase](https://img.shields.io/badge/Supabase-BaaS-3ECF8E.svg)](https://supabase.com/) [![Zustand](https://img.shields.io/badge/Zustand-State-764ABC.svg)](https://github.com/pmndrs/zustand) [![DeepSeek](https://img.shields.io/badge/DeepSeek-v4--pro-orange.svg)](https://deepseek.com/)

---

## 📋 项目简介

**Kowell AI** 是一款面向高等教育（本科、研究生、高职）学生的个性化多智能体智能学习平台。系统聚焦于计算机、人工智能、电子信息等专业方向，构建了 **「画像构建-资源生成-路径规划-学习辅导-效果评估」** 的 Agent 闭环个性化教学服务。

平台通过高度集成的多智能体协作、数据可视化、三维交互与富文本编辑工具，为学生提供科学且生动的沉浸式学习体验。

### 🌟 项目核心亮点
* **🤖 深度集成 DeepSeek-v4-pro 大模型**：在原有 API 网关基础上，建立了独立的 AI 对接层，打通了非流式对话与基于 SSE (Server-Sent Events) 的流式文本输出。
* **🎨 拟物手风琴折叠交互 (Accordion Feature Blocks)**：主页“六大核心特色功能”模块采用硬件加速的 CSS Flex 变宽手风琴卡片，悬停即自动展开详情，拥有极速、丝滑的视觉过渡。
* **🗂️ 我的资源一站式管理 (CRUD)**：在“AI资源生成”页面增加了“我的资源”管理抽屉。采用高级暗色玻璃拟态分栏，支持对已生成的各类学习资源进行检索、预览、编辑及增删改查。
* **🔐 完整的 Supabase 权限体系**：内置 Supabase Auth 与行级安全控制 (RLS) 策略，保障每个用户数据在安全合规的环境下流转。
* **📱 响应式双端布局**：桌面端采用抽屉式侧边栏配合 3D 浮动面板，移动端深度优化，手风琴折叠自动转换为纵向弹性堆叠。

---

## 🛠️ 技术栈

### 💻 前端技术

| 技术/框架 | 版本 | 用途/核心功能 |
| :--- | :--- | :--- |
| **React** | 18.x | 声明式组件化开发框架，并发渲染 |
| **TypeScript** | 5.x | 全链路静态类型校验，减少运行时隐患 |
| **Vite** | 5.x | 毫秒级 HMR 热更新构建，基于 ESbuild 高速打包 |
| **React Router** | v7.x | 单页面应用 (SPA) 路由，支持 Lazy 异步按需加载 |
| **Zustand** | 5.x | 轻量级全局状态管理，使用 `persist` 中间件实现本地缓存持久化 |
| **Tailwind CSS** | 3.x | 原子化样式系统，结合 CSS 变量切换自适应深浅色主题 |
| **Framer Motion** | 11.x | 用于页面转场、手风琴缩放微动效以及浮动元素的弹性动效 |
| **Recharts** | - | 渲染学习分析曲线、综合评估雷达图等核心数据看板 |
| **Three.js** | - | 3D 渲染支持，用于知识图谱的交互式节点漫游 |
| **eventsource-parser** | - | AI 接口 SSE (Server-Sent Events) 流式流数据实时解析器 |
| **docx / pptxgenjs** | - | 前端一键生成并导出标准的 Word 和 PowerPoint 课件资源 |
| **Biome** | - | 代码格式化与 Lint 工具，保障代码风格一致性 |

### ☁️ 后端与数据层

| 技术/框架 | 用途/核心功能 |
| :--- | :--- |
| **Supabase BaaS** | 托管 PostgreSQL 数据库，自动生成 REST APIs，支持实时数据库订阅 |
| **Supabase Edge Functions** | 13 个 Deno 无服务器云函数，承载大模型调用、微信支付、语音合成等安全业务逻辑 |
| **GoTrue Auth** | 提供安全便捷的用户注册、邮箱验证、会话管理以及密码重置机制 |
| **Supabase Storage** | 存储并分发用户头像、课件、思维导图等非结构化媒介文件，支持加密防盗链 |
| **Database Migrations** | 8 个版本化 SQL 迁移脚本，负责数据表结构、触发器及 RLS 行级安全策略同步 |

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
│   │   │   └── AIChatPanel.tsx   # 通用 AI 对话面板（支持流式 SSE）
│   │   ├── common/
│   │   │   ├── AuthContext.tsx   # 路由鉴权上下文
│   │   │   ├── CheckInWidget.tsx # 每日学习签到打卡组件
│   │   │   ├── ErrorBoundary.tsx # 全局异常捕获器
│   │   │   ├── GlobalSearch.tsx  # 全局知识检索弹窗
│   │   │   ├── NotificationBell.tsx # 站内消息通知铃铛
│   │   │   └── RouteGuard.tsx    # SPA 路由权限拦截守卫
│   │   ├── layouts/
│   │   │   └── AppLayout.tsx     # 主应用布局（侧边栏、全局顶栏、面包屑）
│   │   ├── tutoring/             # 智能答疑专属子组件
│   │   ├── voice/                # 仿通话语音聊天界面组件
│   │   └── ui/                   # 50+ 经过 Radix/Shadcn 风格二次封装的无头 UI 组件
│   ├── contexts/
│   │   └── AuthContext.tsx       # 用户账户状态 context，托管 profile 数据
│   ├── db/
│   │   └── supabase.ts           # Supabase 客户端初始化连接配置
│   ├── hooks/
│   │   ├── use-debounce.ts       # 输入防抖 Hook
│   │   ├── use-go-back.ts        # 面包屑/历史回退控制 Hook
│   │   ├── use-mobile.tsx        # 双端视口断点检测 Hook
│   │   └── use-supabase-upload.ts# 封装的云存储大文件分块上传 Hook
│   ├── pages/                    # 29 个核心业务页面
│   ├── services/                 # 外部 APIs 调用层
│   │   └── ai/                   # 🤖 新增 AI 独立对接目录
│   │       ├── config.ts         # AI 密钥与代理基地址配置
│   │       ├── deepseek.ts       # DeepSeek-v4-pro 对接实现（含流式/非流式）
│   │       └── index.ts          # 统一服务导出入口
│   ├── store/
│   │   └── useAppStore.ts        # Zustand 全局 Store，托管主题、打卡天数及通知状态
│   ├── types/
│   │   └── types.ts              # 20+ 个核心业务实体 TypeScript 类型定义
│   ├── App.tsx                   # 根组件（路由分发、AuthProvider、Toast 服务）
│   ├── routes.tsx                # 27 条页面路由映射配置（启用 Lazy 延迟加载）
│   └── index.css                 # 全局 Tailwind CSS 变量、毛玻璃及手风琴动画微调
├── supabase/
│   ├── functions/                # 13 个 Deno Edge Functions
│   ├── migrations/               # 8 个版本化数据库迁移脚本
│   └── schema.sql                # 数据库最新 Schema 映像（184 KB）
├── .env                          # 本地环境变量配置文件
├── package.json                  # 依赖声明文件（79 个生产依赖，16 个开发依赖）
├── tailwind.config.js            # Tailwind 主题样式扩展配置文件
└── vite.config.ts                # Vite 构建及网络代理配置文件
```

---

## ⚡ 核心功能模块和工作流程

### 🗺️ 系统功能脑图

```text
Kowell AI 学习平台
├── 🏠 公共页面
│   ├── /landing                     官网营销展示页 (精美手风琴六大特色模块交互)
│   ├── /                            控制台首页 (打卡挂件、今日推荐、进度大盘)
│   └── /login                       用户凭证认证页 (登录/注册/密码找回)
├── 👤 画像与个人中心
│   ├── /profile                     修改基础资料，获取订阅套餐信息
│   └── /portrait                    苏格拉底多轮问答画像构建，支持拟真语音电话交互
├── 📚 智能资源体系
│   ├── /resources                   资源库首页 (已读、生成分类筛选)
│   ├── /resources/generate          AI 生成资源核心看板 (我的资源管理抽屉，CRUD功能)
│   ├── /resources/:id               资源详情页 (支持思维导图生成、导出 docx/pptx)
│   └── /resources/:id/edit          富文本资源编辑器 (标题、内容、公式自主编辑)
├── 🎯 学习与强化路径
│   ├── /learning-path               阶段自适应路线图 (树状网络，多节点追踪)
│   ├── /tutoring                    智能数字人答疑 (多模态输入，生成讲解视频)
│   ├── /evaluation                  阶段性诊断测试与多维评估图表报告
│   └── /weakness-training           基于错题分类的多级变式题弱项特训
├── 🧰 学习辅助工具
│   ├── /todos                       每日精细化任务清单 (支持看板拖拽与优先级)
│   ├── /notes                       全功能富文本笔记管理系统
│   ├── /wrong-book                  智能归纳错因的个人错题本
│   ├── /knowledge-graph             Three.js 交互式 3D 课程图谱
│   ├── /code-lab                    多语言在线沙箱实验室 (代码高亮、编译运行与 AI Review)
│   └── /report                      个人周/月度学业报告与 AI 教练总结
└── 🏆 游戏化与付费体系
    ├── /badges                      成就与勋章墙 (4 类稀有度判定)
    ├── /leaderboard                 全站打卡积分/时长光荣榜
    ├── /community                   学习社群 (发帖交流、资料共享、互动点赞)
    ├── /invite                      邀请有礼返积分系统
    └── /order/:orderId              订单状态支付跟踪
```

### 🔄 核心学习闭环流程

```mermaid
flowchart TD
    A([用户注册/登录]) --> B[填写专业与初始目标]
    B --> C[多轮对话画像构建\n6维度动态诊断评估]
    C --> D[AI 规划自适应多阶段学习路径]
    D --> E{日常学习循环}
    E -->|主动学习| F[资源中心\nAI生成7类资源]
    E -->|遇到阻碍| G[数字人答疑\nRAG 关联章节学习]
    E -->|代码实战| H[代码实验室\n在线沙箱编译]
    E -->|温故知新| I[错题归因\n弱项变式强化]
    F & G & H & I --> J[更新节点学习进度]
    J --> K[阶段综合诊断评估\n生成多维评估雷达图]
    K -->|能力分值回传| C
    K --> L[签到积分 & 成就勋章解锁]
    L --> M[全站学习排行榜上升]
    M -->|社群经验分享| E
```

### 🧩 核心子模块工作流设计

#### 1. 🧠 画像构建工作流
1. 用户进入 `/portrait` 触发对话。
2. 调度 `ai-chat` Edge Function (参数 `portrait`)，AI 基于苏格拉底提问策略进行 5-6 轮的引导。
3. 收集用户对技术经验、认知习惯和学习目标的自然语言描述。
4. 对话结束时，AI 后台以 strict JSON 模式提炼包含六大维度得分的 profile 报告，自动更新至 `learning_portraits` 表，并重算关联的学习路径。

#### 2. 📖 智能资源生成与管理 (CRUD) 工作流
1. 用户进入 `/resources/generate`，输入学科方向与生成大纲。
2. 调用后台 `ai-generate` 云函数，并行拉起文本大纲生成、SVG 思维导图设计、典型习题出题等多条流式工作流。
3. **“我的资源”管理**：前端通过侧抽屉面板读取 `resources` 数据表，支持：
   - **创建 (C)**: 手动新建教学资源并关联课程。
   - **读取 (R)**: 查看大纲、富文本大纲内容，显示资源的已读状态。
   - **修改 (U)**: 在线修改标题、内容正文，添加备注。
   - **删除 (D)**: 对不再需要的生成内容进行彻底移除或软删除。

#### 3. 🕸️ 三维知识图谱工作流
1. 后端通过对教材大纲提取，整理成包含 `source`、`target` 及 `weight` 的图关系 JSON。
2. 前端引入 `Three.js`，通过力导向布局算法渲染 3D 节点球体 and 关联线条。
3. 用户可以在三维空间中旋转、拖拽节点，双击节点即可自动关联打开匹配的 AI 资源大纲或启动答疑。

---

## ⚙️ 部署指南

### 📋 环境要求
* **Node.js**：`v20.x` 或以上版本
* **npm**：`v10.x` 或以上版本 (推荐使用 `pnpm v9.x` 提升依赖安装速度)
* **Supabase CLI**：用于本地 Edge Functions 调试及数据库推送 (可选)

### 🚀 本地开发与配置步骤

#### Step 1 — 克隆代码与依赖安装
```bash
# 克隆/解压至工作目录并进入
cd "Kowell AI"

# 安装开发与生产依赖
npm install
# 或使用 pnpm
pnpm install
```

#### Step 2 — 配置环境变量 `.env`
在项目根目录下新建一个名为 `.env` 的文件，填入你的 Supabase 和 DeepSeek-v4-pro 配置参数：
```env
# Supabase 配置
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# DeepSeek-v4-pro 配置 (放在本地 .env 中，避免泄露 API 密钥)
VITE_DEEPSEEK_PROXY_URL=/api/innoreation/v1/proxy
VITE_DEEPSEEK_API_KEY=sk-02260d10c28c4bb4b65bace15ba5f754
```

#### Step 3 — 初始化 Supabase 数据库表
打开你的 Supabase 控制台的 SQL Editor，依次将 `supabase/migrations/` 下的 8 个 SQL 迁移文件贴入并执行。请务必按文件名中的序号顺序执行：
1. `00001_create_all_tables.sql` — 基础表结构定义
2. `00002_add_enhancement_tables_and_columns.sql` — 扩展资源字段
3. `00003_pa_new_features_tables.sql` — 用户画像专属扩展表
4. `00004_fix_auth_trigger_and_rls.sql` — 修复用户注册自动创建 Profile 的触发器
5. `00005_add_role_to_user_profiles.sql` — 加入角色控制字段
6. `00006_invite_points_plans.sql` — 邀请人积分机制
7. `00007_create_payment_tables.sql` — 付费套餐订单表
8. `00008_add_plan_fields_to_user_profiles.sql` — 完善用户套餐等级权益

#### Step 4 — 运行开发服务器
```bash
npm run dev
```
开发服务器启动后，打开浏览器访问 `http://localhost:5173`。

### 🏗️ 生产环境打包与托管

#### Step 1 — 代码静态检查与构建
```bash
# 检查 TypeScript 类型安全性与代码规范
npm run lint

# 构建生产版本静态包
npm run build
```
打包成功后，会在根目录下生成 `dist/` 文件夹。

#### Step 2 — 部署配置建议
* **Nginx 托管**：如果将打包文件放在独立 Nginx 容器中，需要配置 `try_files` 以解决 React Router 路由刷新报 404 的问题：
  ```nginx
  server {
      listen 80;
      location / {
          root /usr/share/nginx/html;
          index index.html;
          try_files $uri $uri/ /index.html;
      }
  }
  ```
* **CDN 静态托管**：可直接将 `dist/` 的静态文件上传至阿里 OSS、腾讯 COS 或 Vercel/Netlify，直接开启静态网站功能即可。

---

## 📦 API 接口

### 🔑 核心数据库表结构设计

| 物理表名 | 存储内容描述 | 核心关联关系与外键约束 |
| :--- | :--- | :--- |
| `user_profiles` | 用户资料、等级、积分余额、连续打卡天数 | 主键为 `id` (关联 auth.users.id) |
| `learning_portraits` | 用户 6 维学习画像 JSON 数据 | `user_id` 关联 `user_profiles.id` |
| `courses` | 课程基本元信息（课程名、专业分类、章节大纲） | 主键为 `id` |
| `resources` | 学习资源（多版本、富文本内容、是否已读等状态） | `course_id` 关联 `courses.id` |
| `wrong_book_entries` | 用户的错题记录本，包含用户错误解析与标签 | `user_id` 关联 profile，`exercise_id` 关联习题表 |
| `daily_todos` | 用户的每日打卡代办任务清单 | `user_id` 关联 profile |
| `user_check_ins` | 每日打卡流水，用于校验连续签到天数 | `user_id` 关联 profile |

### 🤖 新增 DeepSeek-v4-pro 服务层接口 (`src/services/ai/deepseek.ts`)

平台通过封装 `deepseekService` 支持极速、极低成本的代码审查和文本问答：

#### 1. 非流式单次对话 (`chat`)
* **接口定义**：`async chat(messages: ChatMessage[], options?: { temperature?: number; jsonMode?: boolean }): Promise<string>`
* **请求头**：
  ```json
  {
    "Content-Type": "application/json",
    "X-Proxy-Key": "sk-02260d10c28c4bb4b65bace15ba5f754",
    "Authorization": "Bearer sk-02260d10c28c4bb4b65bace15ba5f754"
  }
  ```
* **请求体**：
  ```json
  {
    "model": "deepseek-v4-pro",
    "messages": [
      {"role": "system", "content": "你是一位代码审查专家。"},
      {"role": "user", "content": "帮我看看这段代码有什么优化空间。"}
    ],
    "temperature": 0.7,
    "stream": false
  }
  ```
* **返回格式**：大模型生成的非流式完整内容文本。

#### 2. SSE 流式对话 (`streamChat`)
* **接口定义**：`async streamChat(messages: ChatMessage[], callbacks: StreamCallbacks, options?: { temperature?: number; signal?: AbortSignal }): Promise<void>`
* **数据流传输规范**：利用 `eventsource-parser` 解析每条推流帧 `data: {...choices: [{delta: {content: "..."}}]}`，通过 `callbacks.onChunk` 传递，接收完毕时执行 `callbacks.onDone`。

---

## 👾 项目代码及界面规模

### 📊 代码与开发指标量化表

| 代码指标类别 | 具体量化数值 | 详细包含说明 |
| :--- | :--- | :--- |
| **TSX/TS 源代码文件总量** | **109 个** | 包含页面组件、基础UI、AI对接、服务层与路由 |
| **源码工程总行数** | **21,720 行** | 包含业务逻辑、Three.js 交互及动画逻辑 |
| **业务子页面总量** | **29 个页面** | 包含画像、生成、实验室、图谱等页面 |
| **业务页面代码总大小** | **620.1 KB** | 前端业务页面的具体容量 |
| **UI 原子基础组件数** | **50+ 个** | 按钮、输入框、下拉框、无头模态框等封装 |
| **前端 SPA 路由数** | **27 条路由** | 配置在 `routes.tsx`，启用路由层懒加载 |
| **Edge Functions 数量** | **13 个函数** | 覆盖 AI 聊天、视频生成、微信 webhook、TTS 等 |
| **版本迁移数据库脚本** | **8 个版本** | `supabase/migrations/` 下的版本控制迁移文件 |

### 📄 代码量 TOP 5 核心业务页面

| 页面组件路径 | 文件容量大小 | 承担的核心业务与技术要点 |
| :--- | :--- | :--- |
| `LandingPage.tsx` | 54.2 KB | 官网首页，集成 3D 拟物手风琴六大功能，以及竞争战略面板 |
| `LearningPathPage.tsx` | 48.4 KB | 学习路径图渲染，处理 SVG 节点连线与自适应进度更新逻辑 |
| `StrategyPage.tsx` | 43.4 KB | 战略对比雷达图、卡片及多 Agent 协作工作流日志的可视化 |
| `ResourceGeneratePage.tsx` | 43.1 KB | AI 资源生成控制台，新增“我的资源”分栏 CRUD 侧抽屉 |
| `EvaluationPage.tsx` | 39.6 KB | 展示学业多维分析报告、评估雷达图、以及提升方案大纲 |

---

## 💡 常见问题

**Q1：配置好 DeepSeek 后，在我的资源或答疑页面进行对话报错 `401/403`？**
> 请确保 `.env` 环境变量文件中的 `VITE_DEEPSEEK_API_KEY` 已经正确填入了分配的 X-Proxy-Key (`sk-02260d10c28c...`)。另外，如果在本地开发，请检查开发代理接口是否能够正常连通，若遇到跨域问题，可以在本地配置 proxy 转发。

**Q2：用户注册后，登录进入控制台报错，数据库获取 profile 空白？**
> 这是因为 `supabase/migrations/00004_fix_auth_trigger_and_rls.sql` 迁移文件中的触发器未正确执行或被意外删除。请在 SQL Editor 中重新运行该迁移文件中的 `handle_new_user` 触发器，以确保在 Supabase Auth 用户表增加记录时，能够在 `public.user_profiles` 自动初始化对应的用户条目。

**Q3：手风琴卡片在悬浮展开时，右侧的 AI Mockup 面板被遮挡或溢出？**
> 卡片的外层容器使用了 `overflow-hidden` 以保持圆角完整，同时通过固定高度 `h-[500px]` 限制其高度不会发生动态变化。如果内部的 Mockup 溢出，请确保你的浏览器视口宽度支持 `md:` 媒体查询断点（>=768px），且 Mockup 组件的高宽被限制在 `max-h-[190px]` 内。

**Q4：为什么 3D 知识图谱 (Knowledge Graph) 渲染失败显示空白？**
> 3D 知识图谱基于 Canvas 与 WebGL，需要显卡与硬件加速的支持。请首先确认当前浏览器的硬件加速功能（Hardware Acceleration）是否开启，若已开启仍显示空白，请检查浏览器控制台输出是否包含 `pgvector` 数据读取异常，说明数据库中尚未生成有效的知识点关联映射数据。

**Q5：如何全局自定义平台的配色主题？**
> 平台采用 Tailwind CSS 与 CSS 变量进行颜色配对，你只需要在 `src/index.css` 的 `:root` (亮色模式) 与 `.dark` (暗色模式) 下修改对应的颜色变量，如主色 `--primary: 263.4 70% 50.4%` (HSL 值格式) 即可，所有组件会自动同步更新。
