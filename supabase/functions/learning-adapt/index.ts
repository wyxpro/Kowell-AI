import { handleCors, corsHeaders } from "../_shared/cors.ts";
import { cleanSummary } from "../_shared/content-safety.ts";
import { generateStructured } from "../_shared/model-provider.ts";
import { requireUser, serviceClient } from "../_shared/agent-runtime.ts";
const headers = { ...corsHeaders, "Content-Type": "application/json" };
type Json = Record<string, unknown>;
Deno.serve(async (request) => {
  const cors = handleCors(request);
  if (cors) return cors;
  if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });

  let eventId: string | undefined;
  try {
    const body = await request.json() as { learning_event_id?: string; session_id?: string };
    const learningEventId = typeof body.learning_event_id === "string" ? body.learning_event_id : undefined;
    const sessionId = typeof body.session_id === "string" ? body.session_id : undefined;
    if (!learningEventId && !sessionId) return reply(400, { error: "learning_event_id_or_session_id_required" });

    const client = serviceClient();
    const user = await requireUser(client, request.headers.get("Authorization"));
    if (learningEventId) {
      eventId = learningEventId;
      await adaptEvent(client, user.id, learningEventId);
    } else {
      await adaptSession(client, user.id, sessionId!);
    }
    return reply(202, { status: "accepted", learning_event_id: eventId ?? null });
  } catch (error) {
    const message = cleanSummary(error instanceof Error ? error.message : "learning_adapt_failed", 500);
    console.error(JSON.stringify({ event: "learning_adapt_failed", learning_event_id: eventId ?? null, error: message }));
    return reply(message === "unauthorized" ? 401 : 500, { error: message });
  }
});
async function adaptEvent(client: ReturnType<typeof serviceClient>, userId: string, eventId: string): Promise<void> { const { data, error } = await client.rpc("process_learning_event", { p_event_id: eventId, p_user_id: userId, p_lease: "10 minutes" }); if (error) { if (error.message?.includes("learning_event_busy")) return; if (error.message?.includes("learning_event_not_found")) throw new Error("learning_event_not_found"); throw new Error("learning_event_process_failed"); } const result = object(data); const status = text(result.status); if (!data || !["processed", "ignored"].includes(status) || result.learning_event_id !== eventId) throw new Error(status === "failed" ? "learning_event_process_failed" : "learning_event_invalid_result"); }
type PortraitDimension = "major_direction" | "knowledge_base" | "cognitive_style" | "error_patterns" | "learning_rhythm" | "learning_goals";
type PortraitDimensionValue = { summary: string; evidence: string[]; confidence: number };
type PortraitExtraction = Record<PortraitDimension, PortraitDimensionValue>;
const PORTRAIT_DIMENSIONS: PortraitDimension[] = ["major_direction", "knowledge_base", "cognitive_style", "error_patterns", "learning_rhythm", "learning_goals"];
function assertPortraitExtraction(value: unknown): PortraitExtraction { if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("portrait_schema_invalid"); const record = value as Record<string, unknown>; if (/<think\\b|chain[ -]?of[ -]?thought|hidden reasoning/i.test(JSON.stringify(value))) throw new Error("hidden_reasoning_rejected"); for (const key of PORTRAIT_DIMENSIONS) { const item = record[key]; if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error("portrait_schema_invalid"); const dimension = item as Record<string, unknown>; if (typeof dimension.summary !== "string" || !Array.isArray(dimension.evidence) || !dimension.evidence.every(entry => typeof entry === "string") || typeof dimension.confidence !== "number") throw new Error("portrait_schema_invalid"); } return value as PortraitExtraction; }
function makeDimension(summary: string, evidence: string[], confidence: number): PortraitDimensionValue { return { summary: cleanSummary(summary || "尚未从对话中确认，等待后续学习行为验证。", 280), evidence: evidence.slice(0, 3).map(item => cleanSummary(item, 280)), confidence: clamp(confidence, 0, 1) }; }
function deterministicPortrait(messages: Array<{ role: string; content: string }>): PortraitExtraction { const userMessages = messages.filter(message => message.role === "user").map(message => cleanSummary(message.content, 280)); const choose = (keywords: string[]): string[] => userMessages.filter(message => keywords.some(keyword => message.includes(keyword))); const fallback = "尚未从对话中确认，等待后续学习行为验证。"; const selected = (keywords: string[]) => { const evidence = choose(keywords); return makeDimension(evidence[0] ?? fallback, evidence, evidence.length ? 0.45 : 0.15); }; return { major_direction: selected(["专业", "方向", "研究", "职业", "从事"]), knowledge_base: selected(["基础", "学过", "掌握", "熟悉", "薄弱", "知识"]), cognitive_style: selected(["喜欢", "偏好", "图示", "案例", "视频", "实践", "阅读"]), error_patterns: selected(["困难", "薄弱", "错误", "易错", "不会", "难点"]), learning_rhythm: selected(["每天", "每周", "晚上", "早上", "时间", "分钟", "节奏"]), learning_goals: selected(["目标", "希望", "想要", "计划", "考试", "就业", "提升"]) }; }
async function extractPortrait(userId: string, messages: Array<{ role: string; content: string }>): Promise<PortraitExtraction> { try { return await generateStructured([{ role: "system", content: "仅返回六维学习画像 JSON，不要输出隐藏推理。每个维度必须是 {summary:string,evidence:string[],confidence:number}。confidence 范围 0 到 1；没有证据时必须明确写尚未确认并给低置信度。" }, { role: "user", content: JSON.stringify({ learnerId: userId, messages: messages.slice(-50) }) }], assertPortraitExtraction); } catch { return deterministicPortrait(messages); } }
async function adaptSession(client: ReturnType<typeof serviceClient>, userId: string, sessionId: string): Promise<void> { const chats = await client.from("chat_messages").select("id,role,content,created_at").eq("user_id", userId).eq("session_id", sessionId).order("created_at", { ascending: true }).limit(50); if (chats.error || !chats.data?.length) throw new Error("portrait_session_not_found"); const messages = chats.data.map((row: { role: string; content: string }) => ({ role: row.role, content: row.content })); const userMessages = messages.filter(message => message.role === "user"); if (!userMessages.length) throw new Error("portrait_session_not_found"); const extraction = await extractPortrait(userId, messages); const rawData = { conversationEvidence: messages.map(message => cleanSummary(message.content, 500)), sourceSessionId: sessionId }; const { data, error } = await client.rpc("save_learning_portrait_session", { p_user_id: userId, p_session_id: sessionId, p_extraction: extraction, p_raw_data: rawData, p_is_complete: userMessages.length >= 6 }); if (error || !data) throw new Error("portrait_session_write_failed"); }
function reply(status: number, value: unknown): Response { return new Response(JSON.stringify(value), { status, headers }); } function object(value: unknown): Json { return value && typeof value === "object" && !Array.isArray(value) ? value as Json : {}; } function text(value: unknown): string { return typeof value === "string" ? value : ""; } function numeric(value: unknown): number | undefined { return typeof value === "number" && Number.isFinite(value) ? value : undefined; } function clamp(value: number, min: number, max: number): number { return Math.max(min, Math.min(max, value)); }
