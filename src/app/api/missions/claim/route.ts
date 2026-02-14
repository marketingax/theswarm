import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getSecurityNotice } from '@/lib/security';
import { authenticateAPI } from '@/lib/middleware';

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

// POST /api/missions/claim - Claim a mission (requires authentication)
export async function POST(request: NextRequest) {
  try {
    // Authenticate request
    const auth = await authenticateAPI(request, true);
    
    if (!auth.authenticated || !auth.agentId) {
      return NextResponse.json(
        { error: 'Authentication required', details: auth.error },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { mission_id } = body;

    if (!mission_id) {
      return NextResponse.json(
        { error: 'mission_id is required' },
        { status: 400 }
      );
    }

    const db = getSupabase();

    // Get agent info
    const { data: agent, error: agentError } = await db
      .from('agents')
      .select('id, xp, trust_tier, youtube_verified_at')
      .eq('id', auth.agentId)
      .single();

    if (agentError || !agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 403 });
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

    // Can't claim your own mission
    if (mission.requester_agent_id === auth.agentId) {
      return NextResponse.json({ error: 'Cannot claim your own mission' }, { status: 400 });
    }

    // Check mission is active
    if (mission.status !== 'active') {
      return NextResponse.json({ error: 'Mission is not active' }, { status: 400 });
    }

    // Check mission isn't full
    if (mission.current_count >= mission.target_count) {
      return NextResponse.json({ error: 'Mission is already complete' }, { status: 400 });
    }

    // Check agent hasn't already claimed
    const { data: existingClaim } = await db
      .from('claims')
      .select('id, status')
      .eq('mission_id', mission_id)
      .eq('agent_id', auth.agentId)
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
        agent_id: auth.agentId,
        status: 'pending',
        xp_escrow: mission.xp_reward,
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
      security_notice: getSecurityNotice(),
    });

  } catch (err) {
    console.error('Claim error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}