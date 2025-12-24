import type { Env } from "../../lib/db";
import { dbOne, dbRun } from "../../lib/db";
import { json, err, readJson } from "../../lib/response";
import { getPrincipal, requireAuth } from "../../lib/auth";

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
  };
}

async function loadOwnedNote(env: Env, noteId: string, principal: any) {
  const row = await dbOne<any>(
    env.DB,
    "SELECT * FROM notes WHERE id = ?",
    [noteId]
  );
  if (!row) return { row: null, deny: err(404, "未找到") };

  if (principal.role === "admin") return { row, deny: null };

  const ownerType = principal.role === "guest" ? "guest" : "user";
  if (row.owner_type !== ownerType || row.owner_id !== principal.id) {
    return { row: null, deny: err(403, "无权限") };
  }
  return { row, deny: null };
}

export const onRequestPut: PagesFunction<Env> = async (ctx) => {
  const p = await getPrincipal(ctx);
  const deny0 = requireAuth(p);
  if (deny0) return deny0;

  const noteId = decodeURIComponent(ctx.params.id as string);
  const { row, deny } = await loadOwnedNote(ctx.env, noteId, p);
  if (deny) return deny;

  const body = await readJson<any>(ctx.request);
  const title = body.title !== undefined ? String(body.title || "").trim() : String(row.title || "");
  const text = body.body !== undefined ? String(body.body || "").trim() : String(row.body || "");
  const tags = body.tags !== undefined ? (Array.isArray(body.tags) ? body.tags.map(String).slice(0, 12) : []) : (() => { try { return JSON.parse(String(row.tags||"[]")); } catch { return []; } })();
  const done = body.done !== undefined ? !!body.done : !!row.done;
  const pinned = body.pinned !== undefined ? !!body.pinned : !!row.pinned;

  if (!title && !text) return err(400, "标题和内容至少填写一个");

  const t = new Date().toISOString();
  await dbRun(
    ctx.env.DB,
    "UPDATE notes SET title = ?, body = ?, tags = ?, done = ?, pinned = ?, updated_at = ? WHERE id = ?",
    [title, text, JSON.stringify(tags), done ? 1 : 0, pinned ? 1 : 0, t, noteId]
  );

  const updated = await dbOne<any>(ctx.env.DB, "SELECT * FROM notes WHERE id = ?", [noteId]);
  return json({ item: fromRow(updated) });
};

export const onRequestDelete: PagesFunction<Env> = async (ctx) => {
  const p = await getPrincipal(ctx);
  const deny0 = requireAuth(p);
  if (deny0) return deny0;

  const noteId = decodeURIComponent(ctx.params.id as string);
  const { deny } = await loadOwnedNote(ctx.env, noteId, p);
  if (deny) return deny;

  await dbRun(ctx.env.DB, "DELETE FROM notes WHERE id = ?", [noteId]);
  return json({ ok: true });
};

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const p = await getPrincipal(ctx);
  const deny0 = requireAuth(p);
  if (deny0) return deny0;

  const noteId = decodeURIComponent(ctx.params.id as string);
  const { row, deny } = await loadOwnedNote(ctx.env, noteId, p);
  if (deny) return deny;
  return json({ item: fromRow(row) });
};

export const onRequest: PagesFunction<Env> = async (ctx) => {
  if (ctx.request.method === "PUT") return onRequestPut(ctx);
  if (ctx.request.method === "DELETE") return onRequestDelete(ctx);
  if (ctx.request.method === "GET") return onRequestGet(ctx);
  if (ctx.request.method === "OPTIONS") return json({ ok: true });
  return new Response("Method Not Allowed", { status: 405 });
};
