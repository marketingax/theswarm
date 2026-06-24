import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase, agentHasCapability } from '@/lib/crew';

// GET /api/missions/match?agent_id=...
// Solo-mission self-dispatch: returns active missions this agent is capable of
// and hasn't already claimed, with open slots remaining (current_count <
// target_count). This is what powers `theswarm missions auto` — agents finding
// and filling work like "this channel needs 1000 subscribers" one slot each.
//
// Capability rule: an agent can do a mission of type T if it has declared
// capability T, or the wildcard 'auto' / 'all'. Missions of type 'custom' are
// excluded from auto-matching (they need human judgement).
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

  const caps: string[] = Array.isArray(agent.capabilities)
    ? agent.capabilities.map((c: unknown) => String(c).toLowerCase())
    : [];
  const wildcard = caps.includes('auto') || caps.includes('all');

  // Active missions with open slots, not created by this agent.
  // NOTE: prod uses `type` as the canonical column; `mission_type` is legacy
  // and may be null — match against whichever is present.
  const { data: missions, error } = await db
    .from('missions')
    .select('id, type, mission_type, target_name, target_url, target_count, current_count, xp_reward, usd_reward, instructions, requester_agent_id, status')
    .eq('status', 'active')
    .neq('requester_agent_id', agentId);
  if (error) {
    console.error('Mission match error:', error);
    return NextResponse.json({ error: 'Failed to match missions' }, { status: 500 });
  }

  // Missions this agent already claimed (exclude — one slot per agent).
  const { data: myClaims } = await db
    .from('claims')
    .select('mission_id')
    .eq('agent_id', agentId);
  const claimed = new Set((myClaims || []).map((c) => c.mission_id));

  const effType = (m: { mission_type?: string | null; type?: string | null }) =>
    (m.mission_type || m.type || '').toLowerCase();

  const matches = (missions || [])
    .filter((m) => (m.current_count || 0) < (m.target_count || 1)) // slots left
    .filter((m) => !claimed.has(m.id))
    .filter((m) => effType(m) && effType(m) !== 'custom')
    .filter((m) => wildcard || agentHasCapability(caps, effType(m)))
    .map((m) => ({
      mission_id: m.id,
      mission_type: effType(m),
      target_name: m.target_name,
      target_url: m.target_url,
      slots_left: (m.target_count || 1) - (m.current_count || 0),
      xp_reward: m.xp_reward || 0,
      usd_reward: Number(m.usd_reward) || 0,
      instructions: m.instructions || '',
    }));

  return NextResponse.json({ success: true, matches, count: matches.length });
}
