import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { checkProofContent, getSecurityNotice } from '@/lib/security';
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

// Get audit rate based on trust tier
function getAuditRate(trustTier: string): number {
  switch (trustTier) {
    case 'trusted': return 5;
    case 'normal': return 10;
    case 'probation': return 50;
    case 'blacklist': return 100;
    case 'banned': return 100;
    default: return 50;
  }
}

// POST /api/missions/submit - Submit proof for a claim (requires authentication)
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
    const { claim_id, proof_url, proof_data } = body;

    if (!claim_id) {
      return NextResponse.json(
        { error: 'claim_id is required' },
        { status: 400 }
      );
    }

    // 🛡️ SECURITY: Check proof content for suspicious patterns
    const proofCheck = checkProofContent(proof_url, proof_data);
    if (proofCheck.flagged) {
      console.warn('Proof flagged by security filter:', proofCheck.reasons);
      // Don't block, but flag for manual review
    }

    const db = getSupabase();

    // Get agent info
    const { data: agent, error: agentError } = await db
      .from('agents')
      .select('id, xp, trust_tier, missions_completed')
      .eq('id', auth.agentId)
      .single();

    if (agentError || !agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 403 });
    }

    // Get claim (verify it belongs to this agent)
    const { data: claim, error: claimError } = await db
      .from('claims')
      .select('*')
      .eq('id', claim_id)
      .eq('agent_id', auth.agentId)
      .single();

    if (claimError || !claim) {
      return NextResponse.json({ error: 'Claim not found or unauthorized' }, { status: 404 });
    }

    if (claim.status !== 'pending') {
      return NextResponse.json({ error: `Claim already ${claim.status}` }, { status: 400 });
    }

    // Get mission
    const { data: mission } = await db
      .from('missions')
      .select('*')
      .eq('id', claim.mission_id)
      .single();

    if (!mission) {
      return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
    }

    // Update claim with proof
    await db
      .from('claims')
      .update({
        status: 'submitted',
        proof_url,
        proof_data,
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', claim_id);

    // Determine if this claim should be audited
    const auditRate = getAuditRate(agent.trust_tier);
    // 🛡️ SECURITY: Force audit if proof was flagged
    const shouldAudit = proofCheck.flagged || Math.random() * 100 < auditRate;

    let auditResult = null;

    if (shouldAudit) {
      // Create audit record (to be processed later)
      const { data: audit } = await db
        .from('audits')
        .insert({
          claim_id,
          audit_type: proofCheck.flagged ? 'security_flag' : 'random',
          check_method: 'pending',
          notes: proofCheck.flagged ? `Security flags: ${proofCheck.reasons.join(', ')}` : null,
        })
        .select()
        .single();

      auditResult = {
        audited: true,
        audit_id: audit?.id,
        security_flagged: proofCheck.flagged,
      };
    } else {
      // Auto-approve (no audit needed)
      await processApproval(db, claim, mission, agent);
      auditResult = { audited: false, auto_approved: true };
    }

    return NextResponse.json({
      success: true,
      message: shouldAudit
        ? 'Proof submitted! Your claim is being audited.'
        : 'Proof submitted and approved! XP awarded.',
      audit: auditResult,
    });

  } catch (err) {
    console.error('Submit error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Helper to process approved claims
async function processApproval(
  db: SupabaseClient,
  claim: any,
  mission: any,
  agent: any
) {
  const xpReward = mission.xp_reward || 0;
  const usdReward = mission.usd_reward || 0;

  // Update claim as verified
  await db
    .from('claims')
    .update({
      status: 'verified',
      verified_at: new Date().toISOString(),
      verified_by: 'auto',
      xp_released: xpReward,
      usd_released: usdReward,
      updated_at: new Date().toISOString(),
    })
    .eq('id', claim.id);

  // Award XP and USD to agent
  await db
    .from('agents')
    .update({
      xp: (agent.xp || 0) + xpReward,
      usd_balance: (Number(agent.usd_balance) || 0) + usdReward,
      total_earned: (Number(agent.total_earned) || 0) + usdReward,
      missions_completed: (agent.missions_completed || 0) + 1,
      updated_at: new Date().toISOString(),
      last_active_at: new Date().toISOString(),
    })
    .eq('id', agent.id);

  // Log XP transaction
  await db
    .from('xp_transactions')
    .insert({
      agent_id: agent.id,
      amount: xpReward,
      action: 'mission_complete',
      description: `Completed mission claim #${claim.id}`,
      mission_id: claim.mission_id,
      claim_id: claim.id,
    });

  // Update mission progress
  const newCount = mission.current_count + 1;
  const isComplete = newCount >= mission.target_count;

  await db
    .from('missions')
    .update({
      current_count: newCount,
      status: isComplete ? 'completed' : 'active',
      completed_at: isComplete ? new Date().toISOString() : null,
    })
    .eq('id', claim.mission_id);
}