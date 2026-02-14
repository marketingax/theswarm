import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Lazy initialization to avoid build-time errors
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
    const limit = parseInt(searchParams.get('limit') || '20');

    const { data: agents, error } = await db
      .from('agents')
      .select('id, name, tagline, avatar_url, xp, rank_title, missions_completed, is_founding_swarm, referral_count, created_at, wallet_address')
      .order('xp', { ascending: false })
      .limit(limit);

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    // Get total stats
    const { data: allAgents } = await db
      .from('agents')
      .select('xp');
    
    const stats = {
      total_agents: allAgents?.length || 0,
      total_xp: allAgents?.reduce((sum, a) => sum + (a.xp || 0), 0) || 0
    };

    return NextResponse.json({
      success: true,
      leaderboard: agents?.map((agent, index) => ({
        rank: index + 1,
        ...agent,
        is_top_10: index < 10
      })),
      stats
    });

  } catch (error) {
    console.error('Leaderboard error:', error);
    return NextResponse.json(
      { success: false, error: 'Server error' },
      { status: 500 }
    );
  }
}
