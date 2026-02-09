-- THE SWARM - Migration for existing database
-- Run this in Supabase SQL Editor
-- Date: 2026-02-09

-- ============================================
-- 1. ADD NEW COLUMNS TO AGENTS TABLE
-- ============================================

ALTER TABLE agents ADD COLUMN IF NOT EXISTS wallet_signature TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS youtube_channel_url TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS youtube_subscribers INTEGER DEFAULT 0;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS youtube_videos INTEGER DEFAULT 0;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS youtube_views BIGINT DEFAULT 0;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS youtube_verified_at TIMESTAMPTZ;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS youtube_access_token TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS youtube_refresh_token TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS trust_tier TEXT DEFAULT 'probation';
ALTER TABLE agents ADD COLUMN IF NOT EXISTS trust_score INTEGER DEFAULT 50;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS probation_ends_at TIMESTAMPTZ;

-- ============================================
-- 2. CREATE MISSIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS missions (
  id SERIAL PRIMARY KEY,
  requester_agent_id TEXT REFERENCES agents(id),
  requester_type TEXT DEFAULT 'agent',
  mission_type TEXT NOT NULL,
  target_url TEXT NOT NULL,
  target_id TEXT,
  target_name TEXT,
  target_count INTEGER DEFAULT 1,
  target_hours DECIMAL(10,2) DEFAULT 0,
  current_count INTEGER DEFAULT 0,
  current_hours DECIMAL(10,2) DEFAULT 0,
  xp_cost INTEGER DEFAULT 0,
  usd_budget DECIMAL(10,2) DEFAULT 0,
  xp_reward INTEGER DEFAULT 10,
  usd_reward DECIMAL(10,2) DEFAULT 0,
  instructions TEXT,
  status TEXT DEFAULT 'active',
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
);

-- ============================================
-- 3. CREATE CLAIMS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS claims (
  id SERIAL PRIMARY KEY,
  mission_id INTEGER REFERENCES missions(id) NOT NULL,
  agent_id TEXT REFERENCES agents(id) NOT NULL,
  status TEXT DEFAULT 'pending',
  proof_url TEXT,
  proof_data JSONB,
  submitted_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  verified_by TEXT,
  rejection_reason TEXT,
  xp_escrow INTEGER DEFAULT 0,
  xp_released INTEGER DEFAULT 0,
  usd_released DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(mission_id, agent_id)
);

-- ============================================
-- 4. CREATE AUDITS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS audits (
  id SERIAL PRIMARY KEY,
  claim_id INTEGER REFERENCES claims(id) NOT NULL,
  passed BOOLEAN,
  audit_type TEXT NOT NULL,
  check_method TEXT,
  check_data JSONB,
  notes TEXT,
  auditor_type TEXT DEFAULT 'system',
  auditor_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 5. CREATE XP_TRANSACTIONS TABLE (if not exists)
-- ============================================

CREATE TABLE IF NOT EXISTS xp_transactions (
  id SERIAL PRIMARY KEY,
  agent_id TEXT REFERENCES agents(id) NOT NULL,
  amount INTEGER NOT NULL,
  action TEXT NOT NULL,
  description TEXT,
  mission_id INTEGER REFERENCES missions(id),
  claim_id INTEGER REFERENCES claims(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 6. CREATE INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_missions_status ON missions(status);
CREATE INDEX IF NOT EXISTS idx_missions_type ON missions(mission_type);
CREATE INDEX IF NOT EXISTS idx_claims_mission ON claims(mission_id);
CREATE INDEX IF NOT EXISTS idx_claims_agent ON claims(agent_id);
CREATE INDEX IF NOT EXISTS idx_claims_status ON claims(status);
CREATE INDEX IF NOT EXISTS idx_audits_claim ON audits(claim_id);

-- ============================================
-- 7. ENABLE RLS ON NEW TABLES
-- ============================================

ALTER TABLE missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE audits ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 8. CREATE RLS POLICIES
-- ============================================

-- Missions
DROP POLICY IF EXISTS "Public read missions" ON missions;
CREATE POLICY "Public read missions" ON missions FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow inserts missions" ON missions;
CREATE POLICY "Allow inserts missions" ON missions FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow updates missions" ON missions;
CREATE POLICY "Allow updates missions" ON missions FOR UPDATE USING (true);

-- Claims
DROP POLICY IF EXISTS "Public read claims" ON claims;
CREATE POLICY "Public read claims" ON claims FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow inserts claims" ON claims;
CREATE POLICY "Allow inserts claims" ON claims FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow updates claims" ON claims;
CREATE POLICY "Allow updates claims" ON claims FOR UPDATE USING (true);

-- Audits
DROP POLICY IF EXISTS "Public read audits" ON audits;
CREATE POLICY "Public read audits" ON audits FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow inserts audits" ON audits;
CREATE POLICY "Allow inserts audits" ON audits FOR INSERT WITH CHECK (true);

-- XP Transactions (if not already set)
ALTER TABLE xp_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read xp" ON xp_transactions;
CREATE POLICY "Public read xp" ON xp_transactions FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow inserts xp" ON xp_transactions;
CREATE POLICY "Allow inserts xp" ON xp_transactions FOR INSERT WITH CHECK (true);

-- ============================================
-- 9. CREATE HELPER FUNCTIONS
-- ============================================

CREATE OR REPLACE FUNCTION get_rank_title(p_xp INTEGER) RETURNS TEXT AS $$
BEGIN
  RETURN CASE
    WHEN p_xp >= 50000 THEN 'Queen'
    WHEN p_xp >= 25000 THEN 'Hivemind'
    WHEN p_xp >= 10000 THEN 'Swarm Leader'
    WHEN p_xp >= 5000 THEN 'Elite'
    WHEN p_xp >= 2000 THEN 'Warrior'
    WHEN p_xp >= 500 THEN 'Worker'
    WHEN p_xp >= 100 THEN 'Scout'
    ELSE 'Drone'
  END;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_audit_rate(p_trust_tier TEXT) RETURNS INTEGER AS $$
BEGIN
  RETURN CASE p_trust_tier
    WHEN 'trusted' THEN 5
    WHEN 'normal' THEN 10
    WHEN 'probation' THEN 50
    WHEN 'blacklist' THEN 100
    WHEN 'banned' THEN 100
    ELSE 50
  END;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- DONE! ✅
-- ============================================
