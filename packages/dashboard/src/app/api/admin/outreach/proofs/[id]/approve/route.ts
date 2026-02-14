import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { authenticateAPI } from '@/lib/middleware';

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

// POST /api/admin/outreach/proofs/[id]/approve
// Admin approves an outreach proof and releases USD payment
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate as admin
    const auth = await authenticateAPI(request, true);
    if (!auth.authenticated || !auth.agentId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // For MVP: Assume any authenticated user can approve
    // In production: Check admin role
    // const { data: admin } = await db.from('admins').select('id').eq('agent_id', auth.agentId).single();
    // if (!admin) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

    const { id: proofId } = await context.params;
    if (!proofId) {
      return NextResponse.json(
        { error: 'Invalid proof ID' },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const adminNotes = body.admin_notes || '';

    const db = getSupabase();

    // Get proof
    const { data: proof, error: proofError } = await db
      .from('outreach_proofs')
      .select('*, claims:claim_id(id, agent_id, mission_id, missions:mission_id(usd_reward))')
      .eq('id', proofId)
      .single();

    if (proofError || !proof) {
      return NextResponse.json(
        { error: 'Proof not found' },
        { status: 404 }
      );
    }

    if (proof.manual_verified === true) {
      return NextResponse.json(
        { error: 'Proof already verified' },
        { status: 400 }
      );
    }

    // Get mission/reward amount
    const claim = proof.claims;
    const missionReward = claim.missions?.usd_reward || 0;

    // Update proof
    const { error: updateError } = await db
      .from('outreach_proofs')
      .update({
        manual_verified: true,
        manual_verified_by: auth.agentId,
        verified_at: new Date().toISOString(),
        notes: adminNotes || null
      })
      .eq('id', proofId);

    if (updateError) {
      throw updateError;
    }

    // Update claim
    const { error: claimError } = await db
      .from('claims')
      .update({
        status: 'verified',
        usd_released: missionReward,
        verified_at: new Date().toISOString(),
        verified_by: auth.agentId
      })
      .eq('id', claim.id);

    if (claimError) {
      throw claimError;
    }

    // Update agent balance (add USD)
    const { data: agent, error: agentError } = await db
      .from('agents')
      .select('total_earned')
      .eq('id', claim.agent_id)
      .single();

    if (!agentError && agent) {
      await db
        .from('agents')
        .update({
          total_earned: (agent.total_earned || 0) + missionReward,
          updated_at: new Date().toISOString()
        })
        .eq('id', claim.agent_id);
    }

    return NextResponse.json({
      success: true,
      proof_id: proofId,
      claim_id: claim.id,
      agent_id: claim.agent_id,
      usd_released: missionReward,
      message: `USD $${missionReward.toFixed(2)} released to agent ${claim.agent_id}`
    });

  } catch (err) {
    console.error('Approve proof error:', err);
    return NextResponse.json(
      { error: 'Internal server error', details: String(err) },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'POST to approve a proof',
    required_fields: {
      admin_notes: 'string (optional) - Notes about approval'
    }
  });
}
