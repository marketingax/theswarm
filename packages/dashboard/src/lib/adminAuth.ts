// src/lib/adminAuth.ts
// Server-side admin authorization for The Swarm.
//
// A caller is an admin IFF:
//   1. The request carries a valid JWT (issued only after wallet signature
//      verification — see /api/auth/session and /api/auth/cli), AND
//   2. The wallet address inside that JWT is present in the ADMIN_WALLETS
//      environment variable (comma-separated allowlist).
//
// No wallet addresses are ever hardcoded. If ADMIN_WALLETS is unset or empty,
// nobody is admin (safe default: admin endpoints locked to everyone).
// The admin lane additionally refuses to operate unless JWT_SECRET is
// explicitly configured, so the development fallback secret can never be used
// to forge an admin session.

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

export function getAdminWallets(): string[] {
  return (process.env.ADMIN_WALLETS || '')
    .split(',')
    .map((w) => w.trim())
    .filter(Boolean);
}

export function isAdminWallet(wallet?: string | null): boolean {
  if (!wallet) return false;
  return getAdminWallets().includes(wallet);
}

// True only when the admin lane is safely configured.
export function adminConfigured(): boolean {
  return Boolean(process.env.JWT_SECRET) && getAdminWallets().length > 0;
}

export type AdminAuthResult =
  | { authorized: true; wallet: string; agentId?: string }
  | { authorized: false; response: NextResponse };

export async function requireAdmin(request: Request): Promise<AdminAuthResult> {
  if (!adminConfigured()) {
    return {
      authorized: false,
      response: NextResponse.json(
        { success: false, error: 'Admin access is not configured' },
        { status: 503 }
      ),
    };
  }

  const auth = await requireAuth(request);
  if (!auth.authenticated || !auth.jwt) {
    return {
      authorized: false,
      response: NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      ),
    };
  }

  const wallet = auth.jwt.wallet;
  if (!isAdminWallet(wallet)) {
    return {
      authorized: false,
      response: NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      ),
    };
  }

  return { authorized: true, wallet, agentId: auth.agentId };
}
