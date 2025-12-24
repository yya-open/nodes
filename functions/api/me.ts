import type { Env } from "../lib/db";
import { json } from "../lib/response";
import { getPrincipal } from "../lib/auth";

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const p = await getPrincipal(ctx);
  if (!p.authenticated) return json({ authenticated: false, role: "none" });
  return json({ authenticated: true, id: p.id, role: p.role, username: p.username });
};

export const onRequest: PagesFunction<Env> = async (ctx) => {
  if (ctx.request.method === "GET") return onRequestGet(ctx);
  if (ctx.request.method === "OPTIONS") return json({ ok: true });
  return new Response("Method Not Allowed", { status: 405 });
};
