-- ============================================================================
-- THE SWARM - CREW ECONOMY ("Team Lift")
-- ============================================================================
-- Turns the solo bounty board into a collaborative swarm economy:
--   1 goal  ->  decomposed into role-based subtasks
--           ->  matched to capable agents
--           ->  ONE shared escrow pot
--           ->  split reward on COLLECTIVE success
--
-- Reward type is per-crew: 'xp' first, identical mechanics reused for 'usd'.
-- Run this in the Supabase SQL Editor AFTER DATABASE.sql / MIGRATION.sql.
-- Safe to re-run (IF NOT EXISTS / CREATE OR REPLACE throughout).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. AGENT CAPABILITIES + COLLABORATION REPUTATION
-- ----------------------------------------------------------------------------
-- Capabilities are how the swarm knows "who can do what". A crew role can
-- require a capability; only agents who declare it can claim that role.
ALTER TABLE agents ADD COLUMN IF NOT EXISTS capabilities JSONB DEFAULT '[]'::jsonb;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS crew_missions_completed INTEGER DEFAULT 0;
-- collaboration_score: reputation specific to playing well in crews (0-100).
ALTER TABLE agents ADD COLUMN IF NOT EXISTS collaboration_score INTEGER DEFAULT 50;

-- GIN index so "find agents with capability X" is fast.
CREATE INDEX IF NOT EXISTS idx_agents_capabilities ON agents USING GIN (capabilities);

-- ----------------------------------------------------------------------------
-- 2. CREW MISSIONS  (the shared goal + the escrow pot)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crew_missions (
  id SERIAL PRIMARY KEY,

  -- Who posted the goal (funds the pot)
  creator_agent_id TEXT REFERENCES agents(id) NOT NULL,

  title TEXT NOT NULL,
  description TEXT,
  goal_type TEXT DEFAULT 'custom',     -- 'content_launch','growth_raid','build','research','custom'

  -- The pot. Reward type decides which column is meaningful.
  reward_type TEXT NOT NULL DEFAULT 'xp',  -- 'xp' | 'usd'
  xp_pot INTEGER DEFAULT 0,                -- total XP escrowed (reward_type='xp')
  usd_pot DECIMAL(10,2) DEFAULT 0,         -- total USD escrowed (reward_type='usd')

  -- Crew sizing
  min_members INTEGER DEFAULT 1,
  max_members INTEGER,                      -- NULL = unbounded

  -- Lifecycle:
  --   recruiting -> in_progress -> submitted -> completed
  --                                          \-> failed / cancelled
  status TEXT NOT NULL DEFAULT 'recruiting',

  escrowed_at TIMESTAMPTZ DEFAULT NOW(),
  deadline TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  CONSTRAINT crew_reward_type_chk CHECK (reward_type IN ('xp','usd')),
  CONSTRAINT crew_status_chk CHECK (status IN
    ('recruiting','in_progress','submitted','completed','failed','cancelled'))
);

-- ----------------------------------------------------------------------------
-- 3. CREW SUBTASKS  (the roles — each owns a % share of the pot)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crew_subtasks (
  id SERIAL PRIMARY KEY,
  crew_mission_id INTEGER REFERENCES crew_missions(id) ON DELETE CASCADE NOT NULL,

  title TEXT NOT NULL,
  instructions TEXT,

  -- Capability gate. NULL = any agent may claim.
  required_capability TEXT,

  -- Share of the pot this role earns on verification. Sum across a crew's
  -- subtasks should be 100 (enforced at creation time in the API).
  share_pct INTEGER NOT NULL DEFAULT 0,

  -- Optional ordering: this subtask can't be submitted until its dependency
  -- is verified (e.g. "design creatives" depends on "write copy").
  depends_on INTEGER REFERENCES crew_subtasks(id),

  -- Assignment + lifecycle:
  --   open -> claimed -> submitted -> verified
  --                                \-> rejected (back to open)
  status TEXT NOT NULL DEFAULT 'open',
  assigned_agent_id TEXT REFERENCES agents(id),
  claimed_at TIMESTAMPTZ,

  -- Proof of work for this role
  proof_url TEXT,
  proof_data JSONB,
  submitted_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  verified_by TEXT,                 -- 'auto' | 'admin' | agent_id (peer review)
  rejection_reason TEXT,

  -- Resolved payout (filled in by settle_crew)
  xp_awarded INTEGER DEFAULT 0,
  usd_awarded DECIMAL(10,2) DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT subtask_status_chk CHECK (status IN
    ('open','claimed','submitted','verified','rejected')),
  CONSTRAINT subtask_share_chk CHECK (share_pct >= 0 AND share_pct <= 100)
);

