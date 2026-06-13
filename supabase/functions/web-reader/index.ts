import { handleCors, corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req: Request): Promise<Response> => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    if (!url) {
      return new Response(JSON.stringify({ error: "Missing url" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 使用 Jina Reader 抓取网页内容
    const jinaUrl = `https://r.jina.ai/${encodeURIComponent(url)}`;
    const resp = await fetch(jinaUrl, {
      headers: { "Accept": "text/plain", "X-Return-Format": "markdown" },
    });

    if (!resp.ok) {
      return new Response(JSON.stringify({ error: `抓取失败: ${resp.status}` }), {
        status: resp.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const content = await resp.text();
    // 截取前8000字符避免过长
    const trimmed = content.slice(0, 8000);

    return new Response(JSON.stringify({ content: trimmed, url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
