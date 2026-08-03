// POST /api/auth/session — sign in with a Solana wallet signature (Phantom).
// GET  /api/auth/session — who am I? (authenticated, wallet, isAdmin)
// DELETE /api/auth/session — sign out (clears session cookie).
//
// Admin status is decided ONLY here on the server: wallet must pass real
// ed25519 signature verification AND be listed in the ADMIN_WALLETS env
// allowlist. The client never decides admin from a local constant.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { generateJWT, requireAuth } from '@/lib/auth';
import { isAdminWallet, adminConfigured } from '@/lib/adminAuth';

const SESSION_MAX_AGE = 7 * 24 * 60 * 60; // 7 days, matches JWT expiry

function sessionCookie(token: string): string {
  return `session_token=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_MAX_AGE}`;
}

export async function POST(request: NextRequest) {
  try {
    const { wallet_address, signature, message } = await request.json();

    if (!wallet_address || !signature || !message) {
      return NextResponse.json(
        { success: false, error: 'wallet_address, signature and message are required' },
        { status: 400 }
      );
    }

    // The signed message must be bound to this wallet and be fresh.
    if (!message.includes(`Wallet: ${wallet_address}`)) {
      return NextResponse.json(
        { success: false, error: 'Message does not match wallet' },
        { status: 400 }
      );
    }
    const timestampMatch = message.match(/Timestamp: (\d+)/);
    if (!timestampMatch) {
      return NextResponse.json(
        { success: false, error: 'Message missing timestamp' },
        { status: 400 }
      );
    }
    const age = Date.now() - parseInt(timestampMatch[1], 10);
    if (age < 0 || age > 5 * 60 * 1000) {
      return NextResponse.json(
        { success: false, error: 'Signature expired' },
        { status: 401 }
      );
    }

    // Verify the ed25519 signature against the wallet public key.
    let valid = false;
    try {
      valid = nacl.sign.detached.verify(
        new TextEncoder().encode(message),
        bs58.decode(signature),
        bs58.decode(wallet_address)
      );
    } catch {
      valid = false;
    }
    if (!valid) {
      return NextResponse.json(
        { success: false, error: 'Invalid signature' },
        { status: 401 }
      );
    }

    // Optional: link to an existing agent row (admins do not need one).
    let agentId: string | null = null;
    let agentName: string | null = null;
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key =
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
      if (url && key) {
        const db = createClient(url, key);
        const { data: agent } = await db
          .from('agents')
          .select('id, name')
          .eq('wallet_address', wallet_address)
          .maybeSingle();
        if (agent) {
          agentId = agent.id;
          agentName = agent.name;
        }
      }
    } catch {
      // Non-fatal: session still works without an agent row.
    }

    const isAdmin = adminConfigured() && isAdminWallet(wallet_address);
    const token = generateJWT(
      agentId || wallet_address,
      wallet_address,
      agentName || 'wallet-user',
      isAdmin ? 'admin' : 'agent'
    );

    const res = NextResponse.json({
      success: true,
      wallet: wallet_address,
      agent_id: agentId,
      isAdmin,
    });
    res.headers.set('Set-Cookie', sessionCookie(token));
    return res;
  } catch (error) {
    console.error('Session auth error:', error);
    return NextResponse.json(
      { success: false, error: 'Authentication failed' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.authenticated || !auth.jwt) {
    return NextResponse.json({ authenticated: false, isAdmin: false });
  }
  const wallet = auth.jwt.wallet;
  return NextResponse.json({
    authenticated: true,
    wallet,
    agent_id: auth.agentId,
    isAdmin: adminConfigured() && isAdminWallet(wallet),
  });
}

export async function DELETE() {
  const res = NextResponse.json({ success: true });
  res.headers.set(
    'Set-Cookie',
    'session_token=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0'
  );
  return res;
}