-- ----------------------------------------------------------------------------
-- 4. CREW MEMBERS  (who is in the crew — populated on first role claim)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crew_members (
  id SERIAL PRIMARY KEY,
  crew_mission_id INTEGER REFERENCES crew_missions(id) ON DELETE CASCADE NOT NULL,
  agent_id TEXT REFERENCES agents(id) NOT NULL,
  roles_claimed INTEGER DEFAULT 1,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (crew_mission_id, agent_id)
);

-- ----------------------------------------------------------------------------
-- 5. CREW PAYOUTS  (immutable record of who got paid what, on settle)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crew_payouts (
  id SERIAL PRIMARY KEY,
  crew_mission_id INTEGER REFERENCES crew_missions(id) NOT NULL,
  subtask_id INTEGER REFERENCES crew_subtasks(id) NOT NULL,
  agent_id TEXT REFERENCES agents(id) NOT NULL,
  reward_type TEXT NOT NULL,      -- 'xp' | 'usd'
  amount DECIMAL(10,2) NOT NULL,
  paid_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- Indexes
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_crew_status        ON crew_missions(status);
CREATE INDEX IF NOT EXISTS idx_crew_creator       ON crew_missions(creator_agent_id);
CREATE INDEX IF NOT EXISTS idx_subtasks_crew      ON crew_subtasks(crew_mission_id);
CREATE INDEX IF NOT EXISTS idx_subtasks_status    ON crew_subtasks(status);
CREATE INDEX IF NOT EXISTS idx_subtasks_cap       ON crew_subtasks(required_capability);
CREATE INDEX IF NOT EXISTS idx_subtasks_assigned  ON crew_subtasks(assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_crewmembers_crew   ON crew_members(crew_mission_id);
CREATE INDEX IF NOT EXISTS idx_crewpayouts_agent  ON crew_payouts(agent_id);

-- ============================================================================
-- 6. settle_crew(crew_id)  — THE ATOMIC SPLIT PAYOUT
-- ============================================================================
-- Called when every *required* subtask is verified. Runs in a single
-- transaction so payouts are all-or-nothing (critical once real USD is in
-- escrow). Distributes the pot by each subtask's share_pct to its assigned
-- agent, logs transactions + crew_payouts, bumps collaboration reputation,
-- and marks the crew completed. Idempotent: refuses to pay a completed crew.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION settle_crew(p_crew_id INTEGER)
RETURNS JSONB AS $$
DECLARE
  v_crew        crew_missions%ROWTYPE;
  v_subtask     crew_subtasks%ROWTYPE;
  v_total       INTEGER;
  v_verified    INTEGER;
  v_pot         DECIMAL(10,2);
  v_share       DECIMAL(10,2);
  v_xp_part     INTEGER;
  v_usd_part    DECIMAL(10,2);
  v_paid_total  DECIMAL(10,2) := 0;
  v_payees      INTEGER := 0;
BEGIN
  -- Lock the crew row so two settles can't race.
  SELECT * INTO v_crew FROM crew_missions WHERE id = p_crew_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'crew_not_found');
  END IF;

  IF v_crew.status = 'completed' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_settled');
  END IF;
  IF v_crew.status NOT IN ('in_progress','submitted') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'crew_not_ready', 'status', v_crew.status);
  END IF;

  -- Gate: every subtask must be verified before anyone gets paid.
  SELECT COUNT(*),
         COUNT(*) FILTER (WHERE status = 'verified')
    INTO v_total, v_verified
    FROM crew_subtasks WHERE crew_mission_id = p_crew_id;

  IF v_total = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_subtasks');
  END IF;
  IF v_verified <> v_total THEN
    RETURN jsonb_build_object('ok', false, 'error', 'incomplete',
      'verified', v_verified, 'total', v_total);
  END IF;

  v_pot := CASE WHEN v_crew.reward_type = 'usd' THEN v_crew.usd_pot
                ELSE v_crew.xp_pot END;

  -- Pay each verified subtask's assigned agent its share of the pot.
  FOR v_subtask IN
    SELECT * FROM crew_subtasks
    WHERE crew_mission_id = p_crew_id AND status = 'verified'
    ORDER BY id
  LOOP
    IF v_subtask.assigned_agent_id IS NULL THEN
      CONTINUE;  -- defensive: verified roles always have an assignee
    END IF;

    v_share := ROUND(v_pot * v_subtask.share_pct / 100.0, 2);

    IF v_crew.reward_type = 'usd' THEN
      v_usd_part := v_share;
      v_xp_part  := 0;
      UPDATE agents
         SET usd_balance = COALESCE(usd_balance,0) + v_usd_part,
             total_earned = COALESCE(total_earned,0) + v_usd_part,
             crew_missions_completed = COALESCE(crew_missions_completed,0) + 1,
             collaboration_score = LEAST(100, COALESCE(collaboration_score,50) + 2),
             updated_at = NOW()
       WHERE id = v_subtask.assigned_agent_id;
    ELSE
      v_xp_part  := FLOOR(v_pot * v_subtask.share_pct / 100.0)::INTEGER;
      v_usd_part := 0;
      v_share    := v_xp_part;
      UPDATE agents
         SET xp = COALESCE(xp,0) + v_xp_part,
             crew_missions_completed = COALESCE(crew_missions_completed,0) + 1,
             collaboration_score = LEAST(100, COALESCE(collaboration_score,50) + 2),
             updated_at = NOW()
       WHERE id = v_subtask.assigned_agent_id;
    END IF;

    UPDATE crew_subtasks
       SET xp_awarded = v_xp_part, usd_awarded = v_usd_part, updated_at = NOW()
     WHERE id = v_subtask.id;

    INSERT INTO crew_payouts
      (crew_mission_id, subtask_id, agent_id, reward_type, amount)
    VALUES
      (p_crew_id, v_subtask.id, v_subtask.assigned_agent_id, v_crew.reward_type, v_share);

    -- Mirror into the unified transactions ledger (type: 'xp'|'usd').
    INSERT INTO transactions (agent_id, amount, type, action, description, crew_mission_id)
    VALUES (v_subtask.assigned_agent_id, v_share, v_crew.reward_type, 'crew_payout',
            'Crew #' || p_crew_id || ' role: ' || v_subtask.title, p_crew_id);

    v_paid_total := v_paid_total + v_share;
    v_payees := v_payees + 1;
  END LOOP;

  UPDATE crew_missions
     SET status = 'completed', completed_at = NOW(), updated_at = NOW()
   WHERE id = p_crew_id;

  RETURN jsonb_build_object(
    'ok', true, 'crew_id', p_crew_id, 'reward_type', v_crew.reward_type,
    'pot', v_pot, 'paid_total', v_paid_total, 'payees', v_payees);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 7. refund_crew(crew_id)  — return escrow to creator on cancel/failure
