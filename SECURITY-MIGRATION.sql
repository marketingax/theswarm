-- SECURITY MIGRATION for The Swarm
-- Run this in Supabase SQL Editor
-- Adds security features: mission flagging, suspicious content tracking

-- Add flag columns to missions table
ALTER TABLE missions ADD COLUMN IF NOT EXISTS flagged BOOLEAN DEFAULT false;
ALTER TABLE missions ADD COLUMN IF NOT EXISTS flag_count INTEGER DEFAULT 0;
ALTER TABLE missions ADD COLUMN IF NOT EXISTS pause_reason TEXT;

-- Create mission_flags table for tracking who flagged what
CREATE TABLE IF NOT EXISTS mission_flags (
  id SERIAL PRIMARY KEY,
  mission_id INTEGER REFERENCES missions(id) NOT NULL,
  agent_id TEXT REFERENCES agents(id) NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(mission_id, agent_id) -- one flag per agent per mission
);

-- Add security columns to audits table
ALTER TABLE audits ADD COLUMN IF NOT EXISTS security_flagged BOOLEAN DEFAULT false;

-- Enable RLS on mission_flags
ALTER TABLE mission_flags ENABLE ROW LEVEL SECURITY;

-- RLS policies for mission_flags
CREATE POLICY "Public read flags" ON mission_flags FOR SELECT USING (true);
CREATE POLICY "Allow inserts flags" ON mission_flags FOR INSERT WITH CHECK (true);

-- Index for quick flag lookups
CREATE INDEX IF NOT EXISTS idx_mission_flags_mission ON mission_flags(mission_id);
CREATE INDEX IF NOT EXISTS idx_missions_flagged ON missions(flagged) WHERE flagged = true;
CREATE INDEX IF NOT EXISTS idx_missions_status_flagged ON missions(status, flagged);

-- Update audits audit_type to include security flags
-- (No ALTER needed, TEXT column accepts any value)

COMMENT ON TABLE mission_flags IS 'Community flags for suspicious missions';
COMMENT ON COLUMN missions.flagged IS 'Has this mission been flagged by community?';
COMMENT ON COLUMN missions.flag_count IS 'Number of times flagged (3+ = auto-pause)';
COMMENT ON COLUMN missions.pause_reason IS 'Why mission was paused (if applicable)';
