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

    // Fetch all creator earnings summary
    const { data: earnings, error } = await db
      .from('creator_earnings')
      .select('*')
      .order('earned_at', { ascending: false });

    if (error) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch earnings: ' + error.message },
        { status: 500 }
      );
    }

    // Calculate summaries by creator
    const earningsByCreator: { [key: string]: any } = {};

    (earnings || []).forEach((earning: any) => {
      const creatorId = earning.creator_id;
      
      if (!earningsByCreator[creatorId]) {
        earningsByCreator[creatorId] = {
          creator_id: creatorId,
          total_earned: 0,
          total_paid: 0,
          pending_payout: 0,
          last_payout_date: null,
          mission_count: 0
        };
      }

      const summary = earningsByCreator[creatorId];
      summary.total_earned += earning.amount;

      if (earning.status === 'paid' && earning.paid_at) {
        summary.total_paid += earning.amount;
        if (!summary.last_payout_date || new Date(earning.paid_at) > new Date(summary.last_payout_date)) {
          summary.last_payout_date = earning.paid_at;
        }
      } else if (earning.status === 'pending') {
        summary.pending_payout += earning.amount;
      }

      if (earning.mission_id) {
        summary.mission_count++;
      }
    });

    return NextResponse.json({
      success: true,
      earnings: earningsByCreator,
      total_creators: Object.keys(earningsByCreator).length
    });

  } catch (error) {
    console.error('Admin earnings fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Server error' },
      { status: 500 }
    );
  }
}