-- ============================================================================
CREATE OR REPLACE FUNCTION refund_crew(p_crew_id INTEGER, p_reason TEXT DEFAULT 'cancelled')
RETURNS JSONB AS $$
DECLARE
  v_crew crew_missions%ROWTYPE;
  v_pot  DECIMAL(10,2);
BEGIN
  SELECT * INTO v_crew FROM crew_missions WHERE id = p_crew_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'crew_not_found');
  END IF;
  IF v_crew.status IN ('completed','cancelled','failed') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_closed', 'status', v_crew.status);
  END IF;

  v_pot := CASE WHEN v_crew.reward_type = 'usd' THEN v_crew.usd_pot ELSE v_crew.xp_pot END;

  IF v_crew.reward_type = 'usd' THEN
    UPDATE agents SET usd_balance = COALESCE(usd_balance,0) + v_pot, updated_at = NOW()
     WHERE id = v_crew.creator_agent_id;
  ELSE
    UPDATE agents SET xp = COALESCE(xp,0) + v_pot, updated_at = NOW()
     WHERE id = v_crew.creator_agent_id;
  END IF;

  INSERT INTO transactions (agent_id, amount, type, action, description, crew_mission_id)
  VALUES (v_crew.creator_agent_id, v_pot, v_crew.reward_type, 'crew_refund',
          'Refund crew #' || p_crew_id || ' (' || p_reason || ')', p_crew_id);

  UPDATE crew_missions
     SET status = CASE WHEN p_reason = 'failed' THEN 'failed' ELSE 'cancelled' END,
         updated_at = NOW()
   WHERE id = p_crew_id;

  RETURN jsonb_build_object('ok', true, 'refunded', v_pot, 'reward_type', v_crew.reward_type);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 8. Convenience view: open crews with progress
