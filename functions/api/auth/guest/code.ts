import { getPrincipal, requireRole } from "../../../lib/auth";
import { randomId } from "../../../lib/crypto";


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

  const code = `G-${randomId(18)}`;
  const expiresAtMs = Date.now() + 15 * 60 * 1000;
  const expiresAt = new Date(expiresAtMs).toISOString();

  await ctx.env.DB.prepare(
    "INSERT INTO guest_transfer_codes(code, guest_sub, expires_at, used_at, created_at) VALUES(?,?,?,?,?)"
  ).bind(code, p.id, expiresAt, null, nowISO()).run();

  return json({ code, expiresAt });
};
