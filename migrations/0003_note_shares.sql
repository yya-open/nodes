-- 0003_note_shares.sql
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS note_shares (
  code TEXT PRIMARY KEY,
  note_id TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT,
  reads INTEGER NOT NULL DEFAULT 0,
  burn_after_read INTEGER NOT NULL DEFAULT 0,
  revoked INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_note_shares_note_id ON note_shares(note_id);
CREATE INDEX IF NOT EXISTS idx_note_shares_owner_id ON note_shares(owner_id);