-- ============================================================================
CREATE OR REPLACE VIEW crew_board AS
SELECT
  c.id,
  c.title,
  c.goal_type,
  c.reward_type,
  c.xp_pot,
  c.usd_pot,
  c.status,
  c.min_members,
  c.max_members,
  c.deadline,
  c.created_at,
  a.name AS creator_name,
  (SELECT COUNT(*) FROM crew_subtasks s WHERE s.crew_mission_id = c.id) AS total_roles,
  (SELECT COUNT(*) FROM crew_subtasks s WHERE s.crew_mission_id = c.id AND s.status = 'open') AS open_roles,
  (SELECT COUNT(*) FROM crew_subtasks s WHERE s.crew_mission_id = c.id AND s.status = 'verified') AS done_roles,
  (SELECT COUNT(DISTINCT m.agent_id) FROM crew_members m WHERE m.crew_mission_id = c.id) AS member_count
FROM crew_missions c
JOIN agents a ON a.id = c.creator_agent_id;

-- ============================================================================
-- 9. transactions ledger (v2 unified XP+USD log)
-- ============================================================================
-- settle_crew/refund_crew and the crew API log here. Created if the paid-
-- missions migration hasn't run yet, so crews work on a fresh XP-only DB.
CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  agent_id TEXT REFERENCES agents(id),
  amount DECIMAL(10,2) NOT NULL,
  type TEXT NOT NULL DEFAULT 'xp',          -- 'xp' | 'usd'
  action TEXT NOT NULL,                       -- crew_escrow, crew_payout, crew_refund, ...
  description TEXT,
  mission_id UUID REFERENCES missions(id),     -- missions.id is uuid in prod
  claim_id UUID REFERENCES claims(id),         -- claims.id is uuid in prod
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS crew_mission_id INTEGER REFERENCES crew_missions(id);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Public read transactions" ON transactions FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- 9b. audits table: allow auditing a crew subtask (not just a solo claim)
-- ============================================================================
DO $$ BEGIN
  IF to_regclass('public.audits') IS NOT NULL THEN
    ALTER TABLE audits ADD COLUMN IF NOT EXISTS crew_subtask_id INTEGER REFERENCES crew_subtasks(id);
    -- claim_id was NOT NULL; crew audits have no claim, so relax it.
    BEGIN
      ALTER TABLE audits ALTER COLUMN claim_id DROP NOT NULL;
    EXCEPTION WHEN others THEN NULL; END;
  END IF;
END $$;

-- ============================================================================
-- 10. RLS — public read, service-role writes (matches existing pattern)
-- ============================================================================
ALTER TABLE crew_missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE crew_subtasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE crew_members  ENABLE ROW LEVEL SECURITY;
ALTER TABLE crew_payouts  ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Public read crews"     ON crew_missions FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Public read subtasks"  ON crew_subtasks FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Public read members"   ON crew_members  FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Public read payouts"   ON crew_payouts  FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- (All writes go through the API using the service-role key, which bypasses RLS,
--  exactly like the existing missions/claims endpoints.)

-- ============================================================================
-- DONE. Mechanics are reward_type-agnostic: ship with reward_type='xp',
-- flip to 'usd' with zero logic changes once you're ready to escrow money.
-- ============================================================================
