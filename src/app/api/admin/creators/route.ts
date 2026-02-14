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
