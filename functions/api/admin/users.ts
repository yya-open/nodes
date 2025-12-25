import type { Env } from "../../lib/db";
import { dbAll, dbOne, dbRun } from "../../lib/db";
import { json, err, readJson } from "../../lib/response";
import { getPrincipal, requireRole } from "../../lib/auth";
import { pbkdf2Hash, randomId } from "../../lib/crypto";

function sanitizeRole(role: string) {
  if (role === "admin" || role === "user") return role;
  return null;
}

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const p = await getPrincipal(ctx);
  const deny = requireRole(p, "admin");
  if (deny) return deny;

  const url = new URL(ctx.request.url);
  const limitRaw = Number(url.searchParams.get("limit") || "50");
  const offsetRaw = Number(url.searchParams.get("offset") || "0");

  const limit = Math.max(1, Math.min(1000, Number.isFinite(limitRaw) ? Math.floor(limitRaw) : 50));
  const offset = Math.max(0, Number.isFinite(offsetRaw) ? Math.floor(offsetRaw) : 0);

  const totalRow = await dbOne<any>(ctx.env.DB, "SELECT COUNT(*) as c FROM users");
  const total = Number(totalRow?.c || 0);

  const items = await dbAll<any>(
    ctx.env.DB,
    "SELECT id, username, role, created_at, updated_at FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?",
    [limit, offset]
  );

  return json({
    items: items.map((u) => ({
      id: String(u.id),
      username: String(u.username),
      role: String(u.role),
      createdAt: String(u.created_at),
      updatedAt: String(u.updated_at),
    })),
    page: {
      limit,
      offset,
      total,
      hasMore: offset + items.length < total,
    },
  });
};


export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const p = await getPrincipal(ctx);
  const deny = requireRole(p, "admin");
  if (deny) return deny;

  const body = await readJson<any>(ctx.request);
  const username = String(body.username || "").trim();
  const passcode = String(body.passcode || "").trim();
  const role = sanitizeRole(String(body.role || "user"));
  if (!username || !passcode) return err(400, "用户名和口令不能为空");
  if (passcode.length < 6) return err(400, "口令至少6位");
  if (!role) return err(400, "role 必须是 admin 或 user");

  const exists = await dbOne(ctx.env.DB, "SELECT id FROM users WHERE username = ?", [username]);
  if (exists) return err(409, "用户名已存在");

  const id = `user:${randomId(18)}`;
  const salt = randomId(18);
  const hash = await pbkdf2Hash(passcode, salt);
  const t = new Date().toISOString();

  await dbRun(
    ctx.env.DB,
    "INSERT INTO users (id, username, role, pass_salt, pass_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [id, username, role, salt, hash, t, t]
  );

  return json({ ok: true }, { status: 201 });
};

export const onRequest: PagesFunction<Env> = async (ctx) => {
  if (ctx.request.method === "GET") return onRequestGet(ctx);
  if (ctx.request.method === "POST") return onRequestPost(ctx);
  if (ctx.request.method === "OPTIONS") return json({ ok: true });
  return new Response("Method Not Allowed", { status: 405 });
};
