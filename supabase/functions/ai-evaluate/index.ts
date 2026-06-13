import { handleCors, corsHeaders } from "../_shared/cors.ts";

const GATEWAY = "https://app-bu7wnuu44l4x-api-zYkZz8qovQ1L-gateway.appmiaoda.com/v2/chat/completions";

interface EvaluatePayload {
  question: string;
  options?: string[];
  correct_answer: string;
  user_answer: string;
  question_type?: "single" | "multiple" | "subjective";
}

Deno.serve(async (req: Request): Promise<Response> => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const body: EvaluatePayload = await req.json();
    const { question, options, correct_answer, user_answer, question_type = "single" } = body;

    if (!question || !correct_answer || user_answer === undefined) {
      return new Response(JSON.stringify({ error: "缺少必要参数" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "服务器配置错误" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 构建判分 Prompt
    const optionsText = options?.length ? `\n选项：\n${options.map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`).join("\n")}` : "";
    const prompt = `请判断以下题目的学生答案是否正确，并给出详细解析。

题目：${question}${optionsText}
题目类型：${question_type === "subjective" ? "主观题" : "客观题"}
标准答案：${correct_answer}
学生答案：${user_answer}

请严格按照以下JSON格式输出，不要有其他内容：
{
  "is_correct": true或false,
  "score": 0到100的整数,
  "analysis": "正确答案详细解析（100字以内）",
  "feedback": "针对学生答案的具体点评",
  "suggestions": "改进建议（50字以内）"
}`;

    const response = await fetch(GATEWAY, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        messages: [
          { role: "system", content: "你是专业的教育评估助手，负责客观准确地评估学生答案。只输出JSON，不输出其他内容。" },
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

    // 解析 AI 返回的 JSON
    let result: Record<string, unknown>;
    try {
      const match = content.match(/\{[\s\S]*\}/);
      result = JSON.parse(match ? match[0] : content);
    } catch {
      // 降级处理：客观题直接比较
      const isCorrect = user_answer.trim().toUpperCase() === correct_answer.trim().toUpperCase();
      result = {
        is_correct: isCorrect,
        score: isCorrect ? 100 : 0,
        analysis: `正确答案是 ${correct_answer}`,
        feedback: isCorrect ? "回答正确！" : "回答有误，请参考正确答案。",
        suggestions: "建议复习相关知识点",
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
