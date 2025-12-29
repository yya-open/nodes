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

// 支持 page/pageSize（与 /api/notes 保持一致）；若未提供，则兼容旧的 limit/offset
const pageParam = url.searchParams.get("page");
const pageSizeParam = url.searchParams.get("pageSize");

let pageNum = 0;
let pageSize = 0;

let limit = Math.min(200, Math.max(1, Math.floor(limitRaw || 50)));
let offset = Math.max(0, Math.floor(offsetRaw || 0));

if (pageParam !== null || pageSizeParam !== null) {
  pageNum = Math.max(1, Math.floor(Number(pageParam || "1") || 1));
  pageSize = Math.min(100, Math.max(1, Math.floor(Number(pageSizeParam || "10") || 10)));
  limit = pageSize;
  offset = (pageNum - 1) * pageSize;
} else {
  // 旧版：按 offset/limit 推导页码
  pageSize = limit;
  pageNum = Math.floor(offset / Math.max(1, limit)) + 1;
}

  const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? Math.floor(limitRaw) : 50, 1), 200);
  const offset = Math.max(Number.isFinite(offsetRaw) ? Math.floor(offsetRaw) : 0, 0);

  // where for items/total
const where: string[] = [];
const args: any[] = [];

// where for owners dropdown (不包含 ownerId 过滤，便于切换创建者)
const whereOwners: string[] = [];
const argsOwners: any[] = [];

if (q) {
  const cond = "(n.title LIKE ? OR n.body LIKE ? OR u.username LIKE ? OR n.owner_id LIKE ?)";
  whereOwners.push(cond);
  where.push(cond);
  const like = `%${q}%`;
  argsOwners.push(like, like, like, like);
  args.push(like, like, like, like);
}

if (ownerId) {
  where.push("n.owner_id = ?");
  args.push(ownerId);
}

const whereSql = where.length ? ("WHERE " + where.join(" AND ")) : "";
const whereOwnersSql = whereOwners.length ? ("WHERE " + whereOwners.join(" AND ")) : "";

  
// owners list for dropdown
const owners = await dbAll<any>(ctx.env.DB, `
  SELECT DISTINCT
    n.owner_type as ownerType,
    n.owner_id as ownerId,
    u.username as ownerUsername
  FROM notes n
  LEFT JOIN users u ON u.id = n.owner_id AND n.owner_type = 'user'
  ${whereOwnersSql}
  ORDER BY COALESCE(u.username, n.owner_id) ASC
  LIMIT 500
`, argsOwners);

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

