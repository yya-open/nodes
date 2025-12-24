import type { Env } from "../../../lib/db";
import { dbOne, dbRun } from "../../../lib/db";
import { err, json } from "../../../lib/response";
import { getPrincipal, requireRole } from "../../../lib/auth";
import { pbkdf2Hash, randomId } from "../../../lib/crypto";

/**
 * Admin user management: update role and/or reset passcode; delete user.
 *
 * Route: /api/admin/users/:id
 *
 * NOTE: The ":id" param may be either the internal users.id (e.g. "user:xxxx")
 * or the public username (e.g. "admin"). We resolve both to a real row first.
 */

function sanitizeRole(role: any) {
  if (role === undefined || role === null) return undefined;
  if (role === "admin" || role === "user") return role as "admin" | "user";
  return null;
}

async function resolveUser(env: Env, raw: string) {
  // Pages Functions should already decode params, but make it robust for safety.
  const key = decodeURIComponent(raw || "").trim();
  if (!key) return null;

  // Try by id first, then by username.
  const r =
    (await dbOne(
      env.DB,
      "SELECT id, username, role FROM users WHERE id = ?",
      [key],
    )) ||
    (await dbOne(
      env.DB,
      "SELECT id, username, role FROM users WHERE username = ?",
      [key],
    ));

  return r?.row || null;
}

export const onRequestPatch: PagesFunction<Env> = async (ctx) => {
  const p = await getPrincipal(ctx);
  requireRole(p, "admin");

  const target = await resolveUser(ctx.env, ctx.params.id as string);
  if (!target) return err("未找到用户", 404);

  let body: any = {};
  try {
    body = await ctx.request.json();
  } catch {
    body = {};
  }

  const role = sanitizeRole(body.role);
  if (role === null) return err("非法角色", 400);

  const passcode =
    typeof body.passcode === "string" ? body.passcode.trim() : undefined;

  // Validate passcode if provided (must be >= 6 chars as UI suggests)
  if (passcode !== undefined && passcode.length > 0 && passcode.length < 6) {
    return err("口令至少6位", 400);
  }

  // Build update statement dynamically
  const sets: string[] = [];
  const args: any[] = [];

  if (role !== undefined) {
    sets.push("role = ?");
    args.push(role);
  }

  if (passcode) {
    const salt = randomId(); // b64url
    const hash = await pbkdf2Hash(passcode, salt); // uses default iterations from crypto.ts
    sets.push("pass_salt = ?");
    args.push(salt);
    sets.push("pass_hash = ?");
    args.push(hash);
  }

  // Nothing to update
  if (sets.length === 0) {
    return json({
      ok: true,
      user: { id: target.id, username: target.username, role: target.role },
    });
  }

  sets.push("updated_at = strftime('%s','now')");

  args.push(target.id);

  await dbRun(ctx.env.DB, `UPDATE users SET ${sets.join(", ")} WHERE id = ?`, args);

  const updated = await dbOne(
    ctx.env.DB,
    "SELECT id, username, role, created_at, updated_at FROM users WHERE id = ?",
    [target.id],
  );

  return json({ ok: true, user: updated?.row || null });
};

export const onRequestDelete: PagesFunction<Env> = async (ctx) => {
  const p = await getPrincipal(ctx);
  requireRole(p, "admin");

  const target = await resolveUser(ctx.env, ctx.params.id as string);
  if (!target) return err("未找到用户", 404);

  // (Optional) Prevent deleting yourself to avoid locking out; comment out if you want.
  if (p?.username && target.username === p.username) {
    return err("不能删除当前登录的管理员", 400);
  }

  // Delete notes of this user (only if your schema uses owner_type/owner_id)
  // If the app already enforces cascades elsewhere, this is still safe.
  await dbRun(
    ctx.env.DB,
    "DELETE FROM notes WHERE owner_type = 'user' AND owner_id = ?",
    [target.id],
  );

  await dbRun(ctx.env.DB, "DELETE FROM users WHERE id = ?", [target.id]);

  return json({ ok: true });
};
