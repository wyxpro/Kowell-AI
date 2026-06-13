import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Aes } from "npm:wechatpay-axios-plugin";

async function decryptTradeState(
  MCH_API_V3_KEY: string,
  associatedData: string,
  nonce: string,
  ciphertext: string,
): Promise<{ status: string; order_no: string }> {
  const plaintext = await Aes.AesGcm.decrypt(ciphertext, MCH_API_V3_KEY, nonce, associatedData);
  const obj = JSON.parse(plaintext);
  return {
    status: (obj.trade_state ?? "").toString() === "SUCCESS" ? "SUCCESS" : "OTHERS",
    order_no: obj.out_trade_no ?? "",
  };
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = await req.json();
    const resource = body?.resource;
    if (!resource) {
      return new Response(JSON.stringify({ code: "FAIL", message: "无效请求" }), {
        status: 400, headers: { "Content-Type": "application/json" },
      });
    }

    const MCH_API_V3_KEY = Deno.env.get("MCH_API_V3_KEY") || "";
    if (!MCH_API_V3_KEY) {
      console.error("[Webhook] MCH_API_V3_KEY 未配置");
      return new Response(JSON.stringify({ code: "FAIL", message: "服务器配置错误" }), {
        status: 500, headers: { "Content-Type": "application/json" },
      });
    }

    const { algorithm, associated_data, nonce, ciphertext } = resource;
    if (algorithm !== "AEAD_AES_256_GCM") {
      return new Response(JSON.stringify({ code: "FAIL", message: "不支持的加密算法" }), {
        status: 400, headers: { "Content-Type": "application/json" },
      });
    }

    const { status, order_no } = await decryptTradeState(
      MCH_API_V3_KEY, associated_data, nonce, ciphertext,
    );

    if (status !== "SUCCESS") {
      console.log(`[Webhook] 非支付成功状态，order_no=${order_no}`);
      return new Response(JSON.stringify({ code: "SUCCESS" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // 乐观锁更新：只有 pending 状态才更新，防止重复处理
    const { data: updated, error: updateErr } = await supabase
      .from("orders")
      .update({ status: "paid", paid_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("order_no", order_no)
      .eq("status", "pending")
      .select()
      .single();

    if (updateErr || !updated) {
      console.log(`[Webhook] 订单 ${order_no} 已处理或不存在，跳过`);
      return new Response(JSON.stringify({ code: "SUCCESS" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log(`[Webhook] 订单 ${order_no} 支付成功，plan_id=${updated.plan_id}`);

    // 更新用户套餐（写入 user_profiles）
    await supabase
      .from("user_profiles")
      .update({ plan_id: updated.plan_id, plan_updated_at: new Date().toISOString() })
      .eq("id", updated.user_id);

    return new Response(JSON.stringify({ code: "SUCCESS" }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[Webhook] 处理异常:", (err as Error).message);
    return new Response(JSON.stringify({ code: "FAIL", message: (err as Error).message }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
});
