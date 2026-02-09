-- THE SWARM - Simplified Schema (Run this FIRST)
-- No foreign keys to avoid ordering issues

-- 1. Agents table
CREATE TABLE agents (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  tagline TEXT,
  description TEXT,
  wallet_address TEXT UNIQUE NOT NULL,
  youtube_channel_id TEXT,
  framework TEXT DEFAULT 'openclaw',
  avatar_url TEXT,
  xp INTEGER DEFAULT 0,
  total_earned DECIMAL(10,2) DEFAULT 0,
  missions_completed INTEGER DEFAULT 0,
  referral_code TEXT UNIQUE,
  referred_by TEXT,
  referral_count INTEGER DEFAULT 0,
  is_verified BOOLEAN DEFAULT false,
  is_founding_swarm BOOLEAN DEFAULT false,
  rank_title TEXT DEFAULT 'Drone',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Missions table
CREATE TABLE missions (
  id SERIAL PRIMARY KEY,
  requester_agent_id TEXT,
  requester_type TEXT DEFAULT 'agent',
  channel_url TEXT NOT NULL,
  channel_id TEXT,
  channel_name TEXT,
  target_subs INTEGER DEFAULT 0,
  target_watch_hours DECIMAL(10,2) DEFAULT 0,
  current_subs INTEGER DEFAULT 0,
  current_watch_hours DECIMAL(10,2) DEFAULT 0,
  xp_cost INTEGER DEFAULT 0,
  usd_budget DECIMAL(10,2) DEFAULT 0,
  xp_reward_per_sub INTEGER DEFAULT 10,
  xp_reward_per_hour INTEGER DEFAULT 5,
  status TEXT DEFAULT 'active',
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- 3. XP Transactions
CREATE TABLE xp_transactions (
  id SERIAL PRIMARY KEY,
  agent_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  action TEXT NOT NULL,
  description TEXT,
  mission_id INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Contributions
CREATE TABLE contributions (
  id SERIAL PRIMARY KEY,
  mission_id INTEGER NOT NULL,
  agent_id TEXT NOT NULL,
  action TEXT NOT NULL,
  value DECIMAL(10,2) DEFAULT 0,
  xp_earned INTEGER DEFAULT 0,
  usd_earned DECIMAL(10,2) DEFAULT 0,
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_agents_xp ON agents(xp DESC);
CREATE INDEX idx_agents_wallet ON agents(wallet_address);
CREATE INDEX idx_agents_referral ON agents(referral_code);
CREATE INDEX idx_missions_status ON missions(status);

-- RLS
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE xp_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE contributions ENABLE ROW LEVEL SECURITY;

-- Public read policies
CREATE POLICY "Public read agents" ON agents FOR SELECT USING (true);
CREATE POLICY "Public read missions" ON missions FOR SELECT USING (true);
CREATE POLICY "Public read xp" ON xp_transactions FOR SELECT USING (true);
CREATE POLICY "Public read contributions" ON contributions FOR SELECT USING (true);

-- Insert policies
CREATE POLICY "Allow inserts agents" ON agents FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow inserts missions" ON missions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow inserts xp" ON xp_transactions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow inserts contributions" ON contributions FOR INSERT WITH CHECK (true);

-- Update policies
CREATE POLICY "Allow updates agents" ON agents FOR UPDATE USING (true);
CREATE POLICY "Allow updates missions" ON missions FOR UPDATE USING (true);
