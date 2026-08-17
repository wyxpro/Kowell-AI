# Repository Guidelines

Kowell AI 是一套 AIGC 学习资源生成系统：前端为 React 18 + TypeScript + Vite，后端为 Supabase（Postgres + Edge Functions）。仓库无独立后端服务进程。

## Project Structure & Module Organization

- `src/pages/` — 路由级页面，一页一文件，`PascalCase` + `Page` 后缀（`ResourceGeneratePage.tsx`）。`NotFound.tsx` 例外。
- `src/routes.tsx` — 唯一路由注册表。新增页面须用 `lazy()` 引入并追加到 `routes` 数组，标注 `public` 与 `visible`。
- `src/components/ui/` — shadcn/ui 基础组件，文件名 `kebab-case`；业务组件按域分目录（`ai/`、`tutoring/`、`voice/`、`common/`、`layouts/`），文件名 `PascalCase`。
- `src/services/ai/` — AI 能力按模态分包（`text/`、`vision/`、`video/`、`stepaudio/`、`stepfun/`），每包以 `index.ts` 导出、`service.ts` 实现、`config.ts` 配置。
- `src/store/useAppStore.ts`（zustand 全局状态）、`src/contexts/AuthContext.tsx`（认证）、`src/hooks/`（`use-*.ts`）、`src/lib/`（工具）、`src/db/supabase.ts`（客户端）、`src/types/`（类型）。
- `supabase/functions/<name>/index.ts` — Edge Function，目录名 `kebab-case`，公共逻辑放 `_shared/`。
- `supabase/migrations/` — 顺序编号迁移，格式 `000NN_描述.sql`，只增不改。
- 仓库无测试目录；`docs/`、`PRD.md`、`kowell-ai-proposal/` 为文档资产。

## Build, Test, and Development Commands

包管理器为 pnpm（存在 `pnpm-lock.yaml` 与 `pnpm-workspace.yaml`），不要用 npm install。

- `pnpm install` — 安装依赖。
- `pnpm dev` — 启动开发服务，走 `vite.config.dev.ts`。
- `pnpm build` — 生产构建，走 `vite.config.ts`。
- `pnpm lint` — 串联 `tsgo` 类型检查、`biome lint`、`.rules/check.sh` 自定义规则与试构建。

注意：`pnpm lint` 是 bash 脚本，依赖 `ast-grep` 且 `.rules/testBuild.sh` 硬编码 `/workspace/.dist`，在 Windows `cmd.exe` 下无法直接运行。本地至少执行 `npx tsgo -p tsconfig.check.json`、`npx biome lint` 与 `pnpm build`。

## Coding Style & Naming Conventions

- 2 空格缩进；TypeScript 严格类型，避免 `any`。
- Biome 只做 lint，不做格式化（`formatter.enabled: false`），保持周边文件既有风格。三条强约束：禁止未声明依赖、禁止重复声明、`src` 内禁止 CommonJS。
- 统一用 `@/` 别名导入 `src`，不写多级相对路径。
- 样式用 Tailwind 工具类；组件变体用 `class-variance-authority`，类名合并用 `cn()`（`src/lib/utils.ts`）。
- 注释只解释意图、边界与非显而易见的行为，不复述代码。现有中文注释保持中文。
- `.rules/*.yml` 是会被 lint 拦截的硬规则：`SelectItem` 值约束、颜色对比度、Toast Hook 用法、Slot 嵌套、按钮必须有交互、Edge Function 取 body 方式、`useAuth` 必须被 `AuthProvider` 包裹。改 UI 前先读对应规则。

## Testing Guidelines

当前没有测试框架和测试文件，也没有覆盖率要求。变更需通过类型检查与构建，并在浏览器中手动验证受影响路由。新增测试请先与维护者确认技术选型（建议 Vitest + `*.test.ts` 就近放置），不要单方面引入。

## Commit & Pull Request Guidelines

历史只有一个提交（`Update README.md`），无既成约定。建议采用 Conventional Commits：`feat: 新增弱项训练页`、`fix: 修复登录跳转`。

PR 需说明改动动机与范围、关联 issue、列出验证方式（类型检查/构建/手动路径）；涉及 UI 请附截图；涉及数据库请单列迁移文件与回滚影响。

## Security & Configuration Tips

前端配置走 `VITE_` 前缀环境变量（`VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`），服务端密钥见 `supabase/secrets/required.json`，`.env` 不入库。

已知风险：`vite.config.ts:40`、`vite.config.ts:51`、`vite.config.ts:62`、`vite.config.ts:73` 与 `src/services/ai/config.ts:3` 把第三方 API key 硬编码为回退值，并已推送到公开仓库。这些凭据应视为已泄露，需轮换并改为纯环境变量读取。不要沿用这种回退写法，也不要新增任何硬编码密钥。
