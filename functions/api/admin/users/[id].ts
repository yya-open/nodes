// Admin user management: PATCH (reset passcode / change role) and DELETE (remove user)
// This file is for Cloudflare Pages Functions: functions/api/admin/users/[id].ts

import { getPrincipal, requireRole } from "../../../lib/auth";
import { pbkdf2Hash, randomId } from "../../../lib/crypto";

function j(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

async function readBody(req: Request): Promise<any> {
  try {
    const ct = req.headers.get("content-type") || "";
    if (!ct.includes("application/json")) return {};
    return await req.json();
  } catch {
    return {};
  }
}

function pickPasscode(body: any): string | undefined {
  const keys = ["passcode", "newPasscode", "new_passcode", "resetPasscode", "reset_passcode", "pass"];
  for (const k of keys) {
    if (body && typeof body[k] === "string") return body[k];
  }
  return undefined;
}

async function firstRow(env: any, sql: string, binds: any[] = []) {
  return await env.DB.prepare(sql).bind(...binds).first();
}

async function exec(env: any, sql: string, binds: any[] = []) {
  return await env.DB.prepare(sql).bind(...binds).run();
}

/** key can be either users.id or users.username */
async function resolveUser(env: any, key: string) {
  const row = await firstRow(
    env,
    `SELECT id, username, role FROM users WHERE id = ?1 OR username = ?1 LIMIT 1`,
    [key]
  );
  return row ? { id: String((row as any).id), username: String((row as any).username), role: String((row as any).role) } : null;
}

export const onRequestPatch: PagesFunction = async (ctx) => {
  try {
    const p = await getPrincipal(ctx as any);
    const deny = requireRole(p, "admin");
    if (deny) return deny;

    const rawKey = String((ctx as any).params?.id || "");
    const key = decodeURIComponent(rawKey);

    const target = await resolveUser(ctx.env, key);
    if (!target) return j({ ok: false, error: "USER_NOT_FOUND" }, 404);

    const body = await readBody(ctx.request);
    const nextRole = body?.role;
    const passcode = pickPasscode(body);

    if (nextRole === undefined && passcode === undefined) {
      return j({ ok: false, error: "NO_CHANGES" }, 400);
    }

    // Prevent demoting the last admin or demoting yourself from admin.
    if (nextRole !== undefined) {
      if (nextRole !== "admin" && nextRole !== "user") return j({ ok: false, error: "INVALID_ROLE" }, 400);

      if (target.id === (p as any).id && nextRole !== "admin") {
        return j({ ok: false, error: "CANNOT_DEMOTE_SELF" }, 400);
      }
      if (target.role === "admin" && nextRole !== "admin") {
        const otherAdmins = await firstRow(
          ctx.env,
          `SELECT COUNT(*) as c FROM users WHERE role='admin' AND id <> ?1`,
          [target.id]
        );
        const c = Number((otherAdmins as any)?.c || 0);
        if (c <= 0) return j({ ok: false, error: "CANNOT_REMOVE_LAST_ADMIN" }, 400);
      }

      await exec(ctx.env, `UPDATE users SET role=?1, updated_at=?2 WHERE id=?3`, [
        nextRole,
        new Date().toISOString(),
        target.id,
      ]);
    }

    if (passcode !== undefined) {
      const pc = String(passcode);
      if (pc.length < 6) return j({ ok: false, error: "PASSCODE_TOO_SHORT" }, 400);

      const salt = randomId(16);
      const hash = await pbkdf2Hash(pc, salt);
      await exec(ctx.env, `UPDATE users SET pass_salt=?1, pass_hash=?2, updated_at=?3 WHERE id=?4`, [
        salt,
        hash,
        new Date().toISOString(),
        target.id,
      ]);
    }

    return j({ ok: true });
  } catch (e: any) {
    return j({ ok: false, error: "INTERNAL_ERROR", detail: String(e?.message || e) }, 500);
  }
};

export const onRequestDelete: PagesFunction = async (ctx) => {
  try {
    const p = await getPrincipal(ctx as any);
    const deny = requireRole(p, "admin");
    if (deny) return deny;

    const rawKey = String((ctx as any).params?.id || "");
    const key = decodeURIComponent(rawKey);

    const target = await resolveUser(ctx.env, key);
    if (!target) return j({ ok: false, error: "USER_NOT_FOUND" }, 404);

    // Cannot delete self
    if (target.id === (p as any).id) return j({ ok: false, error: "CANNOT_DELETE_SELF" }, 400);

    // Cannot delete the last admin
    if (target.role === "admin") {
      const otherAdmins = await firstRow(
        ctx.env,
        `SELECT COUNT(*) as c FROM users WHERE role='admin' AND id <> ?1`,
        [target.id]
      );
      const c = Number((otherAdmins as any)?.c || 0);
      if (c <= 0) return j({ ok: false, error: "CANNOT_DELETE_LAST_ADMIN" }, 400);
    }

    // Clean up notes owned by this user
    await exec(ctx.env, `DELETE FROM notes WHERE owner_type='user' AND owner_id=?1`, [target.id]);
    await exec(ctx.env, `DELETE FROM users WHERE id=?1`, [target.id]);

    return j({ ok: true });
  } catch (e: any) {
    return j({ ok: false, error: "INTERNAL_ERROR", detail: String(e?.message || e) }, 500);
  }
};

// Optional: explicitly disallow GET/POST
export const onRequestGet: PagesFunction = async () => j({ ok: false, error: "METHOD_NOT_ALLOWED" }, 405);
export const onRequestPost: PagesFunction = async () => j({ ok: false, error: "METHOD_NOT_ALLOWED" }, 405);
