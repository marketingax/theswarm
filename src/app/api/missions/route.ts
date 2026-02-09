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

// GET /api/missions - List active missions
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type'); // filter by mission_type
  const status = searchParams.get('status') || 'active';
  const limit = parseInt(searchParams.get('limit') || '50');

  const db = getSupabase();
  
  let query = db
    .from('missions')
    .select('*')
    .eq('status', status)
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (type) {
    query = query.eq('mission_type', type);
  }

  const { data: missions, error } = await query;

  if (error) {
    console.error('Failed to fetch missions:', error);
    return NextResponse.json({ error: 'Failed to fetch missions' }, { status: 500 });
  }

  return NextResponse.json({ 
    success: true, 
    missions,
    count: missions?.length || 0
  });
}

// POST /api/missions - Create a new mission
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      agent_id,
      wallet_address,
      mission_type,
      target_url,
      target_name,
      target_count = 1,
      target_hours = 0,
      xp_reward = 10,
      instructions,
    } = body;

    if (!agent_id || !wallet_address || !mission_type || !target_url) {
      return NextResponse.json(
        { error: 'agent_id, wallet_address, mission_type, and target_url required' },
        { status: 400 }
      );
    }

    // Validate mission type
    const validTypes = [
      'youtube_subscribe',
      'youtube_watch',
      'youtube_like',
      'twitter_follow',
      'twitter_like',
      'twitter_retweet',
      'github_star',
      'github_follow',
      'custom',
    ];

    if (!validTypes.includes(mission_type)) {
      return NextResponse.json(
        { error: `Invalid mission_type. Valid types: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    const db = getSupabase();

    // Verify agent owns this wallet
    const { data: agent, error: agentError } = await db
      .from('agents')
      .select('id, xp, trust_tier')
      .eq('id', agent_id)
      .eq('wallet_address', wallet_address)
      .single();

    if (agentError || !agent) {
      return NextResponse.json({ error: 'Agent not found or wallet mismatch' }, { status: 403 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const agentData = agent as any;

    // Calculate XP cost (based on target count and reward)
    const xp_cost = target_count * xp_reward;

    // Check agent has enough XP
    if (agentData.xp < xp_cost) {
      return NextResponse.json(
        { error: `Insufficient XP. Need ${xp_cost}, have ${agentData.xp}` },
        { status: 400 }
      );
    }

    // Create mission
    const { data: mission, error: missionError } = await db
      .from('missions')
      .insert({
        requester_agent_id: agent_id,
        requester_type: 'agent',
        mission_type,
        target_url,
        target_name,
        target_count,
        target_hours,
        xp_cost,
        xp_reward,
        instructions,
        status: 'active',
      })
      .select()
      .single();

    if (missionError) {
      console.error('Failed to create mission:', missionError);
      return NextResponse.json({ error: 'Failed to create mission' }, { status: 500 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const missionData = mission as any;

    // Deduct XP from agent (into escrow)
    await db
      .from('agents')
      .update({ xp: agentData.xp - xp_cost, updated_at: new Date().toISOString() })
      .eq('id', agent_id);

    // Log XP transaction
    await db
      .from('xp_transactions')
      .insert({
        agent_id,
        amount: -xp_cost,
        action: 'escrow',
        description: `XP escrowed for mission: ${mission_type}`,
        mission_id: missionData.id,
      });

    return NextResponse.json({
      success: true,
      mission,
      xp_deducted: xp_cost,
    });

  } catch (err) {
    console.error('Mission creation error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
