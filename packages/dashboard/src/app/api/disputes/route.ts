import { NextRequest, NextResponse } from 'next/server';
import { authenticateAPI } from '@/lib/middleware';
import { getServiceSupabase } from '@/lib/crew';

// GET /api/disputes?status=open — list disputes (public read).
export async function GET(request: NextRequest) {
  const status = request.nextUrl.searchParams.get('status') || 'open';
  const db = getServiceSupabase();
  let q = db.from('disputes').select('*').order('created_at', { ascending: false }).limit(100);
  if (status !== 'all') q = q.eq('status', status);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: 'Failed to load disputes' }, { status: 500 });
  return NextResponse.json({ success: true, disputes: data || [] });
}

// POST /api/disputes — an agent challenges a verification decision.
// Body: { target_type: 'claim'|'crew_subtask', target_id, reason, evidence_url? }
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateAPI(request, true);
    if (!auth.authenticated || !auth.agentId) {
      return NextResponse.json({ error: 'Authentication required', details: auth.error }, { status: 401 });
    }
    const { target_type, target_id, reason, evidence_url } = await request.json();
    if (!['claim', 'crew_subtask'].includes(target_type) || !target_id || !reason) {
      return NextResponse.json({ error: 'target_type (claim|crew_subtask), target_id and reason are required' }, { status: 400 });
    }

    const db = getServiceSupabase();
    const { data, error } = await db
      .from('disputes')
      .insert({
        target_type,
        target_id: String(target_id),
        raised_by: auth.agentId,
        reason: String(reason).slice(0, 2000),
        evidence_url: evidence_url || null,
        status: 'open',
      })
      .select()
      .single();

    if (error) {
      console.error('Dispute create error:', error);
      return NextResponse.json({ error: 'Failed to raise dispute' }, { status: 500 });
    }
    return NextResponse.json({ success: true, dispute: data, message: 'Dispute raised. It will be reviewed.' });
  } catch (err) {
    console.error('Dispute POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
