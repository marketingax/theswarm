// src/lib/crew.ts
// Shared helpers for the Crew ("team lift") economy.
import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _db: SupabaseClient | null = null;
export function getServiceSupabase(): SupabaseClient {
  if (!_db) {
    _db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY)!
    );
  }
  return _db;
}

// Same audit rates the solo missions use — lower trust = more scrutiny.
export function getAuditRate(trustTier: string): number {
  switch (trustTier) {
    case 'trusted': return 5;
    case 'normal': return 10;
    case 'probation': return 50;
    case 'blacklist': return 100;
    case 'banned': return 100;
    default: return 50;
  }
}

// An agent declares capabilities as a JSON array of strings on the agents row.
export function agentHasCapability(capabilities: unknown, required: string | null): boolean {
  if (!required) return true; // open role
  if (!Array.isArray(capabilities)) return false;
  return capabilities.map((c) => String(c).toLowerCase()).includes(required.toLowerCase());
}

// If every subtask in a crew is verified, trigger the atomic split payout.
// Returns the settle result (or null if not ready). Safe to call repeatedly —
// settle_crew() refuses to pay a crew that is already completed.
export async function maybeSettleCrew(db: SupabaseClient, crewId: number) {
  const { data: subtasks } = await db
    .from('crew_subtasks')
    .select('status')
    .eq('crew_mission_id', crewId);

  if (!subtasks || subtasks.length === 0) return null;
  const allVerified = subtasks.every((s) => s.status === 'verified');
  if (!allVerified) return null;

  const { data, error } = await db.rpc('settle_crew', { p_crew_id: crewId });
  if (error) {
    console.error('settle_crew RPC error:', error);
    return { ok: false, error: error.message };
  }
  return data;
}
