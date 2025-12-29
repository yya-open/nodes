import type { Env } from "../../lib/db";
import { dbAll } from "../../lib/db";
import { json } from "../../lib/response";
import { getPrincipal, requireRole } from "../../lib/auth";

function clampInt(v: any, def: number, min: number, max: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const p = await getPrincipal(ctx);
  const deny = requireRole(p, "admin");
  if (deny) return deny;

  const url = new URL(ctx.request.url);

  const pageParam = url.searchParams.get("page");
  const pageSizeParam = url.searchParams.get("pageSize");
  const limitRaw = url.searchParams.get("limit");
  const offsetRaw = url.searchParams.get("offset");

  const q = String(url.searchParams.get("q") || "").trim();
  const ownerId = String(url.searchParams.get("ownerId") || "").trim();

  let limit: number;
  let offset: number;
  let pageNum: number;
  let pageSize: number;

  if (pageParam !== null || pageSizeParam !== null) {
    pageNum = clampInt(pageParam, 1, 1, 1_000_000);
    pageSize = clampInt(pageSizeParam, 10, 1, 100);
    limit = pageSize;
    offset = (pageNum - 1) * pageSize;
  } else {
    limit = clampInt(limitRaw, 50, 1, 200);
    offset = clampInt(offsetRaw, 0, 0, 1_000_000_000);
    pageNum = Math.floor(offset / limit) + 1;
    pageSize = limit;
  }

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

  const owners = await dbAll<any>(ctx.env.DB, `
    SELECT DISTINCT
      n.owner_id as ownerId,
      n.owner_type as ownerType,
      u.username as ownerUsername
    FROM notes n
    LEFT JOIN users u ON u.id = n.owner_id AND n.owner_type = 'user'
    ORDER BY COALESCE(u.username, ''), n.owner_id
  `);

  return json({
    items: rows,
    total,
    pageNum,
    pageSize,
    owners,

    // backward compatibility
    notes: rows,
    page: {
      limit,
      offset,
      total,
      hasMore: offset + rows.length < total,
    },
  });
};
