import type { Env } from "../../lib/db";
import { dbAll } from "../../lib/db";
import { json } from "../../lib/response";
import { getPrincipal, requireRole } from "../../lib/auth";

function fromRow(r: any) {
  return {
    id: String(r.id),
    title: String(r.title || ""),
    body: String(r.body || ""),
    tags: (() => { try { return JSON.parse(String(r.tags || "[]")); } catch { return []; } })(),
    done: !!r.done,
    pinned: !!r.pinned,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
    ownerType: String(r.owner_type),
    ownerId: String(r.owner_id),
    ownerUsername: r.owner_username ? String(r.owner_username) : null,
  };
}

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const p = await getPrincipal(ctx);
  const deny = requireRole(p as any, "admin");
  if (deny) return deny;

  const url = new URL(ctx.request.url);
  const q = (url.searchParams.get("q") || "").trim().toLowerCase();

  const where: string[] = [];
  const params: any[] = [];

  if (q) {
    where.push(`(
      lower(n.title) LIKE ? OR
      lower(n.body) LIKE ? OR
      lower(ifnull(u.username, '')) LIKE ? OR
      lower(n.owner_id) LIKE ?
    )`);
    const like = `%${q}%`;
    params.push(like, like, like, like);
  }

  const sql = `
    SELECT
      n.id, n.title, n.body, n.tags, n.done, n.pinned, n.created_at, n.updated_at,
      n.owner_type, n.owner_id,
      u.username AS owner_username
    FROM notes n
    LEFT JOIN users u
      ON n.owner_type = 'user' AND u.id = n.owner_id
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY n.updated_at DESC
    LIMIT 1000
  `;

  const rows = await dbAll<any>(ctx.env.DB, sql, params);
  return json({ items: rows.map(fromRow) });
};

export const onRequest: PagesFunction<Env> = async (ctx) => {
  if (ctx.request.method === "GET") return onRequestGet(ctx);
  if (ctx.request.method === "OPTIONS") return json({ ok: true });
  return new Response("Method Not Allowed", { status: 405 });
};
