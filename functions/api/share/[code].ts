import type { Env } from "../../lib/db";
import { dbOne, dbRun } from "../../lib/db";
import { json, err } from "../../lib/response";

function nowIso() {
  return new Date(Date.now()).toISOString();
}

export async function onRequestGet(ctx: { request: Request; env: Env; params: { code: string } }) {
  const code = decodeURIComponent(ctx.params.code || "");
  if (!code) return err(400, "缺少 code");

  const share = await dbOne<any>(
    ctx.env.DB,
    `SELECT code, note_id, expires_at, reads, burn_after_read, revoked
     FROM note_shares WHERE code = ?`,
    [code]
  );
  if (!share) return err(404, "分享不存在");
  if (share.revoked) return err(410, "分享已失效");

  if (share.expires_at) {
    const exp = Date.parse(String(share.expires_at));
    if (!Number.isNaN(exp) && Date.now() > exp) {
      // mark revoked
      await dbRun(ctx.env.DB, "UPDATE note_shares SET revoked = 1 WHERE code = ?", [code]);
      return err(410, "分享已过期");
    }
  }

  const note = await dbOne<any>(
    ctx.env.DB,
    "SELECT id, title, body, tags, created_at, updated_at FROM notes WHERE id = ?",
    [String(share.note_id)]
  );
  if (!note) {
    await dbRun(ctx.env.DB, "UPDATE note_shares SET revoked = 1 WHERE code = ?", [code]);
    return err(404, "备忘录已不存在");
  }

  // increment reads
  const nextReads = Number(share.reads || 0) + 1;
  await dbRun(ctx.env.DB, "UPDATE note_shares SET reads = ? WHERE code = ?", [nextReads, code]);

  // burn after read
  if (share.burn_after_read) {
    await dbRun(ctx.env.DB, "UPDATE note_shares SET revoked = 1 WHERE code = ?", [code]);
  }

  let tags: any[] = [];
  try { tags = JSON.parse(String(note.tags || "[]")); } catch { tags = []; }

  return json({
    note: {
      id: String(note.id),
      title: String(note.title || ""),
      body: String(note.body || ""),
      tags,
      createdAt: String(note.created_at),
      updatedAt: String(note.updated_at),
    },
    meta: {
      code,
      reads: nextReads,
      burned: !!share.burn_after_read,
      expiresAt: share.expires_at ? String(share.expires_at) : null,
      servedAt: nowIso(),
    },
  });
}
