import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase, maybeSettleCrew } from '@/lib/crew';

// POST /api/crews/:id/settle
// Attempt to settle a crew (split the pot). Idempotent and safe to retry:
// settle_crew() only pays out when EVERY role is verified, and refuses to
// double-pay a completed crew. Used by automation and by admins after a
// manually-audited role is approved.
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const crewId = parseInt(id, 10);
    if (Number.isNaN(crewId)) {
      return NextResponse.json({ error: 'Invalid crew id' }, { status: 400 });
    }

    const db = getServiceSupabase();
    const result = await maybeSettleCrew(db, crewId);

    if (!result) {
      return NextResponse.json(
        { success: false, settled: false, message: 'Crew not ready — roles still incomplete.' },
        { status: 409 }
      );
    }
    if (!result.ok) {
      return NextResponse.json({ success: false, settled: false, ...result }, { status: 409 });
    }

    return NextResponse.json({ success: true, settled: true, settlement: result });
  } catch (err) {
    console.error('Crew settle error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
