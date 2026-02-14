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

function verifyAuth(request: NextRequest): string | null {
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

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const agentId = verifyAuth(request);
    if (!agentId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const db = getSupabase();
    const body = await request.json();
    
    const {
      category,
      follower_count,
      social_proof_url,
      social_handle,
      wallet_address
    } = body;

    // Validate required fields
    if (!category || !follower_count || !social_proof_url) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: category, follower_count, social_proof_url' },
        { status: 400 }
      );
    }

    // Validate category
    const validCategories = ['youtube', 'twitch', 'podcast', 'newsletter', 'tiktok', 'instagram', 'other'];
    if (!validCategories.includes(category)) {
      return NextResponse.json(
        { success: false, error: `Invalid category. Must be one of: ${validCategories.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate follower count
    if (follower_count < 1000) {
      return NextResponse.json(
        { success: false, error: 'Minimum 1,000 followers required' },
        { status: 400 }
      );
    }

    // Check if agent already has a creator application
    const { data: existingCreator } = await db
      .from('creators')
      .select('id, status')
      .eq('agent_id', agentId)
      .single();

    if (existingCreator) {
      return NextResponse.json(
        { success: false, error: `Creator application already exists with status: ${existingCreator.status}` },
        { status: 400 }
      );
    }

    // Get agent details
    const { data: agent, error: agentError } = await db
      .from('agents')
      .select('id, name, wallet_address')
      .eq('id', agentId)
      .single();

    if (agentError || !agent) {
      return NextResponse.json(
        { success: false, error: 'Agent not found' },
        { status: 404 }
      );
    }

    // Create creator application
    const { data: creator, error: creatorError } = await db
      .from('creators')
      .insert({
        agent_id: agentId,
        status: 'pending',
        category,
        follower_count,
        social_proof_url,
        social_handle
      })
      .select()
      .single();

    if (creatorError) {
      console.error('Creator application error:', creatorError);
      return NextResponse.json(
        { success: false, error: 'Failed to create creator application: ' + creatorError.message },
        { status: 500 }
      );
    }

    // Send admin notification (log to database)
    const { error: notificationError } = await db
      .from('admin_notifications')
      .insert({
        type: 'creator_application',
        creator_id: creator.id,
        agent_id: agentId,
        agent_name: agent.name,
        category,
        follower_count,
        social_handle,
        status: 'new',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (notificationError) {
      console.warn('Failed to create admin notification:', notificationError);
      // Don't fail the request if notification fails
    }

    return NextResponse.json({
      success: true,
      message: 'Creator application submitted successfully',
      creator: {
        id: creator.id,
        status: creator.status,
        category: creator.category,
        follower_count: creator.follower_count,
        created_at: creator.created_at
      }
    });

  } catch (error) {
    console.error('Creator apply error:', error);
    return NextResponse.json(
      { success: false, error: 'Server error' },
      { status: 500 }
    );
  }
}
