import type { Env } from "../../lib/db";
import { json } from "../../lib/response";
import { clearAuthCookie } from "../../lib/auth";

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  // Determine whether we should set Secure cookies.
  // In production Pages requests are https; in local dev they are usually http.
  const xfProto = ctx.request.headers.get("x-forwarded-proto");
  const secure =
    (xfProto ? xfProto === "https" : new URL(ctx.request.url).protocol === "https:");

  return json({ ok: true }, { headers: { "Set-Cookie": clearAuthCookie(secure) } });
};

export const onRequest: PagesFunction<Env> = async (ctx) => {
  if (ctx.request.method === "POST") return onRequestPost(ctx);
  if (ctx.request.method === "OPTIONS") return json({ ok: true });
  return new Response("Method Not Allowed", { status: 405 });
};
