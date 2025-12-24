import { getPrincipal, requireRole, signToken, setAuthCookie } from "../../../lib/auth";
import { randomId, pbkdf2Hash } from "../../../lib/crypto";


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
  const p = await getPrincipal(ctx);
  const guard = requireRole(p, "guest");
  if (guard) return guard;

  let body: any = null;
  try {
    body = await ctx.request.json();
  } catch {}
  const username = String(body?.username || "").trim();
  const passcode = String(body?.passcode || "").trim();
  if (!username || !passcode) return err(400, "缺少用户名或口令");
  if (passcode.length < 6) return err(400, "口令至少6位");

  const exists = await ctx.env.DB.prepare(
    "SELECT id FROM users WHERE username = ?"
  ).bind(username).first();
  if (exists) return err(409, "用户名已存在");

  const userId = `user:${randomId(18)}`;
  const salt = randomId(18);
  const hash = await pbkdf2Hash(passcode, salt);
  const now = nowISO();

  await ctx.env.DB.prepare(
    "INSERT INTO users(id, username, role, pass_salt, pass_hash, created_at, updated_at) VALUES(?,?,?,?,?,?,?)"
  ).bind(userId, username, "user", salt, hash, now, now).run();

  await ctx.env.DB.prepare(
    "UPDATE notes SET owner_type = 'user', owner_id = ?, updated_at = ? WHERE owner_type = 'guest' AND owner_id = ?"
  ).bind(userId, now, p.id).run();

  const secure = new URL(ctx.request.url).protocol === "https:";
  const payload = {
    sub: userId,
    role: "user",
    username,
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
