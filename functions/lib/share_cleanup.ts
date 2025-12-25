import { dbOne, dbRun } from "./db";

export type ShareCleanupOptions = {
  /** Minimum time between two cleanup runs (default: 6 hours). */
  intervalMs?: number;
  /** How long to keep revoked/expired shares before deleting (default: 7 days). */
  retentionDays?: number;
  /** Force run, ignoring interval gate (default: false). */
  force?: boolean;
};

export type ShareCleanupResult = {
  ran: boolean;
  now: string;
  lastRun?: string | null;
  intervalMs: number;
  retentionDays: number;
  cutoff: string;
  revokedExpired: number;
  revokedMissingNotes: number;
  deletedExpired: number;
  deletedRevokedNoExpiry: number;
};

const META_KEY = "share_cleanup_last";

function iso(ms: number) {
  return new Date(ms).toISOString();
}

function changes(r: any): number {
  return Number(r?.meta?.changes ?? 0);
}

async function getMeta(db: D1Database, key: string): Promise<string | null> {
  const row = await dbOne<any>(db, "SELECT value FROM app_meta WHERE key = ?", [key]);
  return row?.value ? String(row.value) : null;
}

async function setMeta(db: D1Database, key: string, value: string) {
  const t = new Date().toISOString();
  // Upsert
  await dbRun(
    db,
    `INSERT INTO app_meta (key, value, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`,
    [key, value, t]
  );
}

/**
 * Periodically revoke expired shares and delete old revoked shares.
 *
 * Why "revoked then delete":
 * - Users still get a friendly 410 (expired) for a short grace window.
 * - Database won't grow unbounded.
 */
export async function runShareCleanupMaybe(db: D1Database, opts: ShareCleanupOptions = {}): Promise<ShareCleanupResult> {
  const intervalMs = Math.max(1, opts.intervalMs ?? 6 * 60 * 60 * 1000);
  const retentionDays = Math.max(0, Math.floor(opts.retentionDays ?? 7));
  const retentionMs = retentionDays * 24 * 60 * 60 * 1000;

  const nowMs = Date.now();
  const now = iso(nowMs);
  const cutoff = iso(nowMs - retentionMs);

  // Interval gate
  let lastRun: string | null = null;
  try {
    lastRun = await getMeta(db, META_KEY);
  } catch {
    // If app_meta doesn't exist (migrations not applied yet), do nothing.
    return {
      ran: false,
      now,
      lastRun: null,
      intervalMs,
      retentionDays,
      cutoff,
      revokedExpired: 0,
      revokedMissingNotes: 0,
      deletedExpired: 0,
      deletedRevokedNoExpiry: 0,
    };
  }

  if (!opts.force && lastRun) {
    const lastMs = Date.parse(lastRun);
    if (!Number.isNaN(lastMs) && nowMs - lastMs < intervalMs) {
      return {
        ran: false,
        now,
        lastRun,
        intervalMs,
        retentionDays,
        cutoff,
        revokedExpired: 0,
        revokedMissingNotes: 0,
        deletedExpired: 0,
        deletedRevokedNoExpiry: 0,
      };
    }
  }

  // Mark as running (best-effort; no transaction).
  await setMeta(db, META_KEY, now);

  // 1) Revoke shares that expired but were never visited.
  const r1 = await dbRun(
    db,
    "UPDATE note_shares SET revoked = 1 WHERE revoked = 0 AND expires_at IS NOT NULL AND expires_at <= ?",
    [now]
  );

  // 2) Revoke shares whose note is already deleted.
  const r2 = await dbRun(
    db,
    `UPDATE note_shares
     SET revoked = 1
     WHERE revoked = 0
       AND NOT EXISTS (SELECT 1 FROM notes n WHERE n.id = note_shares.note_id)`
  );

  // 3) Delete revoked shares that are expired for longer than retentionDays.
  const d1 = await dbRun(
    db,
    "DELETE FROM note_shares WHERE revoked = 1 AND expires_at IS NOT NULL AND expires_at <= ?",
    [cutoff]
  );

  // 4) Delete revoked shares without expires_at (e.g. burn-after-read) after retentionDays.
  const d2 = await dbRun(
    db,
    "DELETE FROM note_shares WHERE revoked = 1 AND expires_at IS NULL AND created_at <= ?",
    [cutoff]
  );

  return {
    ran: true,
    now,
    lastRun,
    intervalMs,
    retentionDays,
    cutoff,
    revokedExpired: changes(r1),
    revokedMissingNotes: changes(r2),
    deletedExpired: changes(d1),
    deletedRevokedNoExpiry: changes(d2),
  };
}
