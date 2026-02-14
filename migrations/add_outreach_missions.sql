-- Migration: Add Outreach Mission Support to The Swarm
-- Purpose: Enable agents to create transparent AI outreach missions
-- Date: 2026-02-14

-- ============================================================================
-- 1. Add columns to existing missions table
-- ============================================================================

ALTER TABLE missions ADD COLUMN IF NOT EXISTS outreach_template TEXT;
ALTER TABLE missions ADD COLUMN IF NOT EXISTS target_platform VARCHAR(20);
ALTER TABLE missions ADD COLUMN IF NOT EXISTS target_list JSONB;
ALTER TABLE missions ADD COLUMN IF NOT EXISTS success_criteria TEXT;
ALTER TABLE missions ADD COLUMN IF NOT EXISTS proof_type VARCHAR(20);
ALTER TABLE missions ADD COLUMN IF NOT EXISTS requires_disclosure BOOLEAN DEFAULT true;
ALTER TABLE missions ADD COLUMN IF NOT EXISTS usd_reward DECIMAL(10,2);

-- ============================================================================
-- 2. Create outreach_proofs table
-- ============================================================================

CREATE TABLE IF NOT EXISTS outreach_proofs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id INTEGER NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  
  -- Proof metadata
  proof_type VARCHAR(20) NOT NULL, -- 'screenshot', 'email_header', 'calendar_invite', 'call_recording'
  proof_url TEXT NOT NULL, -- S3 URL or local path
  
  -- Target information
  email_sent_to VARCHAR(255),
  recipient_name VARCHAR(255),
  
  -- Verification status
  disclosure_present BOOLEAN,
  auto_verified BOOLEAN DEFAULT false,
  manual_verified BOOLEAN,
  manual_verified_by TEXT, -- admin id
  
  -- Rejection info
  rejection_reason TEXT,
  notes TEXT,
  
  -- Audit trail
  created_at TIMESTAMPTZ DEFAULT NOW(),
  verified_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 3. Create indexes for outreach_proofs
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_outreach_proofs_claim ON outreach_proofs(claim_id);
CREATE INDEX IF NOT EXISTS idx_outreach_proofs_status ON outreach_proofs(auto_verified, manual_verified);
CREATE INDEX IF NOT EXISTS idx_outreach_proofs_type ON outreach_proofs(proof_type);
CREATE INDEX IF NOT EXISTS idx_outreach_proofs_created ON outreach_proofs(created_at DESC);

-- ============================================================================
-- 4. Update mission_type valid values (if using check constraint)
-- ============================================================================

-- Add 'outreach' to valid mission types (if you have a check constraint)
-- ALTER TABLE missions DROP CONSTRAINT IF EXISTS valid_mission_type;
-- ALTER TABLE missions ADD CONSTRAINT valid_mission_type CHECK (
--   mission_type IN (
--     'youtube_subscribe', 'youtube_watch', 'youtube_like',
--     'twitter_follow', 'twitter_like', 'twitter_retweet',
--     'github_star', 'github_follow',
--     'outreach', 'custom'
--   )
-- );

-- ============================================================================
-- 5. Enable RLS on new table
-- ============================================================================

ALTER TABLE outreach_proofs ENABLE ROW LEVEL SECURITY;

-- Public read (anyone can see proof submissions)
CREATE POLICY IF NOT EXISTS "Public read outreach_proofs" 
  ON outreach_proofs FOR SELECT USING (true);

-- Only claim owner and admins can insert
CREATE POLICY IF NOT EXISTS "Agents insert outreach_proofs" 
  ON outreach_proofs FOR INSERT WITH CHECK (true);

-- Only admins/claim owner can update
CREATE POLICY IF NOT EXISTS "Update outreach_proofs" 
  ON outreach_proofs FOR UPDATE USING (true);

-- ============================================================================
-- 6. Create helper function: auto_verify_outreach_proof
-- ============================================================================

