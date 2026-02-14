import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

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

function verifyAuth(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  const token = authHeader.substring(7);
  const secret = process.env.JWT_SECRET;
  
  if (!secret) {
    console.error('JWT_SECRET not configured');
    return null;
  }
  
  try {
    const decoded = jwt.verify(token, secret) as any;
    return decoded.sub || decoded.agent_id;
  } catch (error) {
    return null;
  }
}

async function isApprovedCreator(db: SupabaseClient, agentId: string): Promise<any | null> {
  const { data: creator } = await db
    .from('creators')
    .select('*')
    .eq('agent_id', agentId)
    .eq('status', 'active')
    .single();
  
  return creator || null;
}

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const agentId = verifyAuth(request);
    if (!agentId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const db = getSupabase();
    
    // Check if creator is approved
    const creator = await isApprovedCreator(db, agentId);
    if (!creator) {
      return NextResponse.json(
        { success: false, error: 'You are not an approved creator. Please apply at /creator-program' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      type,
      title,
      description,
      target_url,
      target_channel_id,
      xp_reward,
      stake_required,
      max_claims,
      expires_at,
      usd_budget,
      per_completion,
      payment_type
    } = body;

    // Validate required fields
    if (!type || !title || !xp_reward) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: type, title, xp_reward' },
        { status: 400 }
      );
    }

    // Validate payment type and budget
    if (!payment_type || !['upfront', 'per_claim', 'mixed'].includes(payment_type)) {
      return NextResponse.json(
        { success: false, error: 'payment_type must be: upfront, per_claim, or mixed' },
        { status: 400 }
      );
    }

    if (payment_type === 'upfront' || payment_type === 'mixed') {
      if (!usd_budget || usd_budget <= 0) {
        return NextResponse.json(
          { success: false, error: 'usd_budget is required for upfront/mixed payment' },
          { status: 400 }
        );
      }
    }

    if (payment_type === 'per_claim' || payment_type === 'mixed') {
      if (!per_completion || per_completion <= 0) {
        return NextResponse.json(
          { success: false, error: 'per_completion is required for per_claim/mixed payment' },
          { status: 400 }
        );
      }
    }

    // Calculate creator payout for upfront payment
    let creatorPayoutUpfront = 0;
    if (usd_budget && (payment_type === 'upfront' || payment_type === 'mixed')) {
      creatorPayoutUpfront = usd_budget * creator.revenue_share;
    }

    // Create mission
    const { data: mission, error: missionError } = await db
      .from('missions')
      .insert({
        type,
        title,
        description,
        target_url,
        target_channel_id,
        xp_reward,
        stake_required: stake_required || xp_reward,
        creator_id: creator.id,
        status: 'open',
        max_claims: max_claims || 1,
        current_claims: 0,
        expires_at: expires_at || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days default
        usd_budget,
        per_completion,
        payment_type
      })
      .select()
      .single();

    if (missionError) {
      console.error('Mission creation error:', missionError);
      return NextResponse.json(
        { success: false, error: 'Failed to create mission: ' + missionError.message },
        { status: 500 }
      );
    }

    // Log upfront creator earnings if applicable
    if (creatorPayoutUpfront > 0) {
      const { error: earningError } = await db
        .from('creator_earnings')
        .insert({
          creator_id: creator.id,
          agent_id: agentId,
          mission_id: mission.id,
          amount: creatorPayoutUpfront,
          earnings_type: 'mission_post',
          status: 'pending',
          notes: `Mission posted: ${title}`
        });

      if (earningError) {
        console.warn('Failed to log creator earnings:', earningError);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Mission created successfully',
      mission: {
        id: mission.id,
        title: mission.title,
        type: mission.type,
        xp_reward: mission.xp_reward,
        payment_type: mission.payment_type,
        usd_budget: mission.usd_budget,
        per_completion: mission.per_completion,
        creator_payout_upfront: creatorPayoutUpfront,
        status: mission.status,
        created_at: mission.created_at
      }
    });

  } catch (error) {
    console.error('Creator mission creation error:', error);
    return NextResponse.json(
      { success: false, error: 'Server error' },
      { status: 500 }
    );
  }
}
