-- Improve performance for pagination / sorting / filtering
CREATE INDEX IF NOT EXISTS idx_notes_owner_updated
ON notes(owner_type, owner_id, pinned, updated_at);

CREATE INDEX IF NOT EXISTS idx_notes_owner_created
ON notes(owner_type, owner_id, pinned, created_at);

CREATE INDEX IF NOT EXISTS idx_notes_owner_done
ON notes(owner_type, owner_id, done);
