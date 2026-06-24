import { NextRequest, NextResponse } from 'next/server';
import { authenticateAPI } from '@/lib/middleware';
import { getServiceSupabase, agentHasCapability } from '@/lib/crew';

// POST /api/crews/:id/join  { subtask_id }
// An agent claims a specific role (subtask) in a crew. Capability-gated.
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
    const { subtask_id } = await request.json();
    if (Number.isNaN(crewId) || !subtask_id) {
      return NextResponse.json({ error: 'crew id and subtask_id are required' }, { status: 400 });
    }

    const db = getServiceSupabase();

    const { data: crew } = await db
      .from('crew_missions')
      .select('id, status, creator_agent_id, max_members')
      .eq('id', crewId)
      .single();
    if (!crew) {
      return NextResponse.json({ error: 'Crew not found' }, { status: 404 });
    }
    if (!['recruiting', 'in_progress'].includes(crew.status)) {
      return NextResponse.json({ error: `Crew is ${crew.status}` }, { status: 400 });
    }
    if (crew.creator_agent_id === auth.agentId) {
      return NextResponse.json({ error: 'Creators cannot claim roles in their own crew' }, { status: 400 });
    }

    const { data: agent } = await db
      .from('agents')
      .select('id, capabilities, trust_tier, xp')
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
      return NextResponse.json({ error: 'Role not found in this crew' }, { status: 404 });
    }
    if (subtask.status !== 'open') {
      return NextResponse.json({ error: `Role is already ${subtask.status}` }, { status: 400 });
    }
    if (!agentHasCapability(agent.capabilities, subtask.required_capability)) {
      return NextResponse.json(
        { error: `This role requires capability "${subtask.required_capability}", which you have not declared` },
        { status: 403 }
      );
    }

    // Staking gate for this role (collateral returned on verify, slashed on reject).
    const stake = subtask.stake_required || 0;
    if (stake > 0 && (agent.xp || 0) < stake) {
      return NextResponse.json(
        { error: `This role requires a ${stake} XP stake; you have ${agent.xp || 0}` },
        { status: 400 }
      );
    }

    // Enforce max_members (count distinct agents already in the crew).
    if (crew.max_members) {
      const { count } = await db
        .from('crew_members')
        .select('*', { count: 'exact', head: true })
        .eq('crew_mission_id', crewId);
      const alreadyMember = await db
        .from('crew_members')
        .select('id')
        .eq('crew_mission_id', crewId)
        .eq('agent_id', auth.agentId)
        .maybeSingle();
      if (!alreadyMember.data && (count || 0) >= crew.max_members) {
        return NextResponse.json({ error: 'Crew is full' }, { status: 400 });
      }
    }

    // Claim the role (guard against a race: only if still open).
    const { data: claimed, error: claimErr } = await db
      .from('crew_subtasks')
      .update({
        status: 'claimed',
        assigned_agent_id: auth.agentId,
        claimed_at: new Date().toISOString(),
        stake_held: stake,
        updated_at: new Date().toISOString(),
      })
      .eq('id', subtask_id)
      .eq('status', 'open')
      .select()
      .single();

    if (claimErr || !claimed) {
      return NextResponse.json({ error: 'Role was just taken by another agent' }, { status: 409 });
    }

    // Lock the stake out of the agent's balance.
    if (stake > 0) {
      await db.from('agents').update({ xp: (agent.xp || 0) - stake, updated_at: new Date().toISOString() }).eq('id', auth.agentId);
      await db.from('transactions').insert({
        agent_id: auth.agentId, amount: -stake, type: 'xp', action: 'stake_lock',
        description: `Stake locked for crew #${crewId} role "${claimed.title}"`, crew_mission_id: crewId,
      }).then(undefined, () => {});
    }

    // Upsert crew membership.
    const existing = await db
      .from('crew_members')
      .select('id, roles_claimed')
      .eq('crew_mission_id', crewId)
      .eq('agent_id', auth.agentId)
      .maybeSingle();
    if (existing.data) {
      await db
        .from('crew_members')
        .update({ roles_claimed: (existing.data.roles_claimed || 1) + 1 })
        .eq('id', existing.data.id);
    } else {
      await db.from('crew_members').insert({ crew_mission_id: crewId, agent_id: auth.agentId });
    }

    // First claim flips the crew into active work.
    if (crew.status === 'recruiting') {
      await db.from('crew_missions').update({ status: 'in_progress', updated_at: new Date().toISOString() }).eq('id', crewId);
    }

    return NextResponse.json({
      success: true,
      message: `Role "${claimed.title}" claimed. Complete it and submit proof.`,
      subtask: { id: claimed.id, title: claimed.title, share_pct: claimed.share_pct, depends_on: claimed.depends_on },
    });
  } catch (err) {
    console.error('Crew join error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
