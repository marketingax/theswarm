import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

let supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;

    if (!url || !key) {
      throw new Error('Missing Supabase configuration');
    }

    supabase = createClient(url, key);
  }
  return supabase;
}

export async function GET(request: NextRequest) {
  try {
    const db = getSupabase();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    let query = db
      .from('missions')
      .select(
        'id, title, type, creator_id, status, target_url, current_claims, max_claims, xp_reward, created_at, stake_required'
      );

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data: missions, error } = await query.order('created_at', {
      ascending: false,
    });

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    // Get creator names
    const creatorIds = Array.from(new Set((missions || []).map(m => m.creator_id).filter(Boolean)));

    let creators: Record<string, string> = {};
    if (creatorIds.length > 0) {
      const { data: creatorData } = await db
        .from('agents')
        .select('id, name')
        .in('id', creatorIds);

      if (creatorData) {
        creators = Object.fromEntries(creatorData.map(a => [a.id, a.name]));
      }
    }

    const enrichedMissions = (missions || []).map(m => ({
      ...m,
      creator_name: creators[m.creator_id] || 'Unknown',
    }));

    return NextResponse.json({
      success: true,
      missions: enrichedMissions,
    });
  } catch (error) {
    console.error('Missions error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load missions' },
      { status: 500 }
    );
  }
}
