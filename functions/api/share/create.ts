import type { Env } from "../../lib/db";
import { dbOne, dbRun } from "../../lib/db";
import { json, err, readJson } from "../../lib/response";
import { getPrincipal, requireAuth } from "../../lib/auth";
import { randomId } from "../../lib/crypto";

type Body = {
  noteId: string;
  burnAfterRead?: boolean;
  expiresInSeconds?: number; // optional
};

export async function onRequestPost(ctx: { request: Request; env: Env }) {
  const p = await getPrincipal(ctx);
  const authErr = requireAuth(p);
  if (authErr) return authErr;

  let body: Body;
  try {
    body = await readJson<Body>(ctx.request);
  } catch (e: any) {
    return err(400, e?.message || "请求体错误");
  }

  const noteId = String(body.noteId || "").trim();
  if (!noteId) return err(400, "缺少 noteId");

  const note = await dbOne<any>(
    ctx.env.DB,
    "SELECT id, owner_type, owner_id, title, updated_at FROM notes WHERE id = ?",
    [noteId]
  );
  if (!note) return err(404, "未找到");

  // permission: owner or admin
  const isOwner = note.owner_id === p.id && ((p.role === "guest" && note.owner_type === "guest") || (p.role !== "guest" && note.owner_type === "user"));
  if (!(p.role === "admin" || isOwner)) return err(403, "权限不足");

  const burn = !!body.burnAfterRead;
  const expiresIn = Number(body.expiresInSeconds || 0);
  const now = Date.now();
  const createdAt = new Date(now).toISOString();
  const expiresAt = expiresIn > 0 ? new Date(now + expiresIn * 1000).toISOString() : null;

  const code = `s_${randomId(18)}`;

  await dbRun(
    ctx.env.DB,
    `INSERT INTO note_shares (code, note_id, owner_id, created_at, expires_at, reads, burn_after_read, revoked)
     VALUES (?, ?, ?, ?, ?, 0, ?, 0)`,
    [code, noteId, note.owner_id, createdAt, expiresAt, burn ? 1 : 0]
  );

  const origin = new URL(ctx.request.url).origin;
  const url = `${origin}/share.html#${code}`;

  return json({
    code,
    url,
    burnAfterRead: burn,
    expiresAt,
    note: { id: note.id, title: note.title, updatedAt: note.updated_at },
  });
}
