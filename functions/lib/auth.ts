import { parseCookies, serializeCookie } from "./cookies";
import { hmacSha256, b64urlEncodeText, b64urlDecodeText, randomId } from "./crypto";
import { err } from "./response";

export type Role = "guest" | "user" | "admin";
export type Principal =
  | { authenticated: false; role: "none" }
  | { authenticated: true; id: string; role: Role; username?: string; exp: number };

const COOKIE_NAME = "memo_token";

export function getCookieName() {
  return COOKIE_NAME;
}

export function setAuthCookie(token: string, secure: boolean) {
  return serializeCookie(COOKIE_NAME, token, { httpOnly: true, secure, sameSite: "Lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
}
export function clearAuthCookie(secure: boolean) {
  return serializeCookie(COOKIE_NAME, "", { httpOnly: true, secure, sameSite: "Lax", path: "/", maxAge: 0 });
}

// Lightweight JWT-like token: base64url(payload).sig
// payload = JSON string { sub, role, username?, exp }
export async function signToken(env: { TOKEN_SECRET: string }, payload: any) {
  const body = b64urlEncodeText(JSON.stringify(payload));
  const sig = await hmacSha256(env.TOKEN_SECRET, body);
  return `${body}.${sig}`;
}

export async function verifyToken(env: { TOKEN_SECRET: string }, token: string) {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const expect = await hmacSha256(env.TOKEN_SECRET, body);
  if (expect !== sig) return null;
  let payload: any;
  try {
    payload = JSON.parse(b64urlDecodeText(body));
  } catch {
    return null;
  }
  if (!payload || typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
  return payload;
}

export async function getPrincipal(ctx: { request: Request; env: any }): Promise<Principal> {
  const cookies = parseCookies(ctx.request.headers.get("cookie"));
  const token = cookies[COOKIE_NAME];
  if (!token) return { authenticated: false, role: "none" };
  const payload = await verifyToken(ctx.env, token);
  if (!payload) return { authenticated: false, role: "none" };
  return {
    authenticated: true,
    id: String(payload.sub),
    role: payload.role as Role,
    username: payload.username ? String(payload.username) : undefined,
    exp: payload.exp,
  };
}

export function requireAuth(p: Principal) {
  if (!p.authenticated) return err(401, "未登录");
  return null;
}

export function requireRole(p: Principal, role: Role) {
  if (!p.authenticated) return err(401, "未登录");
  const rank: Record<Role, number> = { guest: 1, user: 2, admin: 3 };
  if (rank[p.role] < rank[role]) return err(403, "权限不足");
  return null;
}

export function newGuestSubject() {
  return `guest:${randomId(18)}`;
}
