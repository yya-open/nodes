import type { Env } from "../../lib/db";
import { json } from "../../lib/response";
import { clearAuthCookie } from "../../lib/auth";

export const onRequestPost: PagesFunction<Env> = async () => {
  return json({ ok: true }, { headers: { "Set-Cookie": clearAuthCookie(secure) } });
};

export const onRequest: PagesFunction<Env> = async (ctx) => {
  if (ctx.request.method === "POST") return onRequestPost(ctx);
  if (ctx.request.method === "OPTIONS") return json({ ok: true });
  return new Response("Method Not Allowed", { status: 405 });
};
