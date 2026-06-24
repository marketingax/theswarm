import { NextRequest, NextResponse } from 'next/server';
import { authenticateAPI } from '@/lib/middleware';
import { checkProofContent } from '@/lib/security';
import { getServiceSupabase, getAuditRate, maybeSettleCrew } from '@/lib/crew';
import { decideVerification } from '@/lib/verification';

// POST /api/crews/:id/submit  { subtask_id, proof_url, proof_data? }
// Submit proof for a role you hold. Auto-verifies based on trust tier (or
// queues an audit). When the LAST role verifies, the pot is split atomically.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateAPI(request, true);
    if (!auth.authenticated || !auth.agentId) {
      return NextResponse.json(
        { error: 'Authentication required', details: auth.error },
        { status: 401 }
      );
    }

    const { id } = await params;
    const crewId = parseInt(id, 10);
    const { subtask_id, proof_url, proof_data } = await request.json();
    if (Number.isNaN(crewId) || !subtask_id) {
      return NextResponse.json({ error: 'crew id and subtask_id are required' }, { status: 400 });
    }

    const db = getServiceSupabase();

    const { data: agent } = await db
      .from('agents')
      .select('id, trust_tier')
      .eq('id', auth.agentId)
      .single();
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 403 });
    }

    const { data: subtask } = await db
      .from('crew_subtasks')
      .select('*')
      .eq('id', subtask_id)
      .eq('crew_mission_id', crewId)
      .single();
    if (!subtask) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 });
    }
    if (subtask.assigned_agent_id !== auth.agentId) {
      return NextResponse.json({ error: 'You do not hold this role' }, { status: 403 });
    }
    if (subtask.status !== 'claimed') {
      return NextResponse.json({ error: `Role is ${subtask.status}, cannot submit` }, { status: 400 });
    }

    // Dependency gate: a role can't be submitted until the role it depends on
    // is verified (e.g. creatives depend on copy being approved first).
    if (subtask.depends_on) {
      const { data: dep } = await db
        .from('crew_subtasks')
        .select('status, title')
        .eq('id', subtask.depends_on)
        .single();
      if (dep && dep.status !== 'verified') {
        return NextResponse.json(
          { error: `Blocked: dependency role "${dep.title}" must be verified first` },
          { status: 409 }
        );
      }
    }

    const proofCheck = checkProofContent(proof_url, proof_data);

    await db
      .from('crew_subtasks')
      .update({
        status: 'submitted',
        proof_url,
        proof_data,
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', subtask_id);

    // 1) Run the verification engine if this role declares criteria/method.
    const verdict = await decideVerification({
      method: subtask.verification_method,
      criteria: subtask.acceptance_criteria,
      taskDescription: `${subtask.title}. ${subtask.instructions || ''}`,
      proofUrl: proof_url,
      proofData: proof_data,
    });

    // Security flag always forces an audit regardless of the verdict.
    let outcome: 'verified' | 'rejected' | 'audit';
    let notes = verdict?.notes || '';
    let score = verdict?.score ?? null;

    if (proofCheck.flagged) {
      outcome = 'audit';
      notes = `security flag: ${proofCheck.reasons.join(', ')}`;
    } else if (verdict) {
      outcome = verdict.decision;
    } else {
      // 2) Legacy fallback: trust-tier + random audit.
      outcome = Math.random() * 100 < getAuditRate(agent.trust_tier) ? 'audit' : 'verified';
    }

    if (outcome === 'rejected') {
      // Slash the worker's stake, then reopen the role (stake is NOT returned).
      const slashed = subtask.stake_held || 0;
      if (slashed > 0) {
        await db.from('transactions').insert({
          agent_id: auth.agentId, amount: -slashed, type: 'xp', action: 'stake_slash',
          description: `Stake slashed — rejected crew #${crewId} role "${subtask.title}"`, crew_mission_id: crewId,
        }).then(undefined, () => {});
      }
      await db.from('crew_subtasks').update({
        status: 'open', assigned_agent_id: null, claimed_at: null, stake_held: 0,
        rejection_reason: notes, verification_score: score, verification_notes: notes,
        updated_at: new Date().toISOString(),
      }).eq('id', subtask_id);
      return NextResponse.json({ success: true, message: slashed > 0 ? `Proof rejected — ${slashed} XP stake slashed, role reopened.` : 'Proof rejected by verification — role reopened.', verified: false, rejected: true, slashed, notes });
    }

    if (outcome === 'audit') {
      await db.from('crew_subtasks').update({ verification_score: score, verification_notes: notes }).eq('id', subtask_id);
      await db.from('audits').insert({
        crew_subtask_id: subtask_id,
        audit_type: proofCheck.flagged ? 'security_flag' : 'verification',
        check_method: 'pending',
        notes: notes || 'crew role audit',
      }).then(undefined, () => {/* non-fatal */});
      return NextResponse.json({ success: true, message: 'Proof submitted — under review before payout.', audited: true, notes });
    }

    // outcome === 'verified'
    await db.from('crew_subtasks').update({
      status: 'verified', verified_at: new Date().toISOString(),
      verified_by: verdict ? subtask.verification_method : 'auto',
      verification_score: score, verification_notes: notes,
      updated_at: new Date().toISOString(),
    }).eq('id', subtask_id);

    // Return the staked collateral now that the role passed (reward comes at settle).
    const stakeBack = subtask.stake_held || 0;
    if (stakeBack > 0) {
      const { data: a } = await db.from('agents').select('xp').eq('id', auth.agentId).single();
      await db.from('agents').update({ xp: (a?.xp || 0) + stakeBack, updated_at: new Date().toISOString() }).eq('id', auth.agentId);
      await db.from('transactions').insert({
        agent_id: auth.agentId, amount: stakeBack, type: 'xp', action: 'stake_return',
        description: `Stake returned for verified crew #${crewId} role`, crew_mission_id: crewId,
      }).then(undefined, () => {});
    }

    const settle = await maybeSettleCrew(db, crewId);
    return NextResponse.json({
      success: true,
      message: settle?.ok
        ? 'Final role verified — crew complete, pot split to all members!'
        : 'Role verified. Waiting on the rest of the crew.',
      verified: true,
      settled: settle?.ok || false,
      settlement: settle || null,
      notes,
    });
  } catch (err) {
    console.error('Crew submit error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
