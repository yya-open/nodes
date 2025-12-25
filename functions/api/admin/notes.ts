import type { Env } from "../../lib/db";
import { dbAll, dbOne } from "../../lib/db";
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

  const limit = Math.max(1, Math.min(200, Number.isFinite(limitRaw) ? Math.floor(limitRaw) : 50));
  const offset = Math.max(0, Number.isFinite(offsetRaw) ? Math.floor(offsetRaw) : 0);

  let where = "WHERE 1=1";
  const params: any[] = [];

  if (ownerId) {
    where += " AND n.owner_id = ?";
    params.push(ownerId);
  }

  if (q) {
    where += " AND (n.title LIKE ? OR n.body LIKE ? OR u.username LIKE ? OR n.owner_id LIKE ?)";
    const like = `%${q}%`;
    params.push(like, like, like, like);
  }

  const totalRow = await dbOne<any>(
    ctx.env.DB,
    `
    SELECT COUNT(*) as c
    FROM notes n
    LEFT JOIN users u ON u.id = n.owner_id AND n.owner_type = 'user'
    ${where}
    `,
    params
  );
  const total = Number(totalRow?.c || 0);

  const rows = await dbAll<any>(
    ctx.env.DB,
    `
    SELECT
      n.id, n.owner_type as ownerType, n.owner_id as ownerId,
      n.title, n.body, n.tags, n.done, n.pinned,
      n.created_at as createdAt, n.updated_at as updatedAt,
      u.username as ownerUsername
    FROM notes n
    LEFT JOIN users u ON u.id = n.owner_id AND n.owner_type = 'user'
    ${where}
    ORDER BY n.updated_at DESC
    LIMIT ? OFFSET ?
    `,
    [...params, limit, offset]
  );

  return json({
    items: rows,
    notes: rows, // 兼容旧前端
    page: {
      limit,
      offset,
      total,
      hasMore: offset + rows.length < total,
    },
  });
};

