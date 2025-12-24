import { signToken, setAuthCookie } from "../../../lib/auth";


function json(data: any, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  if (!headers.has("content-type")) headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), { ...init, headers });
}
function err(status: number, message: string) {
  return json({ error: message }, { status });
}
function nowISO() {
  return new Date().toISOString();
}


export const onRequestPost = async (ctx: any) => {
  let body: any = null;
  try {
    body = await ctx.request.json();
  } catch {}
  const code = String(body?.code || "").trim();
  if (!code) return err(400, "缺少恢复码");

  const row = await ctx.env.DB.prepare(
    "SELECT guest_sub, expires_at, used_at FROM guest_transfer_codes WHERE code = ?"
  ).bind(code).first();

  if (!row) return err(404, "恢复码不存在");
  if (row.used_at) return err(410, "恢复码已使用");

  const expiresAt = Date.parse(String(row.expires_at));
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return err(410, "恢复码已过期");

  await ctx.env.DB.prepare(
    "UPDATE guest_transfer_codes SET used_at = ? WHERE code = ?"
  ).bind(nowISO(), code).run();

  const secure = new URL(ctx.request.url).protocol === "https:";
  const payload = {
    sub: String(row.guest_sub),
    role: "guest",
    exp: Date.now() + 1000 * 60 * 60 * 24 * 30,
  };
  const token = await signToken(ctx.env, payload);

  return json({ ok: true }, {
    status: 200,
    headers: {
      "Set-Cookie": setAuthCookie(token, secure),
    },
  });
};
