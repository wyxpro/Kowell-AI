import { handleCors, corsHeaders } from "../_shared/cors.ts";

const GATEWAY = "https://app-bu7wnuu44l4x-api-zYkZz8qovQ1L-gateway.appmiaoda.com/v2/chat/completions";

interface RecommendPayload {
  portrait: Record<string, unknown>;
  current_stage?: number;
  course_name?: string;
  learning_history?: string[];
}

Deno.serve(async (req: Request): Promise<Response> => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const body: RecommendPayload = await req.json();
    const { portrait, current_stage = 0, course_name = "计算机科学", learning_history = [] } = body;

    const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "服务器配置错误" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const portraitSummary = JSON.stringify(portrait, null, 2);
    const historyText = learning_history.length
      ? `最近学习记录：${learning_history.slice(-5).join("、")}`
      : "暂无学习记录";

    const prompt = `根据学生的学习画像，为其推荐下一阶段学习内容。

课程方向：${course_name}
当前阶段：第${current_stage + 1}阶段
${historyText}

学习画像：
${portraitSummary}

请严格按照以下JSON格式输出推荐方案：
{
  "next_topic": "下一个推荐学习主题（10字以内）",
  "reason": "推荐理由（50字以内，结合画像分析）",
  "resources": [
    {"title": "资源名称", "type": "document/exercise/code", "priority": "高/中/低"},
    {"title": "资源名称", "type": "document/exercise/code", "priority": "高/中/低"},
    {"title": "资源名称", "type": "document/exercise/code", "priority": "高/中/低"}
  ],
  "focus_points": ["重点1", "重点2", "重点3"],
  "estimated_hours": 数字,
  "difficulty": "基础/中级/高级"
}`;

    const response = await fetch(GATEWAY, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        messages: [
          { role: "system", content: "你是智学伴AI学习规划师，根据学生画像制定个性化学习推荐方案。只输出JSON，不输出其他内容。" },
          { role: "user", content: prompt },
        ],
        stream: false,
      }),
    });

    if (!response.ok) {
      return new Response(JSON.stringify({ error: `AI服务错误: ${response.status}` }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? "{}";
    let result: Record<string, unknown>;
    try {
      const match = content.match(/\{[\s\S]*\}/);
      result = JSON.parse(match ? match[0] : content);
    } catch {
      result = {
        next_topic: "数据结构基础",
        reason: "根据您的学习阶段，建议优先掌握数据结构基础知识",
        resources: [],
        focus_points: ["数组", "链表", "树结构"],
        estimated_hours: 8,
        difficulty: "中级",
      };
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
