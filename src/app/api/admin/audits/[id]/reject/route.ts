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

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const db = getSupabase();
    const claimId = params.id;
    const { reason } = await request.json();

    if (!reason) {
      return NextResponse.json(
        { success: false, error: 'Rejection reason required' },
        { status: 400 }
      );
    }

    // Get the claim
    const { data: claim, error: claimError } = await db
      .from('claims')
      .select('id, agent_id, staked_xp')
      .eq('id', claimId)
      .single();

    if (claimError || !claim) {
      return NextResponse.json(
        { success: false, error: 'Claim not found' },
        { status: 404 }
      );
    }

    // Update claim status to rejected
    const { error: updateError } = await db
      .from('claims')
      .update({
        status: 'rejected',
        audit_result: 'failed',
      })
      .eq('id', claimId);

    if (updateError) {
      return NextResponse.json(
        { success: false, error: updateError.message },
        { status: 500 }
      );
    }

    // Increment fraud flags for the agent
    const { data: agent } = await db
      .from('agents')
      .select('fraud_flags, trust_tier')
      .eq('id', claim.agent_id)
      .single();

    if (agent) {
      const newFlags = (agent.fraud_flags || 0) + 1;

      // Determine new trust tier based on fraud flags
      let newTier = agent.trust_tier;
      if (newFlags >= 3) {
        newTier = 'banned';
      } else if (newFlags >= 2) {
        newTier = 'blacklist';
      } else if (newFlags >= 1) {
        newTier = 'probation';
      }

      await db
        .from('agents')
        .update({
          fraud_flags: newFlags,
          trust_tier: newTier,
        })
        .eq('id', claim.agent_id);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Reject error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to reject claim' },
      { status: 500 }
    );
  }
}
