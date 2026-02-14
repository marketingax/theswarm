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

    // Get total agents
    const { count: totalAgents } = await db
      .from('agents')
      .select('*', { count: 'exact', head: true });

    // Get active today (updated in last 24h)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: activeToday } = await db
      .from('agents')
      .select('*', { count: 'exact', head: true })
      .gte('updated_at', oneDayAgo);

    // Get missions by time period
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { count: missions24h } = await db
      .from('missions')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', twentyFourHoursAgo);

    const { count: missions7d } = await db
      .from('missions')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', sevenDaysAgo);

    const { count: missions30d } = await db
      .from('missions')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', thirtyDaysAgo);

    // Get completion rate
    const { data: completedMissions } = await db
      .from('missions')
      .select('id')
      .eq('status', 'completed');

    const { count: allMissions } = await db
      .from('missions')
      .select('*', { count: 'exact', head: true });

    const avgCompletionRate =
      allMissions && allMissions > 0
        ? ((completedMissions?.length || 0) / allMissions) * 100
        : 0;

    // Get top 10 agents by XP
    const { data: topAgents } = await db
      .from('agents')
      .select('id, name, rank_title, xp')
      .order('xp', { ascending: false })
      .limit(10);

    // Get top 10 mission creators
    const { data: allCreators } = await db
      .from('missions')
      .select('creator_id')
      .not('creator_id', 'is', null);

    const creatorCounts: Record<string, number> = {};
    if (allCreators) {
      allCreators.forEach(m => {
        if (m.creator_id) {
          creatorCounts[m.creator_id] = (creatorCounts[m.creator_id] || 0) + 1;
        }
      });
    }

    const topCreatorIds = Object.entries(creatorCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([id]) => id);

    const { data: topCreatorAgents } = await db
      .from('agents')
      .select('id, name')
      .in('id', topCreatorIds);

    const topCreators = (topCreatorAgents || [])
      .map(agent => ({
        id: agent.id,
        name: agent.name,
        missions_created: creatorCounts[agent.id] || 0,
      }))
      .sort((a, b) => b.missions_created - a.missions_created);

    return NextResponse.json({
      success: true,
      metrics: {
        total_agents: totalAgents || 0,
        active_today: activeToday || 0,
        missions_24h: missions24h || 0,
        missions_7d: missions7d || 0,
        missions_30d: missions30d || 0,
        avg_completion_rate: avgCompletionRate,
        top_agents: topAgents || [],
        top_creators: topCreators,
      },
    });
  } catch (error) {
    console.error('Metrics error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load metrics' },
      { status: 500 }
    );
  }
}
