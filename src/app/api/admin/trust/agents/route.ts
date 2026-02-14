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

    const { data: agents, error } = await db
      .from('agents')
      .select(
        'id, name, wallet_address, trust_tier, fraud_flags, verified_claims, total_claims, probation_until'
      )
      .in('trust_tier', ['probation', 'blacklist', 'banned'])
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      agents: agents || [],
    });
  } catch (error) {
    console.error('Trust agents error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load agents' },
      { status: 500 }
    );
  }
}
