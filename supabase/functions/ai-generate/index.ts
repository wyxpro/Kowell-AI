import { handleCors, corsHeaders } from "../_shared/cors.ts";

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

Deno.serve(async (req: Request): Promise<Response> => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { course_name, topic, resource_type, major, education } = body;

    if (!course_name || !topic || !resource_type) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: course_name, topic, resource_type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const typePrompts: Record<string, string> = {
      document: `生成一份"${course_name}"课程的"${topic}"主题课程文档。要求：\n1. 包含概述、核心知识点、实践应用、总结思考四个部分\n2. 语言简洁准确，适合${education || '本科'}学生\n3. 使用markdown格式，层次分明\n4. 每个知识点配简要说明`,
      mindmap: `为"${course_name}"课程的"${topic}"主题生成思维导图结构。要求：\n1. 以中心主题展开主要分支\n2. 每个分支包含3-5个子节点\n3. 用层级列表格式输出，方便前端渲染为树形结构\n4. 确保覆盖核心概念和关联知识点`,
      exercise: `为"${course_name}"课程的"${topic}"主题生成5道练习题。要求：\n1. 包含单选题和简答题\n2. 难度递增，从基础到进阶\n3. 每题给出标准答案和详细解析\n4. 考察核心概念理解和应用能力`,
      reading: `为"${course_name}"课程的"${topic}"主题推荐拓展阅读材料。要求：\n1. 推荐2-3篇相关文章或论文摘要\n2. 包含标题、来源和核心观点\n3. 说明每篇材料与本主题的关联`,
      code: `为"${course_name}"课程的"${topic}"主题生成代码示例。要求：\n1. 使用Python或Java\n2. 包含完整可运行代码\n3. 添加详细注释说明\n4. 给出运行结果示例`,
    };

    const prompt = typePrompts[resource_type] || typePrompts.document;

    const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const messages: Message[] = [
      {
        role: "system",
        content: `你是"Kowell AI"学习资源生成专家。请严格按要求格式生成学习资源内容。输出必须是纯文本，不要使用任何特殊标记。`,
      },
      { role: "user", content: prompt },
    ];

    const upstream = await fetch(
      "https://app-bu7wnuu44l4x-api-rLobPAn0n7m9-gateway.appmiaoda.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Gateway-Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "MiniMax-M3",
          messages,
          stream: true,
          temperature: 0.8,
          top_p: 0.95,
          max_completion_tokens: 16384,
          thinking: { type: "disabled" },
        }),
      }
    );

    if (!upstream.ok || !upstream.body) {
      return new Response(
        JSON.stringify({ error: `Upstream error: ${upstream.status}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 读取完整内容
    const reader = upstream.body.getReader();
    const decoder = new TextDecoder("utf8");
    let fullContent = "";
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const raw = line.slice(6).trim();
        if (raw === "[DONE]") break;
        try {
          const chunk = JSON.parse(raw);
          const delta = chunk.choices?.[0]?.delta?.content ?? "";
          fullContent += delta;
        } catch {
          // skip
        }
      }
    }

    return new Response(
      JSON.stringify({ content: fullContent, type: resource_type }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});