import type { Env } from "../../lib/db";
import { dbAll } from "../../lib/db";
import { json } from "../../lib/response";
import { getPrincipal, requireRole } from "../../lib/auth";

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const p = await getPrincipal(ctx);
  const deny = requireRole(p, "admin");
  if (deny) return deny;

  const url = new URL(ctx.request.url);
  const limitRaw = Number(url.searchParams.get("limit") || "50");
  const offsetRaw = Number(url.searchParams.get("offset") || "0");
  const q = String(url.searchParams.get("q") || "").trim();
  const ownerId = String(url.searchParams.get("ownerId") || "").trim();

  const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? Math.floor(limitRaw) : 50, 1), 200);
  const offset = Math.max(Number.isFinite(offsetRaw) ? Math.floor(offsetRaw) : 0, 0);

  const where: string[] = [];
  const args: any[] = [];

  if (ownerId) {
    where.push("n.owner_id = ?");
    args.push(ownerId);
  }
  if (q) {
    where.push("(n.title LIKE ? OR n.body LIKE ? OR u.username LIKE ? OR n.owner_id LIKE ?)");
    const like = `%${q}%`;
    args.push(like, like, like, like);
  }

  const whereSql = where.length ? ("WHERE " + where.join(" AND ")) : "";

  const totalRows = await dbAll<any>(ctx.env.DB, `
    SELECT COUNT(*) as cnt
    FROM notes n
    LEFT JOIN users u ON u.id = n.owner_id AND n.owner_type = 'user'
    ${whereSql}
  `, args);
  const total = Number(totalRows?.[0]?.cnt || 0);

  const rows = await dbAll<any>(ctx.env.DB, `
    SELECT
      n.id, n.owner_type as ownerType, n.owner_id as ownerId,
      n.title, n.body, n.tags, n.done, n.pinned,
      n.created_at as createdAt, n.updated_at as updatedAt,
      u.username as ownerUsername
    FROM notes n
    LEFT JOIN users u ON u.id = n.owner_id AND n.owner_type = 'user'
    ${whereSql}
    ORDER BY n.updated_at DESC
    LIMIT ? OFFSET ?
  `, [...args, limit, offset]);

  return json({
    items: rows,
    notes: rows,
    page: {
      limit,
      offset,
      total,
      hasMore: offset + rows.length < total,
    },
  });
};
