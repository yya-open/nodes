-- 0002_guest_transfer.sql
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS guest_transfer_codes (
  code TEXT PRIMARY KEY,
  guest_sub TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_guest_transfer_expires ON guest_transfer_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_guest_transfer_guest ON guest_transfer_codes(guest_sub);
