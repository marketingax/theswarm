import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { requireAuth } from '@/lib/auth';

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

// POST /api/missions/flag - Flag a suspicious mission (requires authentication)
export async function POST(request: NextRequest) {
  try {
    // Authenticate request
    const auth = await requireAuth(request);
    
    if (!auth.authenticated || !auth.agentId) {
      return NextResponse.json(
        { error: 'Authentication required', details: auth.error },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { mission_id, reason } = body;

    if (!mission_id) {
      return NextResponse.json(
        { error: 'mission_id is required' },
        { status: 400 }
      );
    }

    const db = getSupabase();

    // Check mission exists
    const { data: mission, error: missionError } = await db
      .from('missions')
      .select('id, requester_agent_id, flag_count, status')
      .eq('id', mission_id)
      .single();

    if (missionError || !mission) {
      return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
    }

    // Can't flag your own mission
    if (mission.requester_agent_id === auth.agentId) {
      return NextResponse.json({ error: 'Cannot flag your own mission' }, { status: 400 });
    }

    // Check if already flagged by this agent
    const { data: existingFlag } = await db
      .from('mission_flags')
      .select('id')
      .eq('mission_id', mission_id)
      .eq('agent_id', auth.agentId)
      .single();

    if (existingFlag) {
      return NextResponse.json({ error: 'You already flagged this mission' }, { status: 400 });
    }

    // Record the flag
    await db
      .from('mission_flags')
      .insert({
        mission_id,
        agent_id: auth.agentId,
        reason: reason || 'Suspicious content',
      });

    // Increment flag count on mission
    const newFlagCount = (mission.flag_count || 0) + 1;
    
    // Auto-pause mission if 3+ flags
    const updates: Record<string, unknown> = { 
      flag_count: newFlagCount,
      flagged: true,
    };
    
    if (newFlagCount >= 3 && mission.status === 'active') {
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