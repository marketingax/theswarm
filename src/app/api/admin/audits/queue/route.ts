import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

let supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;

    if (!url || !key) {
      throw new Error('Missing Supabase configuration');
    }

    supabase = createClient(url, key);
  }
  return supabase;
}

export async function GET(request: NextRequest) {
  try {
    const db = getSupabase();

    // Get all claims with status 'auditing' (flagged for manual review)
    const { data: claims, error } = await db
      .from('claims')
      .select('id, mission_id, agent_id, status, proof_url, proof_notes, submitted_at, staked_xp')
      .eq('status', 'auditing')
      .order('submitted_at', { ascending: true });

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    // Enrich with agent and mission names
    const enrichedClaims = [];

    for (const claim of claims || []) {
      const [agentRes, missionRes] = await Promise.all([
        db.from('agents').select('name').eq('id', claim.agent_id).single(),
        db.from('missions').select('title').eq('id', claim.mission_id).single(),
      ]);

      enrichedClaims.push({
        id: claim.id,
        agent_id: claim.agent_id,
        agent_name: agentRes.data?.name || 'Unknown',
        mission_id: claim.mission_id,
        mission_title: missionRes.data?.title || 'Unknown',
        proof_url: claim.proof_url,
        proof_notes: claim.proof_notes,
        submitted_at: claim.submitted_at,
        staked_xp: claim.staked_xp,
        reason_flagged: 'Manual review required', // In production, this would be stored
      });
    }

    return NextResponse.json({
      success: true,
      claims: enrichedClaims,
    });
  } catch (error) {
    console.error('Audit queue error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load audit queue' },
      { status: 500 }
    );
  }
}
