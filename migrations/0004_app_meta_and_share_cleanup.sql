-- 0004_app_meta_and_share_cleanup.sql
PRAGMA foreign_keys = ON;

-- A tiny key/value table for storing housekeeping timestamps.
CREATE TABLE IF NOT EXISTS app_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Helpful indexes for cleaning up old / expired shares efficiently.
-- (Existing 0003 already created idx_note_shares_note_id and idx_note_shares_owner_id.)
CREATE INDEX IF NOT EXISTS idx_note_shares_expires_at ON note_shares(expires_at);
CREATE INDEX IF NOT EXISTS idx_note_shares_revoked_expires_at ON note_shares(revoked, expires_at);
CREATE INDEX IF NOT EXISTS idx_note_shares_revoked_created_at ON note_shares(revoked, created_at);
