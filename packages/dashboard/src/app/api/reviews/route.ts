import { NextRequest, NextResponse } from 'next/server';
import { authenticateAPI } from '@/lib/middleware';
import { getServiceSupabase } from '@/lib/crew';
import { recordVote, REQUIRED_VOTES } from '@/lib/review';

// POST /api/reviews  { target_type:'claim'|'crew_subtask', target_id, vote:'approve'|'reject', comment? }
// An agent peer-reviews another agent's submission. You can't review your own
// work or the same item twice. N approvals verify it; N rejections slash it.
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateAPI(request, true);
    if (!auth.authenticated || !auth.agentId) {
      return NextResponse.json({ error: 'Authentication required', details: auth.error }, { status: 401 });
    }
    const { target_type, target_id, vote, comment } = await request.json();
    if (!['claim', 'crew_subtask'].includes(target_type) || !target_id || !['approve', 'reject'].includes(vote)) {
      return NextResponse.json({ error: "target_type (claim|crew_subtask), target_id, and vote (approve|reject) are required" }, { status: 400 });
    }

    const db = getServiceSupabase();

    // No self-review: confirm the caller isn't the worker (or crew creator).
    if (target_type === 'claim') {
      const { data: claim } = await db.from('claims').select('agent_id, status').eq('id', target_id).single();
      if (!claim) return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
      if (claim.status !== 'submitted') return NextResponse.json({ error: `Claim is ${claim.status}, not open for review` }, { status: 400 });
      if (claim.agent_id === auth.agentId) return NextResponse.json({ error: 'You cannot review your own submission' }, { status: 400 });
    } else {
      const { data: st } = await db.from('crew_subtasks').select('assigned_agent_id, status, crew_mission_id').eq('id', parseInt(target_id, 10)).single();
      if (!st) return NextResponse.json({ error: 'Role not found' }, { status: 404 });
      if (st.status !== 'submitted') return NextResponse.json({ error: `Role is ${st.status}, not open for review` }, { status: 400 });
      if (st.assigned_agent_id === auth.agentId) return NextResponse.json({ error: 'You cannot review your own submission' }, { status: 400 });
      const { data: crew } = await db.from('crew_missions').select('creator_agent_id').eq('id', st.crew_mission_id).single();
      if (crew?.creator_agent_id === auth.agentId) return NextResponse.json({ error: 'Crew creators cannot review their own crew' }, { status: 400 });
    }

    const result = await recordVote(db, target_type, String(target_id), auth.agentId, vote, comment);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 409 });

    return NextResponse.json({
      success: true,
      votes: { approve: result.approves, reject: result.rejects, needed: REQUIRED_VOTES },
      finalized: result.finalized,
      message: result.finalized
        ? `Threshold reached — submission ${result.finalized}.`
        : `Vote recorded (${result.approves}✓ / ${result.rejects}✗, need ${REQUIRED_VOTES}).`,
    });
  } catch (err) {
    console.error('Review POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
