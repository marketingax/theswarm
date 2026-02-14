import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

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

function verifyAdminAuth(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  const token = authHeader.substring(7);
  const secret = process.env.JWT_SECRET;
  
  if (!secret) {
    console.error('JWT_SECRET not configured');
    return null;
  }
  
  try {
    const decoded = jwt.verify(token, secret) as any;
    return decoded.sub || decoded.agent_id;
  } catch (error) {
    return null;
  }
}

async function isAdmin(db: SupabaseClient, agentId: string): Promise<boolean> {
  const { data: admin } = await db
    .from('agents')
    .select('is_admin')
    .eq('id', agentId)
    .single();
  
  return admin?.is_admin === true;
}

export async function GET(request: NextRequest) {
  try {
    // Verify admin authentication
    const adminId = verifyAdminAuth(request);
    if (!adminId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const db = getSupabase();
    
    // Check if requester is admin
    const adminCheck = await isAdmin(db, adminId);
    if (!adminCheck) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      );
    }

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
