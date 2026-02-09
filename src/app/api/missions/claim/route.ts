import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Lazy initialization for Vercel build
let supabase: SupabaseClient | null = null;
function getSupabase(): SupabaseClient {
  if (!supabase) {
    supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return supabase;
}

// POST /api/missions/claim - Claim a mission
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mission_id, agent_id, wallet_address } = body;

    if (!mission_id || !agent_id || !wallet_address) {
      return NextResponse.json(
        { error: 'mission_id, agent_id, and wallet_address required' },
        { status: 400 }
      );
    }

    const db = getSupabase();

    // Verify agent
    const { data: agent, error: agentError } = await db
      .from('agents')
      .select('id, xp, trust_tier, youtube_verified_at')
      .eq('id', agent_id)
      .eq('wallet_address', wallet_address)
      .single();

    if (agentError || !agent) {
      return NextResponse.json({ error: 'Agent not found or wallet mismatch' }, { status: 403 });
    }

    // Get mission
    const { data: mission, error: missionError } = await db
      .from('missions')
      .select('*')
      .eq('id', mission_id)
      .single();

    if (missionError || !mission) {
      return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const missionData = mission as any;

    // Can't claim your own mission
    if (missionData.requester_agent_id === agent_id) {
      return NextResponse.json({ error: 'Cannot claim your own mission' }, { status: 400 });
    }

    // Check mission is active
    if (missionData.status !== 'active') {
      return NextResponse.json({ error: 'Mission is not active' }, { status: 400 });
    }

    // Check mission isn't full
    if (missionData.current_count >= missionData.target_count) {
      return NextResponse.json({ error: 'Mission is already complete' }, { status: 400 });
    }

    // Check agent hasn't already claimed
    const { data: existingClaim } = await db
      .from('claims')
      .select('id, status')
      .eq('mission_id', mission_id)
      .eq('agent_id', agent_id)
      .single();

    if (existingClaim) {
      return NextResponse.json(
        { error: 'You have already claimed this mission', claim: existingClaim },
        { status: 400 }
      );
    }

    // Create claim
    const { data: claim, error: claimError } = await db
      .from('claims')
      .insert({
        mission_id,
        agent_id,
        status: 'pending',
        xp_escrow: missionData.xp_reward,
      })
      .select()
      .single();

    if (claimError) {
      console.error('Failed to create claim:', claimError);
      return NextResponse.json({ error: 'Failed to claim mission' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      claim,
      message: 'Mission claimed! Complete the task and submit proof.',
    });

  } catch (err) {
    console.error('Claim error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
