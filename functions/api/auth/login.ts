import type { Env } from "../../lib/db";
import { dbAll, dbOne, dbRun } from "../../lib/db";
import { json, err, readJson } from "../../lib/response";
import { pbkdf2Hash, randomId } from "../../lib/crypto";
import { clearAuthCookie, newGuestSubject, setAuthCookie, signToken } from "../../lib/auth";

type LoginBody =
  | { mode: "guest" }
  | { mode: "user"; username: string; passcode: string };

async function ensureBootstrapAdmin(env: Env, username: string, passcode: string) {
  // If no users exist yet, allow creating the first admin from env vars.
  const anyUser = await dbOne(env.DB, "SELECT id FROM users LIMIT 1");
  if (anyUser) return null;

  if (!env.ADMIN_BOOTSTRAP_USER || !env.ADMIN_BOOTSTRAP_PASSCODE) return null;
  if (username !== env.ADMIN_BOOTSTRAP_USER || passcode !== env.ADMIN_BOOTSTRAP_PASSCODE) return null;

  const id = `user:${randomId(18)}`;
  const salt = randomId(18);
  const hash = await pbkdf2Hash(passcode, salt);
  const t = new Date().toISOString();
  await dbRun(
    env.DB,
    "INSERT INTO users (id, username, role, pass_salt, pass_hash, created_at, updated_at) VALUES (?, ?, 'admin', ?, ?, ?, ?)",
    [id, username, salt, hash, t, t]
  );
  return { id, username, role: "admin" as const };
}

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const secure = new URL(ctx.request.url).protocol === "https:";
  try {
    const body = await readJson<LoginBody>(ctx.request);

    // guest
    if (body.mode === "guest") {
      const sub = newGuestSubject();
      const exp = Date.now() + 1000 * 60 * 60 * 24 * 30; // 30d
      const token = await signToken(ctx.env, { sub, role: "guest", exp });
      return json(
        { ok: true, role: "guest" },
        { headers: { "Set-Cookie": setAuthCookie(token, secure) } }
      );
    }

    // user
    const username = String(body.username || "").trim();
    const passcode = String(body.passcode || "").trim();
    if (!username || !passcode) return err(400, "用户名和口令不能为空");

    // bootstrap path
    const boot = await ensureBootstrapAdmin(ctx.env, username, passcode);
    if (boot) {
      const exp = Date.now() + 1000 * 60 * 60 * 24 * 30;
      const token = await signToken(ctx.env, { sub: boot.id, role: boot.role, username: boot.username, exp });
      return json(
        { ok: true, role: boot.role, username: boot.username },
        { headers: { "Set-Cookie": setAuthCookie(token, secure) } }
      );
    }

    const user = await dbOne<{ id: string; username: string; role: string; pass_salt: string; pass_hash: string }>(
      ctx.env.DB,
      "SELECT id, username, role, pass_salt, pass_hash FROM users WHERE username = ?",
      [username]
    );
    if (!user) return err(401, "用户名或口令错误");

    const hash = await pbkdf2Hash(passcode, user.pass_salt);
    if (hash !== user.pass_hash) return err(401, "用户名或口令错误");

    const exp = Date.now() + 1000 * 60 * 60 * 24 * 30;
    const token = await signToken(ctx.env, { sub: user.id, role: user.role, username: user.username, exp });

    return json(
      { ok: true, role: user.role, username: user.username },
      { headers: { "Set-Cookie": setAuthCookie(token, secure) } }
    );
  } catch (e: any) {
    return err(400, e?.message || "请求错误");
  }
};

export const onRequestGet: PagesFunction<Env> = async () => {
  // avoid accidental GET usage
  return err(405, "Method Not Allowed");
};

export const onRequest: PagesFunction<Env> = async (ctx) => {
  if (ctx.request.method === "POST") return onRequestPost(ctx);
  if (ctx.request.method === "OPTIONS") return json({ ok: true });
  return err(405, "Method Not Allowed");
};
