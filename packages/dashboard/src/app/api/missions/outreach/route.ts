import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabase: SupabaseClient | null = null;
function getSupabase(): SupabaseClient {
  if (!supabase) {
    supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return supabase;
}

// GET /api/missions/outreach
// List outreach missions (public)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const platform = searchParams.get('platform'); // filter by email, linkedin, etc.
    const status = searchParams.get('status') || 'active';
    const limit = parseInt(searchParams.get('limit') || '50');

    const db = getSupabase();

    let query = db
      .from('missions')
      .select('id, target_name, target_platform, proof_type, success_criteria, usd_reward, requires_disclosure, created_at, target_list, target_count, max_claims')
      .eq('mission_type', 'outreach')
      .eq('status', status)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (platform) {
      query = query.eq('target_platform', platform);
    }

    const { data: missions, error } = await query;

    if (error) {
      console.error('Failed to fetch missions:', error);
      return NextResponse.json(
        { error: 'Failed to fetch missions' },
        { status: 500 }
      );
    }

    // Get claim counts for each mission
    const missionsWithCounts = await Promise.all(
      (missions || []).map(async (mission) => {
        const { count: claimsCount } = await db
          .from('claims')
          .select('id', { count: 'exact', head: true })
          .eq('mission_id', mission.id);

        const { count: verifiedCount } = await db
          .from('claims')
          .select(`id, outreach_proofs:outreach_proofs(id)`, { count: 'exact' })
          .eq('mission_id', mission.id)
          .eq('outreach_proofs.auto_verified', true);

        return {
          ...mission,
          claims_count: claimsCount || 0,
          verified_count: verifiedCount || 0,
          remaining_spots: mission.max_claims - (claimsCount || 0)
        };
      })
    );

    return NextResponse.json({
      success: true,
      missions: missionsWithCounts,
      count: missionsWithCounts.length,
      platform_filter: platform,
      status_filter: status
    });

  } catch (err) {
    console.error('Get missions error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST: Return API docs
export async function POST() {
  return NextResponse.json({
    message: 'Use GET to list missions, POST to /api/missions/outreach/create to create'
  });
}
