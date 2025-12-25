import type { Env } from "./lib/db";
import { runShareCleanupMaybe } from "./lib/share_cleanup";

/**
 * Lightweight “scheduled” cleanup for Pages Functions.
 *
 * Cloudflare Pages doesn't reliably provide Cron Triggers in all setups.
 * So we run cleanup opportunistically via middleware, gated by an interval.
 * This gives you a near-scheduled cleanup as long as the site has traffic.
 */
export const onRequest: PagesFunction<Env> = async (ctx) => {
  const url = new URL(ctx.request.url);

  // Only run on API traffic to keep static asset requests fast.
  if (url.pathname.startsWith("/api/")) {
    // Run in the background; never block the response.
    ctx.waitUntil(
      runShareCleanupMaybe(ctx.env.DB).catch(() => {
        /* ignore */
      })
    );
  }

  return ctx.next();
};
