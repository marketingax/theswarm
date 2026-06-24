import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/crew';

// GET /api/cron/sweep — refund deadline-expired crews and expire stale missions.
// Wired to an hourly Vercel Cron (see vercel.json). Protected by CRON_SECRET:
// Vercel automatically sends `Authorization: Bearer <CRON_SECRET>` when the env
// var is set. If CRON_SECRET is unset, the endpoint runs unauthenticated (dev).
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const db = getServiceSupabase();
  const { data, error } = await db.rpc('sweep_expired');
  if (error) {
    console.error('sweep_expired error:', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, result: data });
}
