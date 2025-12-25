import type { Env } from "../../lib/db";
import { dbAll } from "../../lib/db";
import { json } from "../../lib/response";
import { getPrincipal, requireRole } from "../../lib/auth";

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const p = await getPrincipal(ctx);
  const deny = requireRole(p, "admin");
  if (deny) return deny;

  const rows = await dbAll(ctx.env.DB, `
    SELECT
      n.id, n.owner_type as ownerType, n.owner_id as ownerId,
      n.title, n.body, n.tags, n.done, n.pinned,
      n.created_at as createdAt, n.updated_at as updatedAt,
      u.username as ownerUsername
    FROM notes n
    LEFT JOIN users u ON u.id = n.owner_id AND n.owner_type = 'user'
    ORDER BY n.updated_at DESC
    LIMIT 1000
  `);

  return json({ notes: rows });
};
