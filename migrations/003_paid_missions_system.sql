-- Migration: Paid Missions System (003_paid_missions_system.sql)
-- Run this migration to add USD support for missions

-- 1. Add USD balance to agents
ALTER TABLE agents 
  ADD COLUMN IF NOT EXISTS usd_balance DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stripe_account_id TEXT,
  ADD COLUMN IF NOT EXISTS usd_withdrawal_threshold DECIMAL(10,2) DEFAULT 10.00;

-- 2. Add USD budget to missions
ALTER TABLE missions 
  ADD COLUMN IF NOT EXISTS usd_budget DECIMAL(10,2) DEFAULT 0;

-- 3. Add USD released payout to claims
ALTER TABLE claims 
  ADD COLUMN IF NOT EXISTS usd_released DECIMAL(10,2) DEFAULT 0;

-- 4. Rename xp_transactions to transactions and add type field
-- Since we can't easily rename table in Supabase, we'll create a new table and migrate data

-- Create new transactions table with type field
CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  agent_id TEXT REFERENCES agents(id) NOT NULL,
  amount DECIMAL(10,2) NOT NULL, -- can be positive or negative
  type TEXT NOT NULL DEFAULT 'xp', -- 'xp' or 'usd'
  action TEXT NOT NULL, -- 'mission_complete', 'referral', 'genesis_bonus', 'spend', 'escrow', 'release', 'penalty', 'payout', 'withdrawal'
  description TEXT,
  mission_id INTEGER REFERENCES missions(id),
  claim_id INTEGER REFERENCES claims(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for transactions table
CREATE INDEX IF NOT EXISTS idx_transactions_agent ON transactions(agent_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_action ON transactions(action);
CREATE INDEX IF NOT EXISTS idx_transactions_created ON transactions(created_at);

-- Migrate data from xp_transactions to transactions if it exists
INSERT INTO transactions (agent_id, amount, type, action, description, mission_id, claim_id, created_at)
SELECT agent_id, amount, 'xp', action, description, mission_id, claim_id, created_at
FROM xp_transactions
ON CONFLICT DO NOTHING;

-- Enable RLS on transactions table
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- RLS policies for transactions
CREATE POLICY "Public read transactions" ON transactions FOR SELECT USING (true);
CREATE POLICY "Allow inserts transactions" ON transactions FOR INSERT WITH CHECK (true);

-- Add usd_missions view for dashboard
CREATE OR REPLACE VIEW usd_missions AS
SELECT 
  m.id,
  m.mission_type,
  m.target_name,
  m.target_url,
  m.target_count,
  m.current_count,
  m.usd_budget,
  m.usd_reward,
  m.status,
  m.created_at,
  a.name as requester_name,
  a.avatar_url as requester_avatar,
  COUNT(c.id) as claim_count,
  COALESCE(SUM(CASE WHEN c.status = 'verified' THEN 1 ELSE 0 END), 0) as verified_count
FROM missions m
LEFT JOIN agents a ON m.requester_agent_id = a.id
LEFT JOIN claims c ON m.id = c.mission_id
WHERE m.usd_budget > 0
GROUP BY m.id, m.mission_type, m.target_name, m.target_url, m.target_count, 
         m.current_count, m.usd_budget, m.usd_reward, m.status, m.created_at, 
         a.name, a.avatar_url
ORDER BY m.created_at DESC;

-- Add top_usd_earners view for dashboard
CREATE OR REPLACE VIEW top_usd_earners AS
SELECT 
  a.id,
  a.name,
  a.avatar_url,
  a.usd_balance,
  SUM(CASE WHEN tr.type = 'usd' AND tr.action = 'mission_complete' THEN tr.amount ELSE 0 END) as total_usd_earned,
  COUNT(DISTINCT CASE WHEN c.status = 'verified' AND m.usd_budget > 0 THEN c.id END) as usd_missions_completed
FROM agents a
LEFT JOIN transactions tr ON a.id = tr.agent_id
LEFT JOIN claims c ON a.id = c.agent_id
LEFT JOIN missions m ON c.mission_id = m.id
WHERE a.usd_balance > 0 OR a.usd_balance IS NOT NULL
GROUP BY a.id, a.name, a.avatar_url, a.usd_balance
ORDER BY a.usd_balance DESC
LIMIT 100;

-- Add pending_payouts view for dashboard
CREATE OR REPLACE VIEW pending_payouts AS
SELECT 
  a.id,
  a.name,
  a.avatar_url,
  a.usd_balance,
  a.stripe_account_id,
  a.usd_withdrawal_threshold,
  (a.usd_balance >= COALESCE(a.usd_withdrawal_threshold, 10.00)) as eligible_for_withdrawal,
  COUNT(DISTINCT c.id) as pending_claims
FROM agents a
LEFT JOIN claims c ON a.id = c.agent_id AND c.status != 'verified'
WHERE a.usd_balance >= 1.00
GROUP BY a.id, a.name, a.avatar_url, a.usd_balance, a.stripe_account_id, a.usd_withdrawal_threshold
ORDER BY a.usd_balance DESC;

-- Create pending_withdrawals table for tracking withdrawal requests
CREATE TABLE IF NOT EXISTS pending_withdrawals (
  id SERIAL PRIMARY KEY,
  agent_id TEXT REFERENCES agents(id) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  stripe_transfer_id TEXT,
  error_message TEXT,
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for pending_withdrawals
CREATE INDEX IF NOT EXISTS idx_withdrawals_agent ON pending_withdrawals(agent_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON pending_withdrawals(status);
CREATE INDEX IF NOT EXISTS idx_withdrawals_created ON pending_withdrawals(created_at);

-- Enable RLS on pending_withdrawals
ALTER TABLE pending_withdrawals ENABLE ROW LEVEL SECURITY;

-- RLS policies for pending_withdrawals
CREATE POLICY "Public read pending_withdrawals" ON pending_withdrawals FOR SELECT USING (true);
CREATE POLICY "Allow inserts pending_withdrawals" ON pending_withdrawals FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow updates pending_withdrawals" ON pending_withdrawals FOR UPDATE USING (true);

-- Add comment to track migration version
COMMENT ON TABLE transactions IS 'Replaces xp_transactions table with support for both XP and USD transactions. Version: 003';
