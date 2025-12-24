import type { Env } from "../../../../lib/db";
import { dbOne, dbRun } from "../../../../lib/db";
import { json, err } from "../../../../lib/response";
import { getPrincipal, requireRole } from "../../../../lib/auth";
import { pbkdf2Hash, randomId } from "../../../../lib/crypto";

function decodeId(raw: string) {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

async function userExists(env: Env, id: string) {
  const r = await dbOne(env.DB, "SELECT id, role, username FROM users WHERE id = ?", [id]);
  return r?.row || null;
}

function sanitizeRole(role: any) {
  if (role === undefined || role === null) return undefined;
  if (role === "admin" || role === "user") return role as "admin" | "user";
  return null;
}

function pickPasscode(body: any): string | undefined {
  const v =
    body?.passcode ??
    body?.newPasscode ??
    body?.new_passcode ??
    body?.resetPasscode ??
    body?.reset_passcode ??
    body?.pass;
  return typeof v === "string" ? v : undefined;
}

export const onRequestPatch: PagesFunction<Env> = async (ctx) => {
  // Make sure any exception becomes JSON rather than a Cloudflare 1101 HTML page
  try {
    const p = await getPrincipal(ctx);
    if (!p) return err(401, "UNAUTHORIZED");
    requireRole(p, "admin");

    const rawId = String(ctx.params.id ?? "");
    const id = decodeId(rawId);

    const exists = await userExists(ctx.env, id);
    if (!exists) return err(404, "USER_NOT_FOUND");

    if (exists.role === "admin" && exists.username === "admin") {
      return err(400, "CANNOT_EDIT_BOOTSTRAP_ADMIN");
    }

    let body: any = {};
    try {
      // Some clients may send an empty body; treat as {}
      body = await ctx.request.json();
    } catch {
      body = {};
    }

    const now = Date.now();

    // 1) role update (optional)
    const role = sanitizeRole(body.role);
    if (role === null) return err(400, "INVALID_ROLE");

    // 2) passcode reset (optional)
    const passcode = pickPasscode(body);
    const wantReset = body?.reset === true || body?.reset_passcode === true || passcode !== undefined;

    if (!wantReset && role === undefined) {
      return err(400, "NO_CHANGES");
    }

    // apply updates in a single transaction-like sequence
    if (role !== undefined) {
      await dbRun(ctx.env.DB, "UPDATE users SET role = ?, updated_at = ? WHERE id = ?", [role, now, id]);
    }

    if (wantReset) {
      if (!passcode || passcode.length < 6) return err(400, "PASSCODE_TOO_SHORT");
      const salt = randomId(16);
      // Cloudflare PBKDF2 iteration limit exists; keep default inside crypto.ts <= 100k.
      const hash = await pbkdf2Hash(passcode, salt);
      await dbRun(ctx.env.DB, "UPDATE users SET pass_hash = ?, pass_salt = ?, updated_at = ? WHERE id = ?", [
        hash,
        salt,
        now,
        id,
      ]);
    }

    const updated = await userExists(ctx.env, id);
    return json({ ok: true, user: updated });
  } catch (e: any) {
    // Ensure client gets actionable info
    return json(
      {
        ok: false,
        error: "INTERNAL_ERROR",
        message: String(e?.message || e),
      },
      500
    );
  }
};
