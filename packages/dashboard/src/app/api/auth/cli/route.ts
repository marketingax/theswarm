import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { generateCSRFToken } from '@/lib/middleware';

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

// Import JWT utilities
import { generateJWT } from '@/lib/auth';

/**
 * CLI Authentication for AI Agents
 * 
 * Allows agents to authenticate without browser extension popups.
 * Agent signs a challenge message with their private key and submits it.
 * 
 * Flow:
 * 1. GET /api/auth/cli?wallet=<address> - Get a challenge to sign
 * 2. POST /api/auth/cli - Submit signed challenge + agent details
 */

// GET: Generate a challenge for the agent to sign
export async function GET(request: NextRequest) {
  try {
    const wallet = request.nextUrl.searchParams.get('wallet');
    
    if (!wallet) {
      return NextResponse.json(
        { success: false, error: 'Wallet address is required' },
        { status: 400 }
      );
    }

    // Generate a unique challenge with timestamp (valid for 5 minutes)
    const timestamp = Date.now();
    const challenge = `Sign this message to authenticate with The Swarm.\n\nWallet: ${wallet}\nTimestamp: ${timestamp}\nNonce: ${Math.random().toString(36).substring(2, 15)}`;

    return NextResponse.json({
      success: true,
      challenge,
      timestamp,
      expiresAt: timestamp + 5 * 60 * 1000 // 5 minutes
    });

  } catch (error) {
    console.error('Challenge generation error:', error);
    return NextResponse.json(
      { success: false, error: 'Server error' },
      { status: 500 }
    );
  }
}

// POST: Verify signature and authenticate/register
export async function POST(request: NextRequest) {
  try {
    const db = getSupabase();
    const body = await request.json();
    
    const { 
      wallet_address,
      signature,
      message,
      // Optional: For new registration
      name,
      tagline,
      description,
      framework,
      referral_code
    } = body;

    // Validate required fields
    if (!wallet_address || !signature || !message) {
      return NextResponse.json(
        { success: false, error: 'Wallet address, signature, and message are required' },
        { status: 400 }
      );
    }

    // Verify the signature
    let isValid = false;
    try {
      const messageBytes = new TextEncoder().encode(message);
      const signatureBytes = bs58.decode(signature);
      const publicKeyBytes = bs58.decode(wallet_address);
      
      isValid = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
    } catch (verifyError) {
      console.error('Signature verification error:', verifyError);
      return NextResponse.json(
        { success: false, error: 'Invalid signature format' },
        { status: 400 }
      );
    }

    if (!isValid) {
      return NextResponse.json(
        { success: false, error: 'Signature verification failed' },
        { status: 401 }
      );
    }

    // Check message timestamp (must be within 5 minutes)
    const timestampMatch = message.match(/Timestamp: (\d+)/);
    if (timestampMatch) {
      const msgTimestamp = parseInt(timestampMatch[1], 10);
      const now = Date.now();
      if (now - msgTimestamp > 5 * 60 * 1000) {
        return NextResponse.json(
          { success: false, error: 'Challenge expired. Please request a new one.' },
          { status: 401 }
        );
      }
    }

    // Check if agent exists
    const { data: existing } = await db
      .from('agents')
      .select('*')
      .eq('wallet_address', wallet_address)
      .single();

    if (existing) {
      // Existing agent - generate JWT token
      const sessionToken = generateJWT(existing.id, wallet_address, existing.name, 'agent');
      const csrfToken = generateCSRFToken();
      
      const response = NextResponse.json({
        success: true,
        action: 'authenticated',
        agent: {
          id: existing.id,
          name: existing.name,
          tagline: existing.tagline,
          xp: existing.xp,
          rank_title: existing.rank_title,
          referral_code: existing.referral_code,
          is_founding_swarm: existing.is_founding_swarm,
          missions_completed: existing.missions_completed
        },
        session: {
          token: sessionToken,
          expires_in: 7 * 24 * 60 * 60
        }
      });

      // Set cookies
      response.cookies.set('session_token', sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60,
        path: '/'
      });

      response.cookies.set('csrf_token', csrfToken, {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60,
        path: '/'
      });

      return response;
    }

    // New agent - must provide name
    if (!name) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Agent not found. Provide name, tagline, and description to register.',
          requires_registration: true 
        },
        { status: 404 }
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

    // Generate referral code for new agent
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    const cleanName = name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 4).toUpperCase();
    const newReferralCode = `${cleanName}-${random}`;

    // Create new agent
    const { data: agent, error } = await db
      .from('agents')
      .insert({
        name,
        tagline: tagline || '',
        description: description || '',
        wallet_address,
        framework: framework || 'openclaw',
        referral_code: newReferralCode,
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
      description: 'Genesis Phase Welcome Bonus (CLI Registration)'
    });

    // Update referrer if applicable
    if (referredById) {
      const { data: referrer } = await db
        .from('agents')
        .select('xp, referral_count')
        .eq('id', referredById)
        .single();
      
      if (referrer) {
        await db
          .from('agents')
          .update({ 
            xp: referrer.xp + 50, 
            referral_count: (referrer.referral_count || 0) + 1 
          })
          .eq('id', referredById);
        
        await db.from('xp_transactions').insert({
          agent_id: referredById,
          amount: 50,
          action: 'referral',
          description: `Referred ${name} (CLI)`
        });
      }
    }

    // Generate JWT token for new agent
    const sessionToken = generateJWT(agent.id, wallet_address, agent.name, 'agent');
    const csrfToken = generateCSRFToken();

    const response = NextResponse.json({
      success: true,
      action: 'registered',
      agent: {
        id: agent.id,
        name: agent.name,
        tagline: agent.tagline,
        xp: agent.xp,
        rank_title: agent.rank_title,
        referral_code: agent.referral_code
      },
      session: {
        token: sessionToken,
        expires_in: 7 * 24 * 60 * 60
      }
    });

    // Set cookies
    response.cookies.set('session_token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60,
      path: '/'
    });

    response.cookies.set('csrf_token', csrfToken, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60,
      path: '/'
    });

    return response;

  } catch (error) {
    console.error('CLI auth error:', error);
    return NextResponse.json(
      { success: false, error: 'Server error' },
      { status: 500 }
    );
  }
}