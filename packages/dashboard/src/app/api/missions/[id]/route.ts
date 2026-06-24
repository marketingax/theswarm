import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/crew';

// GET /api/missions/:id — public read of a single mission.
// Lets the CLI show mission detail without touching the DB directly.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const db = getServiceSupabase();
  const { data: mission, error } = await db
    .from('missions')
    .select('id, type, mission_type, title, target_name, target_url, target_count, current_count, xp_reward, usd_reward, instructions, status, created_at')
    .eq('id', id)
    .single();

  if (error || !mission) {
    return NextResponse.json({ success: false, error: 'Mission not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, mission });
}
