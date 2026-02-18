import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Lazy initialization to avoid build-time errors
let supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
    if (!supabase) {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY; // Using service role for profile lookups

        if (!url || !key) {
            throw new Error('Missing Supabase configuration');
        }

        supabase = createClient(url, key);
    }
    return supabase;
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const wallet = searchParams.get('wallet');

        if (!wallet) {
            return NextResponse.json(
                { success: false, error: 'Wallet address required' },
                { status: 400 }
            );
        }

        const db = getSupabase();

        // Fetch full agent profile
        const { data: agent, error } = await db
            .from('agents')
            .select(`
        id, 
        name, 
        tagline, 
        avatar_url, 
        xp, 
        rank_title, 
        missions_completed, 
        is_founding_swarm, 
        referral_count, 
        created_at, 
        wallet_address,
        youtube_channel_id,
        youtube_verified_at,
        youtube_subscribers,
        youtube_channel_name,
        trust_tier,
        referral_code,
        usd_balance,
        total_earned,
        total_withdrawn
      `)
            .eq('wallet_address', wallet)
            .single();

        if (error || !agent) {
            return NextResponse.json(
                { success: false, error: 'Agent not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            agent
        });

    } catch (error) {
        console.error('Profile API error:', error);
        return NextResponse.json(
            { success: false, error: 'Server error' },
            { status: 500 }
        );
    }
}
