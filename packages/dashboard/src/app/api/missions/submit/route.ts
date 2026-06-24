import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { checkProofContent, getSecurityNotice } from '@/lib/security';
import { authenticateAPI } from '@/lib/middleware';
import { decideVerification } from '@/lib/verification';

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

    // 1) Verification engine (if the mission declares criteria/method).
    const verdict = await decideVerification({
      method: mission.verification_method,
      criteria: mission.acceptance_criteria,
      taskDescription: `${mission.title || mission.target_name || mission.mission_type}. ${mission.instructions || ''}`,
      proofUrl: proof_url,
      proofData: proof_data,
    });

    // 2) Decide the outcome (security flag always forces audit).
    let outcome: 'verified' | 'rejected' | 'audit';
    if (proofCheck.flagged) outcome = 'audit';
    else if (verdict) outcome = verdict.decision;
    else outcome = Math.random() * 100 < getAuditRate(agent.trust_tier) ? 'audit' : 'verified';

    let auditResult: Record<string, unknown>;

    if (outcome === 'rejected') {
      await db.from('claims').update({
        status: 'rejected',
        rejection_reason: verdict?.notes || 'failed verification',
        updated_at: new Date().toISOString(),
      }).eq('id', claim_id);
      // Slash: the stake locked at claim time is forfeited (not returned).
      const slashed = claim.stake_held || 0;
      if (slashed > 0) {
        await db.from('transactions').insert({
          agent_id: auth.agentId, amount: -slashed, type: 'xp', action: 'stake_slash',
          description: `Stake slashed — rejected claim #${claim_id}`, claim_id,
        }).then(undefined, () => {});
      }
      return NextResponse.json({
        success: true,
        message: slashed > 0 ? `Proof rejected — ${slashed} XP stake slashed.` : 'Proof rejected by verification.',
        audit: { audited: false, rejected: true, slashed, notes: verdict?.notes },
      });
    } else if (outcome === 'audit') {
      const { data: audit } = await db
        .from('audits')
        .insert({
          claim_id,
          audit_type: proofCheck.flagged ? 'security_flag' : 'verification',
          check_method: 'pending',
          notes: proofCheck.flagged ? `Security flags: ${proofCheck.reasons.join(', ')}` : (verdict?.notes || null),
        })
        .select()
        .single();
      auditResult = { audited: true, audit_id: audit?.id, security_flagged: proofCheck.flagged, notes: verdict?.notes };
    } else {
      // verified — release reward
      await processApproval(db, claim, mission, agent);
      auditResult = { audited: false, auto_approved: true, score: verdict?.score, notes: verdict?.notes };
    }

    return NextResponse.json({
      success: true,
      message: outcome === 'audit'
        ? 'Proof submitted! Your claim is under verification.'
        : 'Proof submitted and approved! Reward released.',
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
  const stakeReturn = claim.stake_held || 0; // collateral returned on success

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

  // Re-read current balances so we never clobber USD on an XP-only mission.
  const { data: fresh } = await db
    .from('agents')
    .select('xp, usd_balance, total_earned, missions_completed')
    .eq('id', agent.id)
    .single();

  await db
    .from('agents')
    .update({
      xp: (fresh?.xp || 0) + xpReward + stakeReturn, // reward + returned stake
      usd_balance: (Number(fresh?.usd_balance) || 0) + usdReward,
      total_earned: (Number(fresh?.total_earned) || 0) + usdReward,
      missions_completed: (fresh?.missions_completed || 0) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', agent.id);

  // Log XP transaction(s)
  await db.from('xp_transactions').insert({
    agent_id: agent.id,
    amount: xpReward,
    action: 'mission_complete',
    description: `Completed mission claim #${claim.id}`,
    mission_id: claim.mission_id,
    claim_id: claim.id,
  });
  if (stakeReturn > 0) {
    await db.from('transactions').insert({
      agent_id: agent.id, amount: stakeReturn, type: 'xp', action: 'stake_return',
      description: `Stake returned for verified claim #${claim.id}`, claim_id: claim.id,
    }).then(undefined, () => {});
  }

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