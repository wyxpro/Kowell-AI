import { handleCors, corsHeaders } from "../_shared/cors.ts";

interface Message {
  role: "user" | "assistant" | "system";
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
}

// 滑动窗口：保留最近 N 轮（含 system）
function slidingWindowMessages(messages: Message[], maxRounds = 10): Message[] {
  const system = messages.filter(m => m.role === "system");
  const conv = messages.filter(m => m.role !== "system");
  const kept = conv.slice(-maxRounds * 2);
  return [...system, ...kept];
}

const MINIMAX_GATEWAY = "https://app-bu7wnuu44l4x-api-rLobPAn0n7m9-gateway.appmiaoda.com/v1/chat/completions";

async function callLLM(messages: Message[], apiKey: string, stream: boolean, model?: string) {
  return await fetch(MINIMAX_GATEWAY, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Gateway-Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model ?? "MiniMax-M3",
      messages,
      stream,
      temperature: 0.9,
      top_p: 0.95,
      max_completion_tokens: 8192,
      thinking: { type: "adaptive" },
    }),
  });
}

Deno.serve(async (req: Request): Promise<Response> => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const rawMessages: Message[] = body.messages ?? [];
    const promptType: string = body.prompt_type ?? "tutoring";
    const streamMode: boolean = body.stream !== false;

    if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
      return new Response(JSON.stringify({ error: "Missing messages" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 系统 Prompt（Chain-of-Thought + Few-shot）
    const systemPrompts: Record<string, string> = {
      tutoring: `你是"Kowell AI"AI智能答疑助手，专为高等教育学生提供个性化学习辅导。
工作模式（Chain-of-Thought）：
1. 先分析问题类型和难度
2. 逐步拆解解题思路
3. 用类比和例子辅助理解
4. 主动引导而非直接给答案
5. 最后总结知识点
输出格式：Markdown，层次清晰，关键词加粗。
语言：中文，语气友好耐心。`,
      portrait: `你是"Kowell AI"学习画像构建助手，通过友好对话深入了解学生特征。
收集维度：专业方向、知识基础、认知风格、易错点、学习节奏、学习目标。
规则：每次只问一个问题；根据回答追问细节；全部收集完毕后输出JSON摘要。`,
      resource: `你是"Kowell AI"学习资源生成助手，生成高质量结构化学习资源。
输出要求：Markdown格式；包含核心概念、关键知识点、示例、练习题；语言简洁准确。`,
      evaluate: `你是"Kowell AI"智能评分助手。
给定题目、标准答案、学生答案，请：
1. 判断是否正确（对/错/部分正确）
2. 给出0-100分的评分
3. 用中文详细解析正确答案的思路
4. 指出学生答案的优点和不足
5. 给出改进建议
输出JSON格式：{"correct":bool,"score":int,"feedback":"","analysis":"","suggestions":""}`,
    };

    const systemContent = systemPrompts[promptType] ?? systemPrompts.tutoring;
    const messages = slidingWindowMessages([
      { role: "system", content: systemContent },
      ...rawMessages,
    ]);

    const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Server config error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 首次调用
    let upstream = await callLLM(messages, apiKey, streamMode);

    // 模型降级：主模型失败时重试
    if (!upstream.ok && upstream.status >= 500) {
      upstream = await callLLM(messages, apiKey, streamMode, "ernie-speed");
    }

    if (upstream.status === 429 || upstream.status === 402) {
      const errText = await upstream.text();
      return new Response(errText, {
        status: upstream.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!upstream.ok || !upstream.body) {
      return new Response(JSON.stringify({ error: `Upstream: ${upstream.status}` }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(upstream.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": streamMode ? "text/event-stream" : "application/json",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});