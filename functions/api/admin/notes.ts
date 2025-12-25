import type { Env } from "../../lib/db";
import { dbAll } from "../../lib/db";
import { json, err } from "../../lib/response";
import { getPrincipal, requireRole } from "../../lib/auth";

type Row = {
  id: string;
  owner_type: "user" | "guest";
  owner_id: string;
  title: string;
  body: string;
  tags: string;
  done: number;
  pinned: number;
  created_at: string;
  updated_at: string;
  owner_username: string | null;
};

function parseTags(s: any): string[] {
  try {
    const v = JSON.parse(String(s || "[]"));
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const p = await getPrincipal(ctx);
  const e = requireRole(p, "admin");
  if (e) return e;

  const rows = (await dbAll(
    ctx.env.DB,
    `SELECT n.*,
            u.username AS owner_username
       FROM notes n
       LEFT JOIN users u
         ON n.owner_type = 'user'
        AND n.owner_id = ('user:' || u.id)
      ORDER BY n.updated_at DESC
      LIMIT 1000`,
    []
  )) as Row[];

  const items = rows.map((r) => ({
    id: r.id,
    title: r.title || "",
    body: r.body || "",
    tags: parseTags(r.tags),
    done: !!r.done,
    pinned: !!r.pinned,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    ownerType: r.owner_type,
    ownerId: r.owner_id,
    ownerUsername: r.owner_username,
  }));

  return json({ items });
};

export const onRequest: PagesFunction<Env> = async (ctx) => {
  if (ctx.request.method === "GET") return onRequestGet(ctx);
  return err(405, "Method Not Allowed");
};
