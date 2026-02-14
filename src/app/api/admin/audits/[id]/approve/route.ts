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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = getSupabase();
    const { id } = await params;
    const claimId = id;

    // Get the claim
    const { data: claim, error: claimError } = await db
      .from('claims')
      .select('id, agent_id, staked_xp, mission_id')
      .eq('id', claimId)
      .single();

    if (claimError || !claim) {
      return NextResponse.json(
        { success: false, error: 'Claim not found' },
        { status: 404 }
      );
    }

    // Update claim status to verified
    const { error: updateError } = await db
      .from('claims')
      .update({
        status: 'verified',
        verified_at: new Date().toISOString(),
      })
      .eq('id', claimId);

    if (updateError) {
      return NextResponse.json(
        { success: false, error: updateError.message },
        { status: 500 }
      );
    }

    // Award XP to the agent
    const { error: xpError } = await db.from('xp_transactions').insert({
      agent_id: claim.agent_id,
      amount: claim.staked_xp,
      action: 'claim_verified',
      description: `Claim verified for mission ${claim.mission_id}`,
      mission_id: claim.mission_id,
    });

    if (xpError) {
      console.error('XP error:', xpError);
      // Don't fail the whole operation if XP logging fails
    }

    // Update agent's verified_claims count
    const { data: agent } = await db
      .from('agents')
      .select('verified_claims')
      .eq('id', claim.agent_id)
      .single();

    if (agent) {
      await db
        .from('agents')
        .update({
          verified_claims: (agent.verified_claims || 0) + 1,
          xp: await getAgentXP(db, claim.agent_id),
        })
        .eq('id', claim.agent_id);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Approve error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to approve claim' },
      { status: 500 }
    );
  }
}

async function getAgentXP(db: SupabaseClient, agentId: string): Promise<number> {
  const { data } = await db
    .from('xp_transactions')
    .select('amount')
    .eq('agent_id', agentId);

  return (data || []).reduce((sum, tx) => sum + tx.amount, 0);
}
