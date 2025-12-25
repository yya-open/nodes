import type { Env } from "../../../lib/db";
import { json } from "../../../lib/response";
import { getPrincipal, requireRole } from "../../../lib/auth";
import { runShareCleanupMaybe } from "../../../lib/share_cleanup";

/**
 * Manual trigger endpoint for share cleanup.
 *
 * GET /api/admin/shares/cleanup?force=1
 */
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const p = await getPrincipal(ctx);
  const deny = requireRole(p, "admin");
  if (deny) return deny;

  const url = new URL(ctx.request.url);
  const force = url.searchParams.get("force") === "1" || url.searchParams.get("force") === "true";

  const result = await runShareCleanupMaybe(ctx.env.DB, { force });
  return json({ ok: true, result });
};

export const onRequest: PagesFunction<Env> = async (ctx) => {
  if (ctx.request.method === "GET") return onRequestGet(ctx);
  if (ctx.request.method === "OPTIONS") return json({ ok: true });
  return new Response("Method Not Allowed", { status: 405 });
};
