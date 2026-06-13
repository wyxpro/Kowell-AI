import { handleCors, corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Wechatpay } from "npm:wechatpay-axios-plugin";
import ShortUniqueId from "npm:short-unique-id";

function generateOrderNo() {
  const uid = new ShortUniqueId({ length: 8 });
  const yymmdd = new Date().toISOString().slice(2, 10).replace(/-/g, "");
  return `ORD-${yymmdd}-${uid.rnd()}`;
}

async function createWechatPayUrl(
  MERCHANT_ID: string,
  MERCHANT_APP_ID: string,
  MCH_CERT_SERIAL_NO: string,
  MCH_PRIVATE_KEY: string,
  WECHAT_PAY_PUBLIC_KEY_ID: string,
  WECHAT_PAY_PUBLIC_KEY: string,
  outTradeNo: string,
  amount: number,
  notifyUrl: string,
  description: string,
) {
  try {
    const wxpay = new Wechatpay({
      mchid: MERCHANT_ID,
      serial: MCH_CERT_SERIAL_NO,
      privateKey: MCH_PRIVATE_KEY,
      certs: { [WECHAT_PAY_PUBLIC_KEY_ID]: WECHAT_PAY_PUBLIC_KEY },
    });
    const res = await wxpay.v3.pay.transactions.native.post(
      {
        mchid: MERCHANT_ID,
        out_trade_no: outTradeNo,
        appid: MERCHANT_APP_ID,
        description,
        notify_url: notifyUrl,
        amount: { total: Math.round(amount * 100) },
      },
      { headers: { "Wechatpay-Serial": WECHAT_PAY_PUBLIC_KEY_ID } },
    );
    if (res.data.code_url) {
      console.log(`[WeChatPay SUCCESS] outTradeNo=${outTradeNo}, url=${res.data.code_url}`);
      return { success: true, url: res.data.code_url };
    } else {
      console.error(`[WeChatPay FAILED] outTradeNo=${outTradeNo}, error=${res.data.message || JSON.stringify(res.data)}`);
      return { success: false, error: res.data.message || JSON.stringify(res.data) };
    }
  } catch (err) {
    console.error(`[WeChatPay ERROR] outTradeNo=${outTradeNo}, error=${(err as Error)?.message || String(err)}`);
    return { success: false, error: (err as Error)?.message || String(err) };
  }
}

Deno.serve(async (req: Request): Promise<Response> => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // 校验登录
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "未登录" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { plan_id, billing_cycle = "month" } = await req.json();
    if (!plan_id) {
      return new Response(JSON.stringify({ error: "缺少 plan_id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 查询套餐价格
    const { data: sku } = await supabase
      .from("plan_skus")
      .select("*")
      .eq("plan_id", plan_id)
      .single();

    if (!sku) {
      return new Response(JSON.stringify({ error: "套餐不存在" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const amount = billing_cycle === "year" ? Number(sku.price_year) : Number(sku.price_month);
    if (amount <= 0) {
      return new Response(JSON.stringify({ error: "免费套餐无需支付" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const MERCHANT_ID = Deno.env.get("MERCHANT_ID") || "";
    const MERCHANT_APP_ID = Deno.env.get("MERCHANT_APP_ID") || "";
    const MCH_CERT_SERIAL_NO = Deno.env.get("MCH_CERT_SERIAL_NO") || "";
    const MCH_PRIVATE_KEY = Deno.env.get("MCH_PRIVATE_KEY") || "";
    const WECHAT_PAY_PUBLIC_KEY_ID = Deno.env.get("WECHAT_PAY_PUBLIC_KEY_ID") || "";
    const WECHAT_PAY_PUBLIC_KEY = Deno.env.get("WECHAT_PAY_PUBLIC_KEY") || "";

    if (!MERCHANT_ID || !MERCHANT_APP_ID || !MCH_PRIVATE_KEY) {
      // 未配置支付密钥，返回引导信息
      return new Response(
        JSON.stringify({ error: "payment_not_configured", message: "请在插件中心配置微信支付密钥后使用" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const orderNo = generateOrderNo();
    const notifyUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/wechat-payment-webhook`;
    const description = `智学伴${sku.plan_name}${billing_cycle === "year" ? "（年付）" : "（月付）"}`;

    // 先创建订单记录
    const { data: order, error: insertErr } = await supabase
      .from("orders")
      .insert({
        order_no: orderNo,
        user_id: user.id,
        plan_id,
        plan_name: sku.plan_name,
        billing_cycle,
        amount,
        status: "pending",
      })
      .select()
      .single();

    if (insertErr || !order) {
      return new Response(JSON.stringify({ error: "订单创建失败: " + insertErr?.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 调用微信支付
    const payResult = await createWechatPayUrl(
      MERCHANT_ID, MERCHANT_APP_ID, MCH_CERT_SERIAL_NO, MCH_PRIVATE_KEY,
      WECHAT_PAY_PUBLIC_KEY_ID, WECHAT_PAY_PUBLIC_KEY,
      orderNo, amount, notifyUrl, description,
    );

    if (!payResult.success) {
      // 回滚订单
      await supabase.from("orders").update({ status: "cancelled" }).eq("id", order.id);
      return new Response(JSON.stringify({ error: payResult.error }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 保存支付二维码URL
    await supabase.from("orders").update({ wechat_pay_url: payResult.url }).eq("id", order.id);

    return new Response(
      JSON.stringify({ order_no: orderNo, order_id: order.id, pay_url: payResult.url, amount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
