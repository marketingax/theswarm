import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/crew';

// GET /api/crews/:id — full crew detail (goal, roles, members, payouts).
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const crewId = parseInt(id, 10);
  if (Number.isNaN(crewId)) {
    return NextResponse.json({ error: 'Invalid crew id' }, { status: 400 });
  }

  const db = getServiceSupabase();

  const { data: crew, error } = await db
    .from('crew_missions')
    .select('*')
    .eq('id', crewId)
    .single();

  if (error || !crew) {
    return NextResponse.json({ error: 'Crew not found' }, { status: 404 });
  }

  const [{ data: subtasks }, { data: members }, { data: payouts }] = await Promise.all([
    db.from('crew_subtasks').select('*').eq('crew_mission_id', crewId).order('id', { ascending: true }),
    db.from('crew_members')
      .select('agent_id, roles_claimed, joined_at, agents(name, avatar_url, collaboration_score)')
      .eq('crew_mission_id', crewId),
    db.from('crew_payouts').select('*').eq('crew_mission_id', crewId),
  ]);

  const pot = crew.reward_type === 'usd' ? Number(crew.usd_pot) : Number(crew.xp_pot);

  return NextResponse.json({
    success: true,
    crew: {
      ...crew,
      pot,
      subtasks: (subtasks || []).map((s) => ({
        ...s,
        // Convenience: resolved value of this role's share of the pot.
        share_value: Math.round(pot * (s.share_pct / 100) * 100) / 100,
      })),
      members: members || [],
      payouts: payouts || [],
    },
  });
}
