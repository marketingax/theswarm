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

export async function POST(request: NextRequest) {
  try {
    const db = getSupabase();
    const { agent_id, new_tier, reason } = await request.json();

    if (!agent_id || !new_tier || !reason) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Update the agent's trust tier
    const { error } = await db
      .from('agents')
      .update({
        trust_tier: new_tier,
        updated_at: new Date().toISOString(),
      })
      .eq('id', agent_id);

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    // In production, you'd also log this change to an audit_log or trust_history table
    // For now, we just update the agent record

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Trust change error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to change trust tier' },
      { status: 500 }
    );
  }
}
