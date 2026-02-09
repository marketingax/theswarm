-- Migration: Trust System + Mission Verification
-- Run this after the initial schema

-- Add trust system columns to agents
ALTER TABLE agents 
ADD COLUMN IF NOT EXISTS trust_tier TEXT DEFAULT 'normal' CHECK (trust_tier IN ('trusted', 'normal', 'probation', 'blacklist', 'banned')),
ADD COLUMN IF NOT EXISTS fraud_flags INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS audit_rate DECIMAL(3,2) DEFAULT 0.10,
ADD COLUMN IF NOT EXISTS probation_until TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS total_claims INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS verified_claims INTEGER DEFAULT 0;

-- Missions table (what agents can do to earn XP)
CREATE TABLE IF NOT EXISTS missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('subscribe', 'watch', 'like', 'comment', 'share', 'custom')),
  title TEXT NOT NULL,
  description TEXT,
  target_url TEXT, -- YouTube channel/video URL
  target_channel_id TEXT,
  xp_reward INTEGER NOT NULL,
  stake_required INTEGER NOT NULL, -- XP to stake
  creator_id UUID REFERENCES agents(id),
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'completed', 'cancelled')),
  max_claims INTEGER DEFAULT 1, -- How many agents can claim this
  current_claims INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

-- Claims table (agents claiming they did work)
CREATE TABLE IF NOT EXISTS claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID REFERENCES missions(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected', 'auditing')),
  staked_xp INTEGER NOT NULL,
  proof_url TEXT, -- Screenshot or video proof
  proof_notes TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  verified_at TIMESTAMPTZ,
  audit_result TEXT CHECK (audit_result IN ('passed', 'failed', 'pending')),
  auditor_id UUID REFERENCES agents(id),
  audited_at TIMESTAMPTZ,
  UNIQUE(mission_id, agent_id) -- One claim per agent per mission
);

-- Audits table (verification records)
CREATE TABLE IF NOT EXISTS audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID REFERENCES claims(id) ON DELETE CASCADE,
  auditor_id UUID REFERENCES agents(id),
  verdict TEXT NOT NULL CHECK (verdict IN ('legitimate', 'fraudulent', 'inconclusive')),
  evidence_notes TEXT,
  xp_earned INTEGER DEFAULT 0, -- What auditor earned
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Function to calculate audit rate based on trust tier
CREATE OR REPLACE FUNCTION get_audit_rate(tier TEXT) RETURNS DECIMAL AS $$
BEGIN
  RETURN CASE tier
    WHEN 'trusted' THEN 0.05
    WHEN 'normal' THEN 0.10
    WHEN 'probation' THEN 0.50
    WHEN 'blacklist' THEN 1.00
    ELSE 0.10
  END;
END;
$$ LANGUAGE plpgsql;

-- Function to update trust tier based on fraud flags
CREATE OR REPLACE FUNCTION update_trust_tier(agent_uuid UUID) RETURNS VOID AS $$
DECLARE
  flags INTEGER;
  clean_claims INTEGER;
BEGIN
  SELECT fraud_flags, verified_claims INTO flags, clean_claims 
  FROM agents WHERE id = agent_uuid;
  
  UPDATE agents SET 
    trust_tier = CASE
      WHEN flags >= 3 THEN 'banned'
      WHEN flags >= 2 THEN 'blacklist'
      WHEN flags >= 1 THEN 'probation'
      WHEN clean_claims >= 50 AND flags = 0 THEN 'trusted'
      ELSE 'normal'
    END,
    audit_rate = CASE
      WHEN flags >= 3 THEN 1.00
      WHEN flags >= 2 THEN 1.00
      WHEN flags >= 1 THEN 0.50
      WHEN clean_claims >= 50 AND flags = 0 THEN 0.05
      ELSE 0.10
    END,
    probation_until = CASE
      WHEN flags = 1 AND (probation_until IS NULL OR probation_until < NOW()) 
        THEN NOW() + INTERVAL '90 days'
      ELSE probation_until
    END
  WHERE id = agent_uuid;
END;
$$ LANGUAGE plpgsql;

-- Function to check if probation has ended and restore normal status
CREATE OR REPLACE FUNCTION check_probation_status(agent_uuid UUID) RETURNS VOID AS $$
BEGIN
  UPDATE agents SET
    trust_tier = 'normal',
    audit_rate = 0.10,
    probation_until = NULL
  WHERE id = agent_uuid 
    AND trust_tier = 'probation' 
    AND probation_until IS NOT NULL 
    AND probation_until < NOW()
    AND fraud_flags = 1; -- Only if they haven't earned more flags
END;
$$ LANGUAGE plpgsql;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_claims_status ON claims(status);
CREATE INDEX IF NOT EXISTS idx_claims_agent ON claims(agent_id);
CREATE INDEX IF NOT EXISTS idx_missions_status ON missions(status);
CREATE INDEX IF NOT EXISTS idx_agents_trust ON agents(trust_tier);

-- Enable RLS
ALTER TABLE missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE audits ENABLE ROW LEVEL SECURITY;

-- Policies (allow all for now, tighten later)
CREATE POLICY "Allow all missions" ON missions FOR ALL USING (true);
CREATE POLICY "Allow all claims" ON claims FOR ALL USING (true);
CREATE POLICY "Allow all audits" ON audits FOR ALL USING (true);

-- Comments for documentation
COMMENT ON TABLE missions IS 'Work that agents can do to earn XP';
COMMENT ON TABLE claims IS 'Agent claims that they completed a mission';
COMMENT ON TABLE audits IS 'Verification records for claims';
COMMENT ON COLUMN agents.trust_tier IS 'trusted (5%), normal (10%), probation (50%), blacklist (100%), banned';
COMMENT ON COLUMN agents.probation_until IS '90 days from first fraud flag';
