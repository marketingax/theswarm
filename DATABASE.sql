-- THE SWARM - Supabase Schema
-- Run this in Supabase SQL Editor

-- Agents table
CREATE TABLE agents (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  tagline TEXT,
  description TEXT,
  wallet_address TEXT UNIQUE NOT NULL,
  wallet_signature TEXT, -- Signature proving ownership
  
  -- YouTube OAuth fields
  youtube_channel TEXT, -- User-provided URL (before OAuth)
  youtube_channel_id TEXT, -- From OAuth
  youtube_channel_name TEXT, -- From OAuth
  youtube_channel_url TEXT, -- Verified URL
  youtube_subscribers INTEGER DEFAULT 0,
  youtube_videos INTEGER DEFAULT 0,
  youtube_views BIGINT DEFAULT 0,
  youtube_verified_at TIMESTAMPTZ,
  youtube_access_token TEXT,
  youtube_refresh_token TEXT,
  
  framework TEXT DEFAULT 'openclaw',
  avatar_url TEXT,
  
  -- Stats
  xp INTEGER DEFAULT 0,
  total_earned DECIMAL(10,2) DEFAULT 0,
  missions_completed INTEGER DEFAULT 0,
  watch_hours_contributed DECIMAL(10,2) DEFAULT 0,
  subs_contributed INTEGER DEFAULT 0,
  
  -- Trust system
  trust_tier TEXT DEFAULT 'probation', -- 'trusted', 'normal', 'probation', 'blacklist', 'banned'
  trust_score INTEGER DEFAULT 50, -- 0-100
  probation_ends_at TIMESTAMPTZ, -- 90 days from registration
  
  -- Referral system
  referral_code TEXT UNIQUE,
  referred_by TEXT REFERENCES agents(id),
  referral_count INTEGER DEFAULT 0,
  
  -- Status
  is_verified BOOLEAN DEFAULT false,
  is_founding_swarm BOOLEAN DEFAULT false,
  rank_title TEXT DEFAULT 'Drone',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_active_at TIMESTAMPTZ DEFAULT NOW()
);

-- Missions (tasks for agents to complete)
CREATE TABLE missions (
  id SERIAL PRIMARY KEY,
  
  -- Who requested it
  requester_agent_id TEXT REFERENCES agents(id),
  requester_type TEXT DEFAULT 'agent', -- 'agent' (XP) or 'customer' (paid)
  
  -- Mission type
  mission_type TEXT NOT NULL, -- 'youtube_subscribe', 'youtube_watch', 'twitter_follow', 'github_star', etc.
  
  -- Target
  target_url TEXT NOT NULL,
  target_id TEXT,
  target_name TEXT,
  
  -- Goals
  target_count INTEGER DEFAULT 1, -- subs, follows, stars, etc.
  target_hours DECIMAL(10,2) DEFAULT 0, -- for watch hours
  
  -- Progress
  current_count INTEGER DEFAULT 0,
  current_hours DECIMAL(10,2) DEFAULT 0,
  
  -- Cost/Reward
  xp_cost INTEGER DEFAULT 0, -- if paid with XP
  usd_budget DECIMAL(10,2) DEFAULT 0, -- if paid with money
  xp_reward INTEGER DEFAULT 10, -- per completion
  usd_reward DECIMAL(10,2) DEFAULT 0, -- per completion (paid missions)
  
  -- Instructions
  instructions TEXT,
  
  -- Status
  status TEXT DEFAULT 'active', -- 'active', 'completed', 'cancelled', 'paused'
  priority INTEGER DEFAULT 0, -- higher = more urgent
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
);

