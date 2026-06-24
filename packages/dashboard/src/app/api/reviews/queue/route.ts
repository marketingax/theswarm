import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/crew';

// GET /api/reviews/queue?agent_id=...
// Work awaiting peer review that this agent is eligible to review: submissions
// using verification_method='peer', excluding the agent's own work and items it
// already voted on. Reviewers earn XP — this is the free verification backbone.
export async function GET(request: NextRequest) {
  const agentId = request.nextUrl.searchParams.get('agent_id');
  if (!agentId) return NextResponse.json({ error: 'agent_id is required' }, { status: 400 });

  const db = getServiceSupabase();

  // Items this agent has already reviewed (exclude them).
  const { data: mine } = await db
    .from('peer_reviews').select('target_type, target_id').eq('reviewer_agent_id', agentId);
  const reviewed = new Set((mine || []).map((r) => `${r.target_type}:${r.target_id}`));

  // Claims in peer review.
  const { data: claims } = await db
    .from('claims')
    .select('id, mission_id, agent_id, proof_url, proof_data, reviews_for, reviews_against, missions!inner(title, target_name, type, mission_type, xp_reward, verification_method)')
    .eq('status', 'submitted')
    .eq('missions.verification_method', 'peer')
    .neq('agent_id', agentId);

  // Crew roles in peer review.
  const { data: subtasks } = await db
    .from('crew_subtasks')
    .select('id, crew_mission_id, title, assigned_agent_id, proof_url, proof_data, reviews_for, reviews_against')
    .eq('status', 'submitted')
    .eq('verification_method', 'peer')
    .neq('assigned_agent_id', agentId);

  const items = [
    ...(claims || [])
      .filter((c: any) => !reviewed.has(`claim:${c.id}`))
      .map((c: any) => ({
        target_type: 'claim',
        target_id: String(c.id),
        title: c.missions?.title || c.missions?.target_name || c.missions?.mission_type || c.missions?.type,
        proof_url: c.proof_url,
        proof_data: c.proof_data,
        votes: { approve: c.reviews_for || 0, reject: c.reviews_against || 0 },
        reward_xp: c.missions?.xp_reward || 0,
      })),
    ...(subtasks || [])
      .filter((s: any) => !reviewed.has(`crew_subtask:${s.id}`))
      .map((s: any) => ({
        target_type: 'crew_subtask',
        target_id: String(s.id),
        title: s.title,
        crew_id: s.crew_mission_id,
        proof_url: s.proof_url,
        proof_data: s.proof_data,
        votes: { approve: s.reviews_for || 0, reject: s.reviews_against || 0 },
      })),
  ];

  return NextResponse.json({ success: true, queue: items, count: items.length });
}
