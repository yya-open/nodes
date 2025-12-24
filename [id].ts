import type { Env } from "../../../lib/db";
import { dbOne, dbRun } from "../../../lib/db";
import { json, err } from "../../../lib/response";
import { getPrincipal, requireRole } from "../../../lib/auth";
import { pbkdf2Hash, randomId } from "../../../lib/crypto";

function sanitizeRole(role: any) {
  if (role === undefined || role === null) return undefined;
  if (role === "admin" || role === "user") return role as "admin" | "user";
  return null;
}

async function userExists(env: Env, id: string) {
  const r = await dbOne(env.DB, "SELECT id, role FROM users WHERE id = ?", [id]);
  return r?.row || null;
}

export const onRequestPatch: PagesFunction<Env> = async (ctx) => {
  const p = await getPrincipal(ctx);
  const deny = requireRole(p, "admin");
  if (deny) return deny;

  const id = decodeURIComponent(ctx.params.id as string);

  // Parse body safely
  let body: any = {};
  try {
    body = await ctx.request.json();
  } catch {
    body = {};
  }

  const role = sanitizeRole(body.role);
  const passcodeRaw = body.passcode;

  if (role === null) return err(400, "无效角色");
  if (passcodeRaw !== undefined && passcodeRaw !== null) {
    const passcode = String(passcodeRaw);
    if (passcode.length < 6) return err(400, "口令至少 6 位");
  }

  if (role === undefined && (passcodeRaw === undefined || passcodeRaw === null || String(passcodeRaw).length === 0)) {
    return err(400, "未提供更新字段");
  }

  const u = await userExists(ctx.env, id);
  if (!u) return err(404, "未找到用户");

  // Prevent accidentally demoting last admin
  if (role && role !== u.role) {
    if (u.role === "admin" && role !== "admin") {
      const cnt = await dbOne(ctx.env.DB, "SELECT COUNT(*) AS c FROM users WHERE role = 'admin' AND id != ?", [id]);
      const c = Number(cnt?.row?.c || 0);
      if (c <= 0) return err(400, "至少需要保留 1 个管理员");
    }
  }

  const now = new Date().toISOString();

  if (role !== undefined) {
    await dbRun(ctx.env.DB, "UPDATE users SET role = ?, updated_at = ? WHERE id = ?", [role, now, id]);
  }

  if (passcodeRaw !== undefined && passcodeRaw !== null && String(passcodeRaw).length > 0) {
    const salt = randomId(16);
    const hash = await pbkdf2Hash(String(passcodeRaw), salt);
    await dbRun(
      ctx.env.DB,
      "UPDATE users SET pass_salt = ?, pass_hash = ?, updated_at = ? WHERE id = ?",
      [salt, hash, now, id]
    );
  }

  return json({ ok: true });
};

export const onRequestDelete: PagesFunction<Env> = async (ctx) => {
  const p = await getPrincipal(ctx);
  const deny = requireRole(p, "admin");
  if (deny) return deny;

  const id = decodeURIComponent(ctx.params.id as string);

  if (p.authenticated && id === p.id) return err(400, "不能删除当前登录用户");

  const u = await userExists(ctx.env, id);
  if (!u) return err(404, "未找到用户");

  // Prevent deleting the last admin
  if (u.role === "admin") {
    const cnt = await dbOne(ctx.env.DB, "SELECT COUNT(*) AS c FROM users WHERE role = 'admin' AND id != ?", [id]);
    const c = Number(cnt?.row?.c || 0);
    if (c <= 0) return err(400, "至少需要保留 1 个管理员");
  }

  // Delete user's notes first (only user-owned)
  await dbRun(ctx.env.DB, "DELETE FROM notes WHERE owner_type = 'user' AND owner_id = ?", [id]);
  await dbRun(ctx.env.DB, "DELETE FROM users WHERE id = ?", [id]);

  return json({ ok: true });
};

export const onRequest: PagesFunction<Env> = async (ctx) => {
  if (ctx.request.method === "PATCH") return onRequestPatch(ctx);
  if (ctx.request.method === "DELETE") return onRequestDelete(ctx);
  if (ctx.request.method === "OPTIONS") return json({ ok: true });
  return new Response("Method Not Allowed", { status: 405 });
};
