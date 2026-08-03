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

function generateReferralCode(name: string): string {
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  const cleanName = name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 4).toUpperCase();
  return `${cleanName}-${random}`;
}

// Ed25519 signatures are 64 bytes. The join page sends base64 (Phantom output),
// CLI clients send bs58 — accept either encoding.
function decodeSignatureCandidates(signature: string): Uint8Array[] {
  const candidates: Uint8Array[] = [];
  try {
    const b = bs58.decode(signature);
    if (b.length === 64) candidates.push(b);
  } catch {
    // not bs58
  }
  try {
    const b = new Uint8Array(Buffer.from(signature, 'base64'));
    if (b.length === 64) candidates.push(b);
  } catch {
    // not base64
  }
  return candidates;
}

// Import JWT utilities
import { generateJWT, consumeSignature } from '@/lib/auth';

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

    // Accept both the join-page field names and the /api/auth/cli-style names
    const walletSignature = body.wallet_signature || body.signature;
    const signedMessage = body.signed_message || body.message;

    // Validate required fields
    if (!name || !wallet_address) {
      return NextResponse.json(
        { success: false, error: 'Name and wallet address are required' },
        { status: 400 }
      );
    }

    // Proof of wallet ownership is required — otherwise anyone could register
    // (and later receive payouts for) a wallet they don't control.
    if (!walletSignature || !signedMessage) {
      return NextResponse.json(
        {
          success: false,
          error:
            'A wallet signature is required. Sign a message containing "Wallet: <your address>" and "Timestamp: <ms since epoch>", then send it as signed_message with the signature as wallet_signature. Alternatively use GET/POST /api/auth/cli.',
        },
        { status: 400 }
      );
    }

    // Verify the Ed25519 signature against the claimed wallet address
    let signatureValid = false;
    try {
      const messageBytes = new TextEncoder().encode(signedMessage);
      const publicKeyBytes = bs58.decode(wallet_address);
      signatureValid = decodeSignatureCandidates(walletSignature).some(sig =>
        nacl.sign.detached.verify(messageBytes, sig, publicKeyBytes)
      );
    } catch (verifyError) {
      console.error('Signature verification error:', verifyError);
      return NextResponse.json(
        { success: false, error: 'Invalid signature or wallet address format' },
        { status: 400 }
      );
    }

    if (!signatureValid) {
      return NextResponse.json(
        { success: false, error: 'Signature verification failed' },
        { status: 401 }
      );
    }

    // The signed message must commit to the wallet being registered
    if (!signedMessage.includes(`Wallet: ${wallet_address}`)) {
      return NextResponse.json(
        { success: false, error: 'Signed message does not reference this wallet address' },
        { status: 401 }
      );
    }

    // Freshness check (must be signed within the last 5 minutes)
    const timestampMatch = signedMessage.match(/Timestamp: (\d+)/);
    if (!timestampMatch) {
      return NextResponse.json(
        { success: false, error: 'Signed message must include "Timestamp: <ms since epoch>"' },
        { status: 401 }
      );
    }
    const msgTimestamp = parseInt(timestampMatch[1], 10);
    if (Math.abs(Date.now() - msgTimestamp) > 5 * 60 * 1000) {
      return NextResponse.json(
        { success: false, error: 'Signature expired. Sign a fresh message and try again.' },
        { status: 401 }
      );
    }

    // Each signature is single-use — reject replays
    const replay = await consumeSignature(db, walletSignature, wallet_address);
    if (!replay.ok) {
      return NextResponse.json(
        { success: false, error: replay.error },
        { status: 401 }
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

    // Generate JWT token
    const sessionToken = generateJWT(agent.id, wallet_address, agent.name, 'agent');
    
    // Generate CSRF token for future requests
    const csrfToken = generateCSRFToken();

    const response = NextResponse.json({
      success: true,
      agent: {
        id: agent.id,
        name: agent.name,
        xp: agent.xp,
        referral_code: agent.referral_code,
        rank_title: agent.rank_title
      },
      session: {
        token: sessionToken,
        expires_in: 7 * 24 * 60 * 60 // 7 days in seconds
      }
    });

    // Set session token as HTTP-only cookie
    response.cookies.set('session_token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/'
    });

    // Set CSRF token as non-HTTP-only cookie (accessible by JavaScript)
    response.cookies.set('csrf_token', csrfToken, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/'
    });

    return response;

  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { success: false, error: 'Server error' },
      { status: 500 }
    );
  }
}