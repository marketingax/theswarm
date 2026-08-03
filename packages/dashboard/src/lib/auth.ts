// src/lib/auth.ts
// JWT authentication utilities for The Swarm

import jwt from 'jsonwebtoken';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { createHash } from 'crypto';

const JWT_EXPIRY = '7d'; // 7 days

// JWT_SECRET must be set — there is deliberately no fallback. A default secret
// would let anyone forge session tokens for any agent.
function getJWTSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      'JWT_SECRET environment variable is not set. Refusing to sign or verify tokens without it.'
    );
  }
  return secret;
}

export interface JwtPayload {
  sub: string; // Agent ID
  wallet: string; // Wallet address
  name: string; // Agent name
  role: string; // 'agent', 'admin', etc.
  iat?: number;
  exp?: number;
}

// Generate JWT token for authenticated agent
export function generateJWT(agentId: string, wallet: string, name: string, role: string = 'agent'): string {
  const payload: JwtPayload = {
    sub: agentId,
    wallet,
    name,
    role
  };
  
  return jwt.sign(payload, getJWTSecret(), { expiresIn: JWT_EXPIRY });
}

// Verify JWT token
export function verifyJWT(token: string): { valid: boolean; payload?: JwtPayload; error?: string } {
  try {
    const payload = jwt.verify(token, getJWTSecret()) as JwtPayload;
    return { valid: true, payload };
  } catch (error: any) {
    return { 
      valid: false, 
      error: error.message || 'Invalid token' 
    };
  }
}

// Replay protection: each verified signature may be used exactly once.
// The signature's hash is inserted into used_signatures; a unique violation
// means it was already consumed -> reject. Fails closed on any DB error.
export async function consumeSignature(
  db: SupabaseClient,
  signature: string,
  walletAddress: string
): Promise<{ ok: boolean; error?: string }> {
  const sigHash = createHash('sha256').update(signature).digest('hex');
  const now = Date.now();

  const { error } = await db.from('used_signatures').insert({
    sig_hash: sigHash,
    wallet_address: walletAddress,
    used_at: new Date(now).toISOString(),
    // signatures are valid for 5 minutes; keep the record for 10 to be safe
    expires_at: new Date(now + 10 * 60 * 1000).toISOString(),
  });

  if (error) {
    if (error.code === '23505') {
      return { ok: false, error: 'Signature already used. Sign a fresh challenge.' };
    }
    console.error('Signature replay check failed:', error);
    return { ok: false, error: 'Signature replay check failed' };
  }

  // Opportunistic cleanup of expired rows; failure here is harmless
  db.from('used_signatures')
    .delete()
    .lt('expires_at', new Date(now).toISOString())
    .then(() => {}, () => {});

  return { ok: true };
}

// Authenticate with wallet signature
export async function authenticateWithSignature(
  walletAddress: string,
  signature: string,
  message: string
): Promise<{ success: boolean; agentId?: string; error?: string }> {
  try {
    // Verify signature
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = bs58.decode(signature);
    const publicKeyBytes = bs58.decode(walletAddress);
    
    const isValid = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
    
    if (!isValid) {
      return { success: false, error: 'Invalid signature' };
    }
    
    // Check message timestamp (required, must be within 5 minutes)
    const timestampMatch = message.match(/Timestamp: (\d+)/);
    if (!timestampMatch) {
      return { success: false, error: 'Signed message must include "Timestamp: <ms since epoch>"' };
    }
    const msgTimestamp = parseInt(timestampMatch[1], 10);
    if (Math.abs(Date.now() - msgTimestamp) > 5 * 60 * 1000) {
      return { success: false, error: 'Signature expired' };
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Each signature is single-use — reject replays
    const replay = await consumeSignature(supabase, signature, walletAddress);
    if (!replay.ok) {
      return { success: false, error: replay.error };
    }

    const { data: agent, error } = await supabase
      .from('agents')
      .select('id, name, trust_tier')
      .eq('wallet_address', walletAddress)
      .single();
    
    if (error || !agent) {
      return { success: false, error: 'Agent not found' };
    }
    
    return { success: true, agentId: agent.id };
    
  } catch (error: any) {
    console.error('Authentication error:', error);
    return { success: false, error: 'Authentication failed' };
  }
}

// Extract JWT from request headers
export function extractJWT(request: Request): string | null {
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return null;
}

// Require authentication middleware
export async function requireAuth(request: Request): Promise<{
  authenticated: boolean;
  agentId?: string;
  jwt?: JwtPayload;
  error?: string;
}> {
  const token = extractJWT(request);
  
  if (!token) {
    // Check for cookie-based session
    const cookieHeader = request.headers.get('Cookie');
    if (cookieHeader) {
      const cookies = Object.fromEntries(
        cookieHeader.split('; ').map(c => {
          const [key, ...rest] = c.split('=');
          return [key, rest.join('=')];
        })
      );
      
      if (cookies.session_token) {
        const result = verifyJWT(cookies.session_token);
        if (result.valid && result.payload) {
          return {
            authenticated: true,
            agentId: result.payload.sub,
            jwt: result.payload
          };
        }
      }
    }
    
    return { authenticated: false, error: 'No authentication token provided' };
  }
  
  const result = verifyJWT(token);
  if (!result.valid || !result.payload) {
    return { authenticated: false, error: result.error };
  }
  
  return {
    authenticated: true,
    agentId: result.payload.sub,
    jwt: result.payload
  };
}

// Rate limiting per agent
const agentRateLimit = new Map<string, { count: number; resetTime: number }>();

export function checkAgentRateLimit(
  agentId: string,
  endpoint: string,
  limit: number = 100,
  windowMs: number = 60 * 1000
): { allowed: boolean; remaining: number; resetTime: number } {
  const key = `${agentId}:${endpoint}`;
  const now = Date.now();
  
  const entry = agentRateLimit.get(key);
  
  if (!entry || entry.resetTime < now) {
    // New window
    agentRateLimit.set(key, {
      count: 1,
      resetTime: now + windowMs
    });
    
    return {
      allowed: true,
      remaining: limit - 1,
      resetTime: now + windowMs
    };
  }
  
  if (entry.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: entry.resetTime
    };
  }
  
  // Increment count
  entry.count += 1;
  agentRateLimit.set(key, entry);
  
  return {
    allowed: true,
    remaining: limit - entry.count,
    resetTime: entry.resetTime
  };
}