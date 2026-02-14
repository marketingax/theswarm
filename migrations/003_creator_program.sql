-- Migration: Creator Program
-- Enables creators to post missions and earn revenue share

-- Add creator columns to agents table
ALTER TABLE agents
ADD COLUMN IF NOT EXISTS is_creator BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS creator_category TEXT CHECK (creator_category IN ('youtube', 'twitch', 'podcast', 'newsletter', 'tiktok', 'instagram', 'other')),
ADD COLUMN IF NOT EXISTS creator_revenue_share DECIMAL(3,2) DEFAULT 0.15,
ADD COLUMN IF NOT EXISTS creator_follower_count INTEGER DEFAULT 0;

-- Create creators table for application management
CREATE TABLE IF NOT EXISTS creators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL UNIQUE REFERENCES agents(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'active', 'suspended', 'rejected')),
  category TEXT NOT NULL CHECK (category IN ('youtube', 'twitch', 'podcast', 'newsletter', 'tiktok', 'instagram', 'other')),
  follower_count INTEGER NOT NULL,
  revenue_share DECIMAL(3,2) NOT NULL DEFAULT 0.15,
  social_proof_url TEXT,
  social_handle TEXT,
  onboarded_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES agents(id),
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create creator_earnings table to track payouts
CREATE TABLE IF NOT EXISTS creator_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  mission_id UUID REFERENCES missions(id) ON DELETE SET NULL,
  earnings_type TEXT NOT NULL CHECK (earnings_type IN ('mission_post', 'per_completion', 'bonus')),
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  payment_tx_hash TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'processing')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Update missions table to support creator-specific fields
ALTER TABLE missions
ADD COLUMN IF NOT EXISTS creator_id UUID REFERENCES creators(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS usd_budget DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS per_completion DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS payment_type TEXT CHECK (payment_type IN ('upfront', 'per_claim', 'mixed'));

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_creators_status ON creators(status);
CREATE INDEX IF NOT EXISTS idx_creators_agent ON creators(agent_id);
CREATE INDEX IF NOT EXISTS idx_creators_category ON creators(category);
CREATE INDEX IF NOT EXISTS idx_creator_earnings_agent ON creator_earnings(agent_id);
CREATE INDEX IF NOT EXISTS idx_creator_earnings_creator ON creator_earnings(creator_id);
CREATE INDEX IF NOT EXISTS idx_creator_earnings_status ON creator_earnings(status);
CREATE INDEX IF NOT EXISTS idx_missions_creator ON missions(creator_id);

-- Enable RLS
ALTER TABLE creators ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_earnings ENABLE ROW LEVEL SECURITY;

-- Policies (allow all for now, tighten later)
CREATE POLICY "Allow all creators" ON creators FOR ALL USING (true);
CREATE POLICY "Allow all creator_earnings" ON creator_earnings FOR ALL USING (true);

-- Function to calculate revenue share based on follower count
CREATE OR REPLACE FUNCTION calculate_revenue_share(followers INTEGER) RETURNS DECIMAL AS $$
BEGIN
  RETURN CASE
    WHEN followers >= 100000 THEN 0.25
    WHEN followers >= 50000 THEN 0.22
    WHEN followers >= 20000 THEN 0.20
    WHEN followers >= 10000 THEN 0.18
    WHEN followers >= 5000 THEN 0.16
    ELSE 0.15
  END;
END;
$$ LANGUAGE plpgsql;

-- Function to approve creator and set revenue share
CREATE OR REPLACE FUNCTION approve_creator(
  creator_id_param UUID, 
  approved_by_uuid UUID,
  follower_count_override INTEGER DEFAULT NULL
) RETURNS void AS $$
DECLARE
  follower_count_val INTEGER;
  revenue_share_val DECIMAL(3,2);
BEGIN
  -- Get follower count from creators table if not overridden
  SELECT follower_count INTO follower_count_val 
  FROM creators 
  WHERE id = creator_id_param;
  
  IF follower_count_override IS NOT NULL THEN
    follower_count_val := follower_count_override;
  END IF;
  
  -- Calculate revenue share
  revenue_share_val := calculate_revenue_share(follower_count_val);
  
  -- Update creators table
  UPDATE creators 
  SET 
    status = 'active',
    approved_at = NOW(),
    approved_by = approved_by_uuid,
    revenue_share = revenue_share_val,
    updated_at = NOW()
  WHERE id = creator_id_param;
  
  -- Update agents table
  UPDATE agents 
  SET 
    is_creator = true,
    creator_revenue_share = revenue_share_val,
    creator_follower_count = follower_count_val,
    creator_category = (SELECT category FROM creators WHERE id = creator_id_param)
  WHERE id = (SELECT agent_id FROM creators WHERE id = creator_id_param);
END;
$$ LANGUAGE plpgsql;

-- Function to log creator earnings
CREATE OR REPLACE FUNCTION log_creator_earnings(
  creator_id_param UUID,
  agent_id_param UUID,
  mission_id_param UUID,
  amount_param DECIMAL,
  earnings_type_param TEXT
) RETURNS UUID AS $$
DECLARE
  earning_id UUID;
BEGIN
  INSERT INTO creator_earnings (
    creator_id,
    agent_id,
    mission_id,
    amount,
    earnings_type
  ) VALUES (
    creator_id_param,
    agent_id_param,
    mission_id_param,
    amount_param,
    earnings_type_param
  ) RETURNING id INTO earning_id;
  
  RETURN earning_id;
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE creators IS 'Creator program applications and status';
COMMENT ON TABLE creator_earnings IS 'Track earnings for creators per mission';
COMMENT ON COLUMN creators.status IS 'pending, approved, active, suspended, rejected';
COMMENT ON COLUMN creators.revenue_share IS 'Percentage (10%-25%) creator earns from missions (scale 0.10-0.25)';
COMMENT ON COLUMN creator_earnings.earnings_type IS 'mission_post (upfront), per_completion (per claim), or bonus';
COMMENT ON FUNCTION calculate_revenue_share IS 'Calculates revenue share 10%-25% based on follower count';
