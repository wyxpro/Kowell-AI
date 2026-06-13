import { handleCors, corsHeaders } from "../_shared/cors.ts";

const TTS_GATEWAY = "https://app-bu7wnuu44l4x-api-rLobPAn0n7m9-gateway.appmiaoda.com/v1/t2a_v2";

Deno.serve(async (req: Request): Promise<Response> => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { text, voice_id = "female-tianmei", speed = 1.0, emotion = "happy" } = body;

    if (!text) {
      return new Response(JSON.stringify({ error: "Missing text" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const upstream = await fetch(TTS_GATEWAY, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "speech-02-hd",
        text,
        voice_setting: { voice_id, speed, emotion, vol: 1.0 },
        audio_setting: { format: "mp3", sample_rate: 32000, bitrate: 128000, channel: 1 },
      }),
    });

    if (!upstream.ok) {
      const errText = await upstream.text();
      return new Response(JSON.stringify({ error: errText }), {
        status: upstream.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await upstream.json();
    // 返回 audio_file (base64) 或 audio_url
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
