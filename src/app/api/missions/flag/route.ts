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

// POST /api/missions/flag - Flag a suspicious mission
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mission_id, agent_id, wallet_address, reason } = body;

    if (!mission_id || !agent_id || !wallet_address) {
      return NextResponse.json(
        { error: 'mission_id, agent_id, and wallet_address required' },
        { status: 400 }
      );
    }

    const db = getSupabase();

    // Verify agent exists and owns wallet
    const { data: agent, error: agentError } = await db
      .from('agents')
      .select('id, name')
      .eq('id', agent_id)
      .eq('wallet_address', wallet_address)
      .single();

    if (agentError || !agent) {
      return NextResponse.json({ error: 'Agent not found or wallet mismatch' }, { status: 403 });
    }

    // Check mission exists
    const { data: mission, error: missionError } = await db
      .from('missions')
      .select('id, creator_id, flag_count, status')
      .eq('id', mission_id)
      .single();

    if (missionError || !mission) {
      return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const missionData = mission as any;

    // Can't flag your own mission
    if (missionData.creator_id === agent_id) {
      return NextResponse.json({ error: 'Cannot flag your own mission' }, { status: 400 });
    }

    // Check if already flagged by this agent
    const { data: existingFlag } = await db
      .from('mission_flags')
      .select('id')
      .eq('mission_id', mission_id)
      .eq('agent_id', agent_id)
      .single();

    if (existingFlag) {
      return NextResponse.json({ error: 'You already flagged this mission' }, { status: 400 });
    }

    // Record the flag
    await db
      .from('mission_flags')
      .insert({
        mission_id,
        agent_id,
        reason: reason || 'Suspicious content',
      });

    // Increment flag count on mission
    const newFlagCount = (missionData.flag_count || 0) + 1;
    
    // Auto-pause mission if 3+ flags
    const updates: Record<string, unknown> = { 
      flag_count: newFlagCount,
      flagged: true,
    };
    
    if (newFlagCount >= 3 && missionData.status === 'active') {
      updates.status = 'paused';
      updates.pause_reason = 'Auto-paused: Multiple community flags';
    }

    await db
      .from('missions')
      .update(updates)
      .eq('id', mission_id);

    return NextResponse.json({
      success: true,
      message: newFlagCount >= 3 
        ? 'Mission flagged and paused for review' 
        : 'Mission flagged for review',
      flag_count: newFlagCount,
      paused: newFlagCount >= 3,
    });

  } catch (err) {
    console.error('Flag mission error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
