import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

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
    const auth = await requireAuth(request);
    if (!auth.authenticated || !auth.agentId) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const db = getSupabase();

    const { data: actor } = await db
      .from('agents')
      .select('is_admin')
      .eq('id', auth.agentId)
      .single();

    if (actor?.is_admin !== true) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      );
    }

    const { data: history, error } = await db
      .from('trust_history')
      .select(
        'id, agent_id, old_tier, new_tier, reason, created_at, changed_by, agent:agents!trust_history_agent_id_fkey(name)'
      )
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    const transformedHistory = (history || []).map((entry: any) => ({
      id: entry.id,
      agent_id: entry.agent_id,
      agent_name: entry.agent?.name || entry.agent_id,
      previous_tier: entry.old_tier,
      new_tier: entry.new_tier,
      reason: entry.reason,
      created_at: entry.created_at,
      changed_by: entry.changed_by,
    }));

    return NextResponse.json({
      success: true,
      history: transformedHistory,
    });
  } catch (error) {
    console.error('Trust history error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load history' },
      { status: 500 }
    );
  }
}
