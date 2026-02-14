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

    // For now, we'll return an empty array since we don't have a trust_history table yet
    // In production, you'd query from a trust_history or audit_log table
    const { data: history, error } = await db
      .from('agents')
      .select('id, name, trust_tier, updated_at')
      .order('updated_at', { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    // Transform to history format
    const transformedHistory = (history || []).map(agent => ({
      id: agent.id,
      agent_id: agent.id,
      agent_name: agent.name,
      previous_tier: agent.trust_tier,
      new_tier: agent.trust_tier,
      reason: 'Initial state',
      created_at: agent.updated_at,
      changed_by: 'system',
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
