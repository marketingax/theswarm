-- Migration 004: Trust change audit log + admin flag
-- Backs the security fix for /api/admin/trust/change, which previously had
-- no authentication and no audit trail.
-- Run this in Supabase SQL Editor.

-- Admin flag used by the API layer's admin-role checks (creators/* routes
-- already query it; this makes it official in the schema).
ALTER TABLE agents ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- Audit log: one row per trust tier change — who, what, why, when.
CREATE TABLE IF NOT EXISTS trust_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  changed_by TEXT NOT NULL REFERENCES agents(id),
  old_tier TEXT NOT NULL,
  new_tier TEXT NOT NULL CHECK (new_tier IN ('trusted', 'normal', 'probation', 'blacklist', 'banned')),
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trust_history_agent ON trust_history(agent_id);
CREATE INDEX IF NOT EXISTS idx_trust_history_created ON trust_history(created_at DESC);

-- RLS on with no policies: only the service-role key (used by the API) can
-- read or write; anon/authenticated Supabase clients get nothing.
ALTER TABLE trust_history ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE trust_history IS 'Audit log of every trust tier change (actor, old tier, new tier, reason, timestamp)';
