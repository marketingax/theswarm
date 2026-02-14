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

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { creator_id, approve, rejection_reason } = body;

    if (!creator_id) {
      return NextResponse.json(
        { success: false, error: 'creator_id is required' },
        { status: 400 }
      );
    }

    const db_client = getSupabase();

    // Get creator details
    const { data: creator, error: creatorError } = await db_client
      .from('creators')
      .select('*')
      .eq('id', creator_id)
      .single();

    if (creatorError || !creator) {
      return NextResponse.json(
        { success: false, error: 'Creator not found' },
        { status: 404 }
      );
    }

    if (approve === false) {
      // Reject creator application
      const { error: updateError } = await db_client
        .from('creators')
        .update({
          status: 'rejected',
          rejection_reason: rejection_reason || 'Not approved',
          updated_at: new Date().toISOString()
        })
        .eq('id', creator_id);

      if (updateError) {
        return NextResponse.json(
          { success: false, error: 'Failed to reject creator application' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Creator application rejected',
        creator: {
          id: creator.id,
          status: 'rejected'
        }
      });
    }

    // Approve creator
    // Calculate revenue share based on follower count
    const calculateRevenueShare = (followers: number): number => {
      if (followers >= 100000) return 0.25;
      if (followers >= 50000) return 0.22;
      if (followers >= 20000) return 0.20;
      if (followers >= 10000) return 0.18;
      if (followers >= 5000) return 0.16;
      return 0.15;
    };

    const revenueShare = calculateRevenueShare(creator.follower_count);

    // Update creator status
    const { error: updateError } = await db_client
      .from('creators')
      .update({
        status: 'active',
        approved_at: new Date().toISOString(),
        approved_by: adminId,
        revenue_share: revenueShare,
        updated_at: new Date().toISOString()
      })
      .eq('id', creator_id);

    if (updateError) {
      return NextResponse.json(
        { success: false, error: 'Failed to approve creator' },
        { status: 500 }
      );
    }

    // Update agents table
    const { error: agentError } = await db_client
      .from('agents')
      .update({
        is_creator: true,
        creator_category: creator.category,
        creator_revenue_share: revenueShare,
        creator_follower_count: creator.follower_count
      })
      .eq('id', creator.agent_id);

    if (agentError) {
      console.error('Failed to update agent:', agentError);
      // Don't fail the request if agent update fails
    }

    // Create notification record
    const { error: notifError } = await db_client
      .from('admin_notifications')
      .update({ status: 'processed' })
      .eq('creator_id', creator_id);

    return NextResponse.json({
      success: true,
      message: 'Creator approved successfully',
      creator: {
        id: creator.id,
        status: 'active',
        revenue_share: revenueShare,
        approved_at: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Creator approve error:', error);
    return NextResponse.json(
      { success: false, error: 'Server error' },
      { status: 500 }
    );
  }
}
