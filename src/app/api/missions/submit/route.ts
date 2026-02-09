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

// POST /api/missions/submit - Submit proof for a claim
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { claim_id, agent_id, wallet_address, proof_url, proof_data } = body;

    if (!claim_id || !agent_id || !wallet_address) {
      return NextResponse.json(
        { error: 'claim_id, agent_id, and wallet_address required' },
        { status: 400 }
      );
    }

    const db = getSupabase();

    // Verify agent
    const { data: agent, error: agentError } = await db
      .from('agents')
      .select('id, xp, trust_tier, missions_completed')
      .eq('id', agent_id)
      .eq('wallet_address', wallet_address)
      .single();

    if (agentError || !agent) {
      return NextResponse.json({ error: 'Agent not found or wallet mismatch' }, { status: 403 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const agentData = agent as any;

    // Get claim with mission
    const { data: claim, error: claimError } = await db
      .from('claims')
      .select('*')
      .eq('id', claim_id)
      .eq('agent_id', agent_id)
      .single();

    if (claimError || !claim) {
      return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const claimData = claim as any;

    if (claimData.status !== 'pending') {
      return NextResponse.json({ error: `Claim already ${claimData.status}` }, { status: 400 });
    }

    // Get mission
    const { data: mission } = await db
      .from('missions')
      .select('*')
      .eq('id', claimData.mission_id)
      .single();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const missionData = mission as any;

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
    const auditRate = getAuditRate(agentData.trust_tier);
    const shouldAudit = Math.random() * 100 < auditRate;

    let auditResult = null;

    if (shouldAudit) {
      // Create audit record (to be processed later)
      const { data: audit } = await db
        .from('audits')
        .insert({
          claim_id,
          audit_type: 'random',
          check_method: 'pending',
        })
        .select()
        .single();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const auditData = audit as any;
      auditResult = { audited: true, audit_id: auditData?.id };
    } else {
      // Auto-approve (no audit needed)
      await processApproval(db, claimData, missionData, agentData);
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  claim: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mission: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  agent: any
) {
  const xpReward = mission.xp_reward;

  // Update claim as verified
  await db
    .from('claims')
    .update({
      status: 'verified',
      verified_at: new Date().toISOString(),
      verified_by: 'auto',
      xp_released: xpReward,
      updated_at: new Date().toISOString(),
    })
    .eq('id', claim.id);

  // Award XP to agent
  await db
    .from('agents')
    .update({
      xp: agent.xp + xpReward,
      missions_completed: agent.missions_completed + 1,
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
