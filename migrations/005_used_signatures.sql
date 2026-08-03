-- Migration 005: Signature replay protection
-- A signed challenge was previously accepted for 5 minutes with no tracking,
-- so a captured signature could be replayed against any endpoint. Every
-- verified signature is now consumed exactly once: its hash is inserted here,
-- and a duplicate insert (unique violation) means replay -> reject.
-- Run this in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS used_signatures (
  sig_hash TEXT PRIMARY KEY,          -- sha256 hex of the signature string
  wallet_address TEXT,
  used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL     -- safe to purge after this (signature window + slack)
);

CREATE INDEX IF NOT EXISTS idx_used_signatures_expires ON used_signatures(expires_at);

-- Service-role only
ALTER TABLE used_signatures ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE used_signatures IS 'One row per consumed auth signature; duplicate insert = replay attempt';
