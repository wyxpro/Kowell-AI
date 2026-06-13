import { handleCors, corsHeaders } from "../_shared/cors.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req: Request): Promise<Response> => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { email, password, role } = await req.json();
    if (!email || !password) {
      return new Response(JSON.stringify({ error: "Missing email or password" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 查找用户
    const { data: users, error: listErr } = await supabase.auth.admin.listUsers();
    if (listErr) throw listErr;

    const targetUser = users.users.find((u: { email?: string }) => u.email === email);
    if (!targetUser) {
      // 创建新用户
      const { data: createData, error: createErr } = await supabase.auth.admin.createUser({
        email, password, email_confirm: true,
      });
      if (createErr) throw createErr;
      const uid = createData.user!.id;
      // 触发器会自动创建 profile，等待一下
      await new Promise(r => setTimeout(r, 500));
      await supabase.from("user_profiles").update({ role: role || "admin" }).eq("id", uid);
      return new Response(JSON.stringify({ success: true, message: "创建成功", userId: uid }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 重置密码
    const { error: updateErr } = await supabase.auth.admin.updateUserById(targetUser.id, { password });
    if (updateErr) throw updateErr;

    // 更新角色
    await supabase.from("user_profiles").update({ role: role || "admin" }).eq("id", targetUser.id);

    return new Response(JSON.stringify({ success: true, message: "密码已重置并设为管理员", userId: targetUser.id }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
