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
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = 20;
    const offset = (page - 1) * pageSize;

    const { data: agents, error } = await db
      .from('agents')
      .select(
        'id, name, xp, rank_title, trust_tier, missions_completed, is_verified, created_at, wallet_address'
      )
      .order('xp', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    // Get total count
    const { count: totalAgents } = await db
      .from('agents')
      .select('*', { count: 'exact', head: true });

    return NextResponse.json({
      success: true,
      agents: agents || [],
      total: totalAgents || 0,
      page,
      pageSize,
    });
  } catch (error) {
    console.error('Agents error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load agents' },
      { status: 500 }
    );
  }
}
