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

// POST /api/admin/outreach/proofs/[id]/reject
// Admin rejects an outreach proof
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

    // For MVP: Assume any authenticated user can reject
    // In production: Check admin role

    const { id: proofId } = await context.params;
    if (!proofId) {
      return NextResponse.json(
        { error: 'Invalid proof ID' },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const reason = body.reason || 'Proof does not meet requirements';

    const db = getSupabase();

    // Get proof
    const { data: proof, error: proofError } = await db
      .from('outreach_proofs')
      .select('*, claims:claim_id(id, agent_id)')
      .eq('id', proofId)
      .single();

    if (proofError || !proof) {
      return NextResponse.json(
        { error: 'Proof not found' },
        { status: 404 }
      );
    }

    if (proof.manual_verified === false && proof.auto_verified === false) {
      // Already rejected or pending
    }

    // Update proof
    const { error: updateError } = await db
      .from('outreach_proofs')
      .update({
        manual_verified: false,
        manual_verified_by: auth.agentId,
        rejection_reason: reason,
        notes: reason
      })
      .eq('id', proofId);

    if (updateError) {
      throw updateError;
    }

    // Update claim: back to pending so agent can resubmit
    const { error: claimError } = await db
      .from('claims')
      .update({
        status: 'pending',
        updated_at: new Date().toISOString()
      })
      .eq('id', proof.claims.id);

    if (claimError) {
      throw claimError;
    }

    return NextResponse.json({
      success: true,
      proof_id: proofId,
      claim_id: proof.claims.id,
      agent_id: proof.claims.agent_id,
      rejection_reason: reason,
      message: `Proof rejected. Reason: ${reason}. Agent can resubmit.`
    });

  } catch (err) {
    console.error('Reject proof error:', err);
    return NextResponse.json(
      { error: 'Internal server error', details: String(err) },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'POST to reject a proof',
    required_fields: {
      reason: 'string - Reason for rejection'
    },
    example_reasons: [
      'Disclosure not clearly visible',
      'Message does not match template',
      'No evidence of actual outreach',
      'Poor quality screenshot',
      'Missing required information'
    ]
  });
}
