# 学习评估非阻塞判分审计

审计日期：2026-08-10

## 结论

练习题 Tab 的代码已实现单选、多选、简答三类题型的非阻塞提交闭环：客观题在前端立即判分，简答题提交后立即锁定并进入 AI 待评估状态；答题记录保存与 AI 评估使用独立状态，失败时分别提供重试入口。AI 重试按原 submission 更新，不新增答题记录。测试 Supabase 尚未执行 `00009`，真实练习生成和答题持久化会因缺列失败，必须先完成数据库迁移。

## 编号步骤与健康度

| 步骤 | 目标状态 | 健康度 | 代码与验证结论 | 截图 |
| --- | --- | --- | --- | --- |
| 1 | 已选择答案、尚未提交 | 已实现，未完成浏览器截图 | 单选使用 `RadioGroup`，多选使用 `Checkbox`，简答使用 `Textarea`；首次交互开始计时。 | `01-answer-selected.png` 未捕获 |
| 2 | 客观题即时结果 | 已实现，纯函数已验证 | 提交时同步执行本地 100/0 判分，并立即显示对错、标准答案和已有解析；AI 分数不会覆盖客观题结果。 | `02-objective-instant-result.png` 未捕获 |
| 3 | 简答题 AI pending | 已实现，未完成浏览器截图 | 提交后立即锁定答案；答题记录保存与 AI 状态分离，用户可继续操作其他题目。 | `03-subjective-pending.png` 未捕获 |
| 4 | AI 反馈完成 | 已实现，构建已验证 | AI 文本反馈写回原 submission；简答题同时写回评分与正确性，客观题只采用文本字段。 | `04-ai-feedback-complete.png` 未捕获 |
| 5 | AI 失败与重试 | 已实现，未完成端到端故障注入 | AI 失败保留本地结果和用户答案；重试使用原 submission ID 与新的 request ID，条件更新避免旧请求覆盖。保存失败另有独立重试。 | `05-ai-feedback-failed-retry.png` 未捕获 |

## UX 发现

1. 客观题提交后的主要反馈不再依赖 AI，等待期间可以继续完成其他题目。
2. 简答题不显示猜测分数，AI 完成前仅显示明确的待评估状态。
3. 保存失败与 AI 失败分别呈现，避免把本地判分结果回滚为未提交。
4. 多选答案按选项顺序规范化，选择顺序和重复选择不影响集合比较；少选、多选、错选均判错。
5. 卡片恢复每道题最新一次提交，统计保留全部历史 submission；pending 简答题不进入平均分和正确率分母。

## 无障碍检查

- 单选、多选和简答控件均具有题目相关的可访问名称。
- 异步保存、AI pending、完成和失败区域使用 `aria-live="polite"`。
- 提交、保存重试和 AI 重试均为可聚焦按钮，不依赖图标作为唯一文本信息。
- 未完成真实浏览器键盘遍历，因此焦点顺序、屏幕阅读器实际播报和移动端触控尺寸仍需在有测试账号的环境复核。

## 验证记录

- `node --experimental-strip-types ...` 纯函数矩阵：通过。覆盖单选正确/错误、多选顺序变化、少选、重复项、序列化/反序列化、旧字母答案和生成题规范化。
- `corepack pnpm exec biome lint`：通过，125 个文件无错误。
- `corepack pnpm build`：通过，生产包成功生成。
- `corepack pnpm exec tsgo -p tsconfig.check.json`：未全量通过；仅报 3 个未改文件中的既有问题：`src/components/ui/qrcodedataurl.tsx` 缺少 `qrcode` 类型声明、`src/components/voice/VoiceCallModal.tsx` 存在不可能状态比较、`src/services/ai/index.ts` 重复导出 `ChatMessage`。本次目标文件未出现新增类型错误。
- 备用 Vite 服务使用 `vite.config.ts` 启动后，`/` 与 `/evaluation` 均返回 HTTP 200。仓库默认 `vite.config.dev.ts` 在本机对两条路径返回 404，属于既有开发配置行为。
- 测试 Supabase 实测：Auth health 与 PostgREST OpenAPI 均返回 HTTP 200，31 张预期业务表全部存在；套餐、SKU、徽章、课程和练习题均可读取到至少一条公开样本。
- 远端迁移状态大致为 `00001–00008`：`exercises.question_type` 与 `user_exercise_submissions.ai_status/ai_analysis/ai_suggestions/ai_request_id` 均不存在，PostgREST 返回 PostgreSQL `42703`。因此 `00009` 尚未落地，练习生成、答题保存和 AI 状态更新目前会失败。
- `.env.local` 已被 `.gitignore` 的 `*.local` 规则忽略；本次验证未输出 URL、密钥或账号值。当前环境没有测试账号，真实 JWT 写入、RLS 和迁移回填仍需在受控账号下验证。

## 截图证据限制

内置浏览器仍无法附着到本地 5174 端口；本项目 Vite 的 `/` 与 `/evaluation` 已通过 HTTP 200 smoke test。测试 Supabase 配置有效，但没有测试登录账号，且远端缺少 `00009` 字段。为避免用未登录页面冒充目标流程证据，本次未创建五张 PNG。完成迁移并提供可用测试账号后，应按上表顺序补拍，并验证并发提交、网络失败、AI 重试、键盘操作和移动端布局。
