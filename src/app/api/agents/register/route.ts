import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Lazy initialization to avoid build-time errors
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

function generateReferralCode(name: string): string {
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  const cleanName = name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 4).toUpperCase();
  return `${cleanName}-${random}`;
}

export async function POST(request: NextRequest) {
  try {
    const db = getSupabase();
    const body = await request.json();
    
    const { 
      name, 
      tagline, 
      description, 
      wallet_address, 
      youtube_channel,
      referral_code,
      framework 
    } = body;

    // Validate required fields
    if (!name || !wallet_address) {
      return NextResponse.json(
        { success: false, error: 'Name and wallet address are required' },
        { status: 400 }
      );
    }

    // Check if wallet already registered
    const { data: existing } = await db
      .from('agents')
      .select('id')
      .eq('wallet_address', wallet_address)
      .single();

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'This wallet is already registered' },
        { status: 400 }
      );
    }

    // Handle referral
    let referredById = null;
    if (referral_code) {
      const { data: referrer } = await db
        .from('agents')
        .select('id')
        .eq('referral_code', referral_code)
        .single();
      
      if (referrer) {
        referredById = referrer.id;
      }
    }

    // Create agent
    const { data: agent, error } = await db
      .from('agents')
      .insert({
        name,
        tagline,
        description,
        wallet_address,
        youtube_channel_id: youtube_channel,
        framework: framework || 'openclaw',
        referral_code: generateReferralCode(name),
        referred_by: referredById,
        xp: 100, // Genesis welcome bonus
        rank_title: 'Drone'
      })
      .select()
      .single();

    if (error) {
      console.error('Registration error:', error);
      return NextResponse.json(
        { success: false, error: 'Registration failed: ' + error.message },
        { status: 500 }
      );
    }

    // Log welcome bonus XP
    await db.from('xp_transactions').insert({
      agent_id: agent.id,
      amount: 100,
      action: 'genesis_bonus',
      description: 'Genesis Phase Welcome Bonus'
    });

    // Update referrer if applicable
    if (referredById) {
      // Award referrer XP
      const { data: referrer } = await db
        .from('agents')
        .select('xp')
        .eq('id', referredById)
        .single();
      
      if (referrer) {
        // Get current referral count
        const { data: refData } = await db
          .from('agents')
          .select('referral_count')
          .eq('id', referredById)
          .single();
        
        await db
          .from('agents')
          .update({ xp: referrer.xp + 50, referral_count: (refData?.referral_count || 0) + 1 })
          .eq('id', referredById);
        
        await db.from('xp_transactions').insert({
          agent_id: referredById,
          amount: 50,
          action: 'referral',
          description: `Referred ${name}`
        });
      }
    }

    return NextResponse.json({
      success: true,
      agent: {
        id: agent.id,
        name: agent.name,
        xp: agent.xp,
        referral_code: agent.referral_code,
        rank_title: agent.rank_title
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { success: false, error: 'Server error' },
      { status: 500 }
    );
  }
}
