-- Migration: Baseline capture of live-DB drift (2026-08-05)
-- ============================================================================
-- THIS IS NOT A CHANGE. It is a captured-from-live baseline.
--
-- Context: the 08-03 buzz-brief audit flagged that application code
-- references tables/columns/functions with no committed migration:
--   peer_reviews, disputes, stake_held, reviews_for/against,
--   missions.verification_method, and sweep_expired() (called by the
--   hourly Vercel cron at /api/cron/sweep, see vercel.json +
--   packages/dashboard/src/app/api/cron/sweep/route.ts).
--
-- Live-schema audit (via Supabase MCP against project mmdmqhftpesjnynyhsyv)
-- on 2026-08-05 confirmed all of the above ALREADY EXIST on the live
-- database. They were applied by hand / via MCP at some point (the
-- database's supabase_migrations.schema_migrations history table has
-- entries named "verification_engine", "deadline_sweeper", and
-- "peer_review" with no corresponding files anywhere in this repo).
--
-- This file reconstructs the exact live DDL (via information_schema,
-- pg_get_functiondef, pg_indexes, pg_constraint, pg_policies) so version
-- control matches reality going forward. Every statement is written
-- idempotently (IF NOT EXISTS / CREATE OR REPLACE) and is safe to run
-- against a database that already has these objects — running it is a
-- no-op there. Do NOT treat this as introducing new behavior.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. missions — verification engine columns (live migration: verification_engine)
-- ----------------------------------------------------------------------------
ALTER TABLE missions
  ADD COLUMN IF NOT EXISTS acceptance_criteria JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS verification_method TEXT DEFAULT 'auto';

-- ----------------------------------------------------------------------------
-- 2. claims — stake + peer-review tally columns (live migration: peer_review)
-- ----------------------------------------------------------------------------
ALTER TABLE claims
  ADD COLUMN IF NOT EXISTS stake_held INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reviews_for INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reviews_against INTEGER DEFAULT 0;

-- ----------------------------------------------------------------------------
-- 3. crew_subtasks — verification engine + stake + peer-review tally columns
--    (live migrations: verification_engine, peer_review)
-- ----------------------------------------------------------------------------
ALTER TABLE crew_subtasks
  ADD COLUMN IF NOT EXISTS acceptance_criteria JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS verification_method TEXT DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS verification_score NUMERIC,
  ADD COLUMN IF NOT EXISTS verification_notes TEXT,
  ADD COLUMN IF NOT EXISTS stake_required INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stake_held INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reviews_for INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reviews_against INTEGER DEFAULT 0;

-- ----------------------------------------------------------------------------
-- 4. disputes — dispute/appeal table (live migration: peer_review)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS disputes (
  id SERIAL PRIMARY KEY,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  raised_by TEXT NOT NULL REFERENCES agents(id),
  reason TEXT NOT NULL,
  evidence_url TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  resolution TEXT,
  resolved_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  CONSTRAINT dispute_target_chk CHECK (target_type = ANY (ARRAY['claim'::text, 'crew_subtask'::text])),
  CONSTRAINT dispute_status_chk CHECK (status = ANY (ARRAY['open'::text, 'upheld'::text, 'rejected'::text]))
);

CREATE INDEX IF NOT EXISTS idx_disputes_status ON disputes(status);
CREATE INDEX IF NOT EXISTS idx_disputes_target ON disputes(target_type, target_id);

ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'disputes' AND policyname = 'Public read disputes'
  ) THEN
    CREATE POLICY "Public read disputes" ON disputes FOR SELECT USING (true);
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 5. peer_reviews — peer-verification votes (live migration: peer_review)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS peer_reviews (
  id SERIAL PRIMARY KEY,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  reviewer_agent_id TEXT NOT NULL REFERENCES agents(id),
  vote TEXT NOT NULL,
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT review_vote_chk CHECK (vote = ANY (ARRAY['approve'::text, 'reject'::text])),
  CONSTRAINT peer_reviews_target_type_target_id_reviewer_agent_id_key UNIQUE (target_type, target_id, reviewer_agent_id)
);

CREATE INDEX IF NOT EXISTS idx_peer_reviews_reviewer ON peer_reviews(reviewer_agent_id);
CREATE INDEX IF NOT EXISTS idx_peer_reviews_target ON peer_reviews(target_type, target_id);

ALTER TABLE peer_reviews ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'peer_reviews' AND policyname = 'Public read peer_reviews'
  ) THEN
    CREATE POLICY "Public read peer_reviews" ON peer_reviews FOR SELECT USING (true);
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 6. sweep_expired() — hourly deadline sweeper (live migration: deadline_sweeper)
--    Called by vercel.json cron "/api/cron/sweep" (schedule "0 * * * *"), which
--    hits packages/dashboard/src/app/api/cron/sweep/route.ts, which does:
--      const { data, error } = await db.rpc('sweep_expired');
--    Depends on refund_crew() (already committed in CREW_ECONOMY.sql).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sweep_expired()
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_crew RECORD;
  v_crews_refunded INTEGER := 0;
  v_missions_expired INTEGER := 0;
BEGIN
  FOR v_crew IN
    SELECT id FROM crew_missions
    WHERE deadline IS NOT NULL AND deadline < NOW()
      AND status IN ('recruiting','in_progress')
  LOOP
    PERFORM refund_crew(v_crew.id, 'failed');
    v_crews_refunded := v_crews_refunded + 1;
  END LOOP;

  UPDATE missions
     SET status = 'expired'
   WHERE status = 'active'
     AND expires_at IS NOT NULL
     AND expires_at < NOW();
  GET DIAGNOSTICS v_missions_expired = ROW_COUNT;

  RETURN jsonb_build_object('ok', true, 'crews_refunded', v_crews_refunded, 'missions_expired', v_missions_expired);
END;
$function$;
