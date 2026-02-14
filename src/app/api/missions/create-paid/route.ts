import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { checkMissionContent, getSecurityNotice } from '@/lib/security';

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

interface CreatePaidMissionRequest {
  agent_id: string;
  wallet_address: string;
  mission_type: string;
  target_url: string;
  target_name: string;
  target_count: number;
  usd_budget: number;
  usd_reward_per_completion: number;
  instructions?: string;
}

interface Agent {
  id: string;
  xp: number;
  usd_balance: number;
  trust_tier: string;
}

// POST /api/missions/create-paid - Create a new USD-paid mission
export async function POST(request: NextRequest) {
  try {
    const body: CreatePaidMissionRequest = await request.json();
    const {
      agent_id,
      wallet_address,
      mission_type,
      target_url,
      target_name,
      target_count,
      usd_budget,
      usd_reward_per_completion,
      instructions,
    } = body;

    // Validate required fields
    if (
      !agent_id ||
      !wallet_address ||
      !mission_type ||
      !target_url ||
      target_count === undefined ||
      usd_budget === undefined ||
      usd_reward_per_completion === undefined
    ) {
      return NextResponse.json(
        {
          error: 'Missing required fields: agent_id, wallet_address, mission_type, target_url, target_count, usd_budget, usd_reward_per_completion',
        },
        { status: 400 }
      );
    }

    // Validate numeric fields
    if (target_count <= 0 || usd_budget <= 0 || usd_reward_per_completion <= 0) {
      return NextResponse.json(
        {
          error: 'target_count, usd_budget, and usd_reward_per_completion must be positive numbers',
        },
        { status: 400 }
      );
    }

    // Validate total cost matches expectations
    const expectedTotal = usd_reward_per_completion * target_count;
    if (Math.abs(usd_budget - expectedTotal) > 0.01) {
      return NextResponse.json(
        {
          error: `USD budget mismatch: expected ${expectedTotal.toFixed(2)}, got ${usd_budget.toFixed(2)}`,
        },
        { status: 400 }
      );
    }

    // 🛡️ SECURITY: Check mission content for dangerous patterns
    const securityCheck = checkMissionContent(target_name, instructions, target_url);
    if (securityCheck.blocked) {
      console.warn('Paid mission blocked by security filter:', securityCheck.reasons);
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

    // Verify agent owns this wallet
    const { data: agent, error: agentError } = await db
      .from('agents')
      .select('id, xp, usd_balance, trust_tier')
      .eq('id', agent_id)
      .eq('wallet_address', wallet_address)
      .single();

    if (agentError || !agent) {
      return NextResponse.json({ error: 'Agent not found or wallet mismatch' }, { status: 403 });
    }

    const agentData = agent as Agent;

    // Check agent has sufficient USD balance
    if (agentData.usd_balance < usd_budget) {
      return NextResponse.json(
        {
          error: `Insufficient USD balance. Need ${usd_budget.toFixed(2)}, have ${agentData.usd_balance.toFixed(2)}`,
        },
        { status: 400 }
      );
    }

    // 🛡️ SECURITY: Custom missions require extra scrutiny
    const requiresReview = mission_type === 'custom';

    // Create mission
    const { data: mission, error: missionError } = await db
      .from('missions')
      .insert({
        requester_agent_id: agent_id,
        requester_type: 'customer',
        mission_type,
        target_url,
        target_name,
        target_count,
        target_hours: 0,
        usd_budget,
        usd_reward: usd_reward_per_completion,
        xp_reward: 0,
        instructions: instructions || '',
        status: requiresReview ? 'pending_review' : 'active',
        priority: 0,
      })
      .select()
      .single();

    if (missionError) {
      console.error('Failed to create paid mission:', missionError);
      return NextResponse.json({ error: 'Failed to create mission' }, { status: 500 });
    }

    const missionData = mission as any;

    // Deduct USD from agent balance (into escrow)
    const newBalance = agentData.usd_balance - usd_budget;
    await db
      .from('agents')
      .update({
        usd_balance: newBalance,
        updated_at: new Date().toISOString(),
      })
      .eq('id', agent_id);

    // Log USD transaction
    await db
      .from('transactions')
      .insert({
        agent_id,
        amount: -usd_budget,
        type: 'usd',
        action: 'escrow',
        description: `USD escrowed for paid mission: ${mission_type}`,
        mission_id: missionData.id,
      });

    return NextResponse.json({
      success: true,
      mission: {
        id: missionData.id,
        mission_type: missionData.mission_type,
        target_name: missionData.target_name,
        target_url: missionData.target_url,
        target_count: missionData.target_count,
        usd_budget: missionData.usd_budget,
        usd_reward_per_completion: missionData.usd_reward,
        status: missionData.status,
        created_at: missionData.created_at,
      },
      usd_deducted: usd_budget,
      remaining_balance: newBalance,
      requires_review: requiresReview,
      security_notice: getSecurityNotice(),
    });

  } catch (err) {
    console.error('Paid mission creation error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
