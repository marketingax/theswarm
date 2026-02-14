import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { checkMissionContent, getSecurityNotice } from '@/lib/security';
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

// GET /api/missions - List active missions (public)
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
    count: missions?.length || 0,
    security_notice: getSecurityNotice(),
  });
}

// POST /api/missions - Create a new mission (requires authentication)
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
    const {
      mission_type,
      target_url,
      target_name,
      target_count = 1,
      target_hours = 0,
      xp_reward = 10,
      instructions,
      xp_cost // Optional: if not provided, calculated from target_count * xp_reward
    } = body;

    if (!mission_type || !target_url) {
      return NextResponse.json(
        { error: 'mission_type and target_url required' },
        { status: 400 }
      );
    }

    // 🛡️ SECURITY: Check mission content for dangerous patterns
    const securityCheck = checkMissionContent(target_name, instructions, target_url);
    if (securityCheck.blocked) {
      console.warn('Mission blocked by security filter:', securityCheck.reasons);
      return NextResponse.json(
        { 
          error: 'Mission rejected: Content contains prohibited patterns',
          reasons: securityCheck.reasons,
          security_notice: getSecurityNotice(),
        },
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

    // Get agent info
    const { data: agent, error: agentError } = await db
      .from('agents')
      .select('id, xp, trust_tier')
      .eq('id', auth.agentId)
      .single();

    if (agentError || !agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 403 });
    }

    // Calculate XP cost if not provided
    const calculatedXpCost = xp_cost || (target_count * xp_reward);

    // Check agent has enough XP
    if (agent.xp < calculatedXpCost) {
      return NextResponse.json(
        { error: `Insufficient XP. Need ${calculatedXpCost}, have ${agent.xp}` },
        { status: 400 }
      );
    }

    // 🛡️ SECURITY: Custom missions require extra scrutiny
    const requiresReview = mission_type === 'custom';

    // Create mission
    const { data: mission, error: missionError } = await db
      .from('missions')
      .insert({
        requester_agent_id: auth.agentId,
        mission_type,
        target_url,
        target_name,
        target_count,
        target_hours,
        xp_reward,
        instructions,
        xp_cost: calculatedXpCost,
        status: requiresReview ? 'pending' : 'active',
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
      })
      .select()
      .single();

    if (missionError) {
      console.error('Failed to create mission:', missionError);
      return NextResponse.json({ error: 'Failed to create mission' }, { status: 500 });
    }

    // Deduct XP from agent (into escrow)
    await db
      .from('agents')
      .update({ xp: agent.xp - calculatedXpCost, updated_at: new Date().toISOString() })
      .eq('id', auth.agentId);

    // Log XP transaction
    await db
      .from('xp_transactions')
      .insert({
        agent_id: auth.agentId,
        amount: -calculatedXpCost,
        action: 'escrow',
        description: `XP escrowed for mission: ${mission_type}`,
        mission_id: mission.id,
      });

    return NextResponse.json({
      success: true,
      mission,
      xp_deducted: calculatedXpCost,
      requires_review: requiresReview,
      security_notice: getSecurityNotice(),
    });

  } catch (err) {
    console.error('Mission creation error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}