import type { Env } from "../../../lib/db";
import { dbOne, dbRun } from "../../../lib/db";
import { json, err, readJson } from "../../../lib/response";
import { getPrincipal, requireRole } from "../../../lib/auth";
import { pbkdf2Hash, randomId } from "../../../lib/crypto";

function sanitizeRole(role: string | undefined) {
  if (!role) return undefined;
  if (role === "admin" || role === "user") return role;
  return null;
}

export const onRequestPatch: PagesFunction<Env> = async (ctx) => {
  const p = await getPrincipal(ctx);
  const deny = requireRole(p, "admin");
  if (deny) return deny;

  const id = ctx.params.id as string;
  const user = await dbOne<any>(ctx.env.DB, "SELECT id, role FROM users WHERE id = ?", [id]);
  if (!user) return err(404, "用户不存在");

  const body = await readJson<any>(ctx.request);
  const role = sanitizeRole(body.role);
  if (role === null) return err(400, "role 必须是 admin 或 user");

  const passcode = body.passcode !== undefined ? String(body.passcode || "").trim() : undefined;
  if (passcode !== undefined && passcode.length > 0 && passcode.length < 6) return err(400, "口令至少6位");

  const updates: string[] = [];
  const params: any[] = [];

  if (role) {
    updates.push("role = ?");
    params.push(role);
  }
  if (passcode && passcode.length >= 6) {
    const salt = randomId(18);
    const hash = await pbkdf2Hash(passcode, salt);
    updates.push("pass_salt = ?");
    updates.push("pass_hash = ?");
    params.push(salt, hash);
  }

  if (updates.length === 0) return err(400, "没有可更新的字段");

  updates.push("updated_at = ?");
  params.push(new Date().toISOString());

  params.push(id);

  await dbRun(ctx.env.DB, `UPDATE users SET ${updates.join(", ")} WHERE id = ?`, params);

  return json({ ok: true });
};

export const onRequestDelete: PagesFunction<Env> = async (ctx) => {
  const p = await getPrincipal(ctx);
  const deny = requireRole(p, "admin");
  if (deny) return deny;

  const key = ctx.params.id as string;

  // key can be a raw user id like "user:xxxx" or a username like "alice"
  const u = await dbOne<any>(ctx.env.DB, "SELECT id, role, username FROM users WHERE id = ? OR username = ? LIMIT 1", [key, key]);
  if (!u) return err(404, "用户不存在");
  const id = u.id as string;

  // prevent deleting self
  if (p.authenticated && p.id === id) return err(400, "不能删除当前登录用户");
  if (u.role === "admin") return err(400, "不能删除管理员");
  // delete user's notes first
  await dbRun(ctx.env.DB, "DELETE FROM notes WHERE owner_id = ?", [id]);
  const r = await dbRun(ctx.env.DB, "DELETE FROM users WHERE id = ?", [id]);

  return json({ ok: true });
};

export const onRequest: PagesFunction<Env> = async (ctx) => {
  if (ctx.request.method === "PATCH") return onRequestPatch(ctx);
  if (ctx.request.method === "DELETE") return onRequestDelete(ctx);
  if (ctx.request.method === "OPTIONS") return json({ ok: true });
  return new Response("Method Not Allowed", { status: 405 });
};
