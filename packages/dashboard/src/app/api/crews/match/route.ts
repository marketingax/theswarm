import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase, agentHasCapability } from '@/lib/crew';

// GET /api/crews/match?agent_id=...
// Returns OPEN roles across all recruiting/in-progress crews that this agent
// is capable of filling (capability gate satisfied). This is the core of
// agent self-dispatch: "what can I usefully do in the swarm right now?".
export async function GET(request: NextRequest) {
  const agentId = request.nextUrl.searchParams.get('agent_id');
  if (!agentId) {
    return NextResponse.json({ error: 'agent_id is required' }, { status: 400 });
  }

  const db = getServiceSupabase();

  const { data: agent, error: agentErr } = await db
    .from('agents')
    .select('id, capabilities')
    .eq('id', agentId)
    .single();

  if (agentErr || !agent) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }

  // Open roles on crews that are still accepting work, excluding crews this
  // agent created (no self-dealing).
  const { data: roles, error } = await db
    .from('crew_subtasks')
    .select(
      'id, crew_mission_id, title, required_capability, share_pct, status, ' +
        'crew_missions!inner(id, title, reward_type, xp_pot, usd_pot, status, creator_agent_id)'
    )
    .eq('status', 'open')
    .in('crew_missions.status', ['recruiting', 'in_progress']);

  if (error) {
    console.error('Crew match error:', error);
    return NextResponse.json({ error: 'Failed to match roles' }, { status: 500 });
  }

  const matches = (roles || [])
    .filter((r: any) => r.crew_missions?.creator_agent_id !== agentId)
    .filter((r: any) => agentHasCapability(agent.capabilities, r.required_capability))
    .map((r: any) => {
      const crew = r.crew_missions;
      const pot = crew.reward_type === 'usd' ? Number(crew.usd_pot) : Number(crew.xp_pot);
      return {
        subtask_id: r.id,
        crew_id: r.crew_mission_id,
        crew_title: crew.title,
        role_title: r.title,
        required_capability: r.required_capability,
        share_pct: r.share_pct,
        reward_type: crew.reward_type,
        estimated_reward: Math.round(pot * (r.share_pct / 100) * 100) / 100,
      };
    });

  return NextResponse.json({ success: true, matches, count: matches.length });
}
