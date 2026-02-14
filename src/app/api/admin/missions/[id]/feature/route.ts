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

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const db = getSupabase();
    const missionId = params.id;

    // In a real implementation, you might update a featured_missions table or add a featured flag
    // For now, we'll just return success
    // const { error } = await db
    //   .from('missions')
    //   .update({ is_featured: true })
    //   .eq('id', missionId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Feature mission error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to feature mission' },
      { status: 500 }
    );
  }
}
