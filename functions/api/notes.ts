import type { Env } from "../lib/db";
import { dbAll, dbRun } from "../lib/db";
import { json, err, readJson } from "../lib/response";
import { getPrincipal, requireAuth } from "../lib/auth";
import { randomId } from "../lib/crypto";

type Note = {
  id: string;
  title: string;
  body: string;
  tags: string[];
  done: boolean;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
};

function toBoolInt(v: any) {
  return v ? 1 : 0;
}
function fromRow(r: any): Note {
  return {
    id: String(r.id),
    title: String(r.title || ""),
    body: String(r.body || ""),
    tags: (() => { try { return JSON.parse(String(r.tags || "[]")); } catch { return []; } })(),
    done: !!r.done,
    pinned: !!r.pinned,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

function sortSql(sort: string) {
  switch (sort) {
    case "updated_asc": return "pinned DESC, updated_at ASC";
    case "created_desc": return "pinned DESC, created_at DESC";
    case "created_asc": return "pinned DESC, created_at ASC";
    case "updated_desc":
    default: return "pinned DESC, updated_at DESC";
  }
}

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const p = await getPrincipal(ctx);
  const deny = requireAuth(p);
  if (deny) return deny;

  const url = new URL(ctx.request.url);
  const q = (url.searchParams.get("q") || "").trim();
  const filter = (url.searchParams.get("filter") || "all").trim();
  const sort = (url.searchParams.get("sort") || "updated_desc").trim();

  // ownership
  let ownerType: "user" | "guest";
  let ownerId: string;

  if (p.role === "admin" && url.searchParams.get("owner")) {
    // admin can inspect other owners if needed; format: user:<id> or guest:<id>
    const o = url.searchParams.get("owner")!;
    if (o.startsWith("user:")) { ownerType = "user"; ownerId = o; }
    else if (o.startsWith("guest:")) { ownerType = "guest"; ownerId = o; }
    else { ownerType = "user"; ownerId = o; } // fallback
  } else {
    ownerId = p.id;
    ownerType = p.role === "guest" ? "guest" : "user";
  }

  const where: string[] = ["owner_type = ? AND owner_id = ?"];
  const params: any[] = [ownerType, ownerId];

  if (filter === "active") where.push("done = 0");
  if (filter === "done") where.push("done = 1");
  if (filter === "pinned") where.push("pinned = 1");

  if (q) {
    where.push("(title LIKE ? OR body LIKE ? OR tags LIKE ?)");
    const like = `%${q.replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;
    params.push(like, like, like);
  }

  const sql = `
    SELECT id, title, body, tags, done, pinned, created_at, updated_at
    FROM notes
    WHERE ${where.join(" AND ")}
    ORDER BY ${sortSql(sort)}
    LIMIT 500
  `;
  const rows = await dbAll<any>(ctx.env.DB, sql, params);
  return json({ items: rows.map(fromRow) });
};

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const p = await getPrincipal(ctx);
  const deny = requireAuth(p);
  if (deny) return deny;

  const body = await readJson<any>(ctx.request);
  const title = String(body.title || "").trim();
  const text = String(body.body || "").trim();
  const tags = Array.isArray(body.tags) ? body.tags.map(String).slice(0, 12) : [];
  const done = !!body.done;
  const pinned = !!body.pinned;

  if (!title && !text) return err(400, "标题和内容至少填写一个");

  const id = `note:${randomId(18)}`;
  const t = new Date().toISOString();
  const ownerType = p.role === "guest" ? "guest" : "user";
  const ownerId = p.id;

  await dbRun(
    ctx.env.DB,
    `INSERT INTO notes (id, owner_type, owner_id, title, body, tags, done, pinned, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, ownerType, ownerId, title, text, JSON.stringify(tags), toBoolInt(done), toBoolInt(pinned), t, t]
  );

  const item = { id, title, body: text, tags, done, pinned, createdAt: t, updatedAt: t };
  return json({ item }, { status: 201 });
};

export const onRequest: PagesFunction<Env> = async (ctx) => {
  if (ctx.request.method === "GET") return onRequestGet(ctx);
  if (ctx.request.method === "POST") return onRequestPost(ctx);
  if (ctx.request.method === "OPTIONS") return json({ ok: true });
  return new Response("Method Not Allowed", { status: 405 });
};
