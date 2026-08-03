import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';

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
    // Verify admin (signature-backed JWT + ADMIN_WALLETS env allowlist)
    const admin = await requireAdmin(request);
    if (!admin.authorized) return admin.response;

    const db = getSupabase();

    // Get status filter from query params
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'pending';

    // Fetch creators with joined agent data
    let query = db
      .from('creators')
      .select(`
        id,
        agent_id,
        status,
        category,
        follower_count,
        revenue_share,
        social_handle,
        social_proof_url,
        onboarded_at,
        approved_at,
        rejection_reason,
        agents(id, name, wallet_address)
      `);

    if (status !== 'all') {
      query = query.eq('status', status);
    }

    const { data: creators, error } = await query.order('onboarded_at', { ascending: false });

    if (error) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch creators: ' + error.message },
        { status: 500 }
      );
    }

    // Format response with agent data
    const formattedCreators = (creators || []).map((creator: any) => ({
      id: creator.id,
      agent_id: creator.agent_id,
      agent_name: creator.agents?.name || 'Unknown',
      wallet_address: creator.agents?.wallet_address,
      status: creator.status,
      category: creator.category,
      follower_count: creator.follower_count,
      revenue_share: creator.revenue_share,
      social_handle: creator.social_handle,
      social_proof_url: creator.social_proof_url,
      onboarded_at: creator.onboarded_at,
      approved_at: creator.approved_at,
      rejection_reason: creator.rejection_reason
    }));

    return NextResponse.json({
      success: true,
      creators: formattedCreators,
      count: formattedCreators.length
    });

  } catch (error) {
    console.error('Admin creators fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Server error' },
      { status: 500 }
    );
  }
}