CREATE OR REPLACE FUNCTION auto_verify_outreach_proof(
  p_proof_id UUID,
  p_disclosure_present BOOLEAN
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Update proof status
  UPDATE outreach_proofs
  SET 
    disclosure_present = p_disclosure_present,
    auto_verified = p_disclosure_present,
    verified_at = CASE WHEN p_disclosure_present THEN NOW() ELSE NULL END,
    updated_at = NOW()
  WHERE id = p_proof_id;
  
  RETURN p_disclosure_present;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 7. Create helper function: release_outreach_payment
-- ============================================================================

CREATE OR REPLACE FUNCTION release_outreach_payment(
  p_claim_id INTEGER,
  p_usd_amount DECIMAL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_agent_id TEXT;
  v_mission_id INTEGER;
BEGIN
  -- Get agent and mission IDs from claim
  SELECT agent_id, mission_id INTO v_agent_id, v_mission_id
  FROM claims
  WHERE id = p_claim_id;
  
  IF v_agent_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Update claim: mark USD as released
  UPDATE claims
  SET 
    usd_released = p_usd_amount,
    status = 'verified'
  WHERE id = p_claim_id;
  
  -- Update agent: add to total_earned
  UPDATE agents
  SET 
    total_earned = total_earned + p_usd_amount,
    updated_at = NOW()
  WHERE id = v_agent_id;
  
  -- Log transaction (if needed)
  -- INSERT INTO xp_transactions (agent_id, amount, action, description, claim_id)
  -- VALUES (v_agent_id, 0, 'outreach_payment', 'Outreach mission USD payout', p_claim_id);
  
  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 8. Add columns to missions table for outreach tracking
-- ============================================================================

ALTER TABLE missions ADD COLUMN IF NOT EXISTS outreach_verified_count INTEGER DEFAULT 0;
ALTER TABLE missions ADD COLUMN IF NOT EXISTS outreach_rejected_count INTEGER DEFAULT 0;

-- ============================================================================
-- 9. Create view: outreach_missions_active
-- ============================================================================

CREATE OR REPLACE VIEW outreach_missions_active AS
SELECT 
  m.id,
  m.mission_type,
  m.target_platform,
  m.title,
  m.outreach_template,
  m.target_list,
  m.success_criteria,
  m.proof_type,
  m.requires_disclosure,
  m.usd_reward,
  m.max_claims,
  m.status,
  COUNT(DISTINCT c.id) as claims_count,
  COUNT(DISTINCT CASE WHEN op.auto_verified OR op.manual_verified THEN c.id END) as verified_count,
  m.created_at,
  m.requester_agent_id
FROM missions m
LEFT JOIN claims c ON m.id = c.mission_id
LEFT JOIN outreach_proofs op ON c.id = op.claim_id
WHERE m.mission_type = 'outreach' AND m.status = 'active'
GROUP BY m.id;

-- ============================================================================
-- 10. Create view: outreach_proofs_pending_review
-- ============================================================================

CREATE OR REPLACE VIEW outreach_proofs_pending_review AS
SELECT 
  op.id,
  op.claim_id,
  op.proof_type,
  op.email_sent_to,
  op.recipient_name,
  op.disclosure_present,
  op.auto_verified,
  op.manual_verified,
  op.notes,
  op.created_at,
  c.agent_id,
  c.mission_id,
  m.title as mission_title,
  m.usd_reward
FROM outreach_proofs op
JOIN claims c ON op.claim_id = c.id
JOIN missions m ON c.mission_id = m.id
WHERE (op.auto_verified = false OR op.auto_verified IS NULL)
  AND (op.manual_verified = false OR op.manual_verified IS NULL)
ORDER BY op.created_at DESC;

-- ============================================================================
-- 11. Grant permissions (adjust as needed for your security model)
-- ============================================================================

-- Allow public to read missions (already done via RLS)
-- Allow agents to insert claims (already done via RLS)
-- Allow service role to access all tables (via SUPABASE_SERVICE_ROLE_KEY)

-- ============================================================================
-- Done!
-- ============================================================================

-- Run verification:
-- SELECT * FROM outreach_missions_active;
-- SELECT * FROM outreach_proofs_pending_review;