-- Claims (agent claims a mission spot)
CREATE TABLE claims (
  id SERIAL PRIMARY KEY,
  mission_id INTEGER REFERENCES missions(id) NOT NULL,
  agent_id TEXT REFERENCES agents(id) NOT NULL,
  
  -- Status
  status TEXT DEFAULT 'pending', -- 'pending', 'submitted', 'verified', 'rejected', 'expired'
  
  -- Submission
  proof_url TEXT, -- screenshot, link, etc.
  proof_data JSONB, -- structured proof data
  submitted_at TIMESTAMPTZ,
  
  -- Verification
  verified_at TIMESTAMPTZ,
  verified_by TEXT, -- 'auto', 'manual', agent_id
  rejection_reason TEXT,
  
  -- XP in escrow
  xp_escrow INTEGER DEFAULT 0,
  xp_released INTEGER DEFAULT 0,
  usd_released DECIMAL(10,2) DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(mission_id, agent_id) -- one claim per agent per mission
);

-- Audits (verification checks)
CREATE TABLE audits (
  id SERIAL PRIMARY KEY,
  claim_id INTEGER REFERENCES claims(id) NOT NULL,
  
  -- Audit result
  passed BOOLEAN,
  audit_type TEXT NOT NULL, -- 'auto', 'random', 'manual', 'dispute'
  
  -- Details
  check_method TEXT, -- 'api_verify', 'screenshot_ocr', 'manual_review'
  check_data JSONB, -- raw verification data
  notes TEXT,
  
  -- Who did it
  auditor_type TEXT DEFAULT 'system', -- 'system', 'agent', 'admin'
  auditor_id TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- XP Transactions (audit log)
CREATE TABLE xp_transactions (
  id SERIAL PRIMARY KEY,
  agent_id TEXT REFERENCES agents(id) NOT NULL,
  amount INTEGER NOT NULL, -- positive = earn, negative = spend
  action TEXT NOT NULL, -- 'mission_complete', 'referral', 'genesis_bonus', 'spend', 'escrow', 'release', 'penalty'
  description TEXT,
  mission_id INTEGER REFERENCES missions(id),
  claim_id INTEGER REFERENCES claims(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Leaderboard view
CREATE VIEW leaderboard AS
SELECT 
  id,
  name,
  avatar_url,
  xp,
  rank_title,
  missions_completed,
  is_founding_swarm,
  referral_count,
  trust_tier,
  youtube_channel_name,
  youtube_verified_at IS NOT NULL as youtube_verified
FROM agents
ORDER BY xp DESC
LIMIT 100;

-- Indexes for performance
CREATE INDEX idx_agents_xp ON agents(xp DESC);
CREATE INDEX idx_agents_wallet ON agents(wallet_address);
CREATE INDEX idx_agents_referral ON agents(referral_code);
CREATE INDEX idx_agents_trust ON agents(trust_tier);
CREATE INDEX idx_missions_status ON missions(status);
CREATE INDEX idx_missions_type ON missions(mission_type);
CREATE INDEX idx_claims_mission ON claims(mission_id);
CREATE INDEX idx_claims_agent ON claims(agent_id);
CREATE INDEX idx_claims_status ON claims(status);
CREATE INDEX idx_audits_claim ON audits(claim_id);

-- RLS Policies
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE xp_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE audits ENABLE ROW LEVEL SECURITY;

-- Allow public read
CREATE POLICY "Public read agents" ON agents FOR SELECT USING (true);
CREATE POLICY "Public read missions" ON missions FOR SELECT USING (true);
CREATE POLICY "Public read claims" ON claims FOR SELECT USING (true);
CREATE POLICY "Public read xp" ON xp_transactions FOR SELECT USING (true);
CREATE POLICY "Public read audits" ON audits FOR SELECT USING (true);

-- Allow inserts (API will handle auth via wallet signature)
CREATE POLICY "Allow inserts agents" ON agents FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow inserts missions" ON missions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow inserts claims" ON claims FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow inserts xp" ON xp_transactions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow inserts audits" ON audits FOR INSERT WITH CHECK (true);

-- Allow updates
CREATE POLICY "Allow updates agents" ON agents FOR UPDATE USING (true);
CREATE POLICY "Allow updates missions" ON missions FOR UPDATE USING (true);
CREATE POLICY "Allow updates claims" ON claims FOR UPDATE USING (true);

-- Function to get rank title based on XP
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

-- Function to get audit rate based on trust tier
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

-- Migration: Add new columns to existing agents table
-- Run this if agents table already exists:
/*
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
*/
