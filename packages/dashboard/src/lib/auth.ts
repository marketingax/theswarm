// src/lib/auth.ts
// JWT authentication utilities for The Swarm

import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';
import nacl from 'tweetnacl';
import bs58 from 'bs58';

// JWT secret (should be in environment variables)
const JWT_SECRET = process.env.JWT_SECRET || 'the-swarm-development-secret-change-in-production';
const JWT_EXPIRY = '7d'; // 7 days

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
  
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

// Verify JWT token
export function verifyJWT(token: string): { valid: boolean; payload?: JwtPayload; error?: string } {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
    return { valid: true, payload };
  } catch (error: any) {
    return { 
      valid: false, 
      error: error.message || 'Invalid token' 
    };
  }
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
    
    // Check message timestamp (must be within 5 minutes)
    const timestampMatch = message.match(/Timestamp: (\d+)/);
    if (timestampMatch) {
      const msgTimestamp = parseInt(timestampMatch[1], 10);
      const now = Date.now();
      if (now - msgTimestamp > 5 * 60 * 1000) {
        return { success: false, error: 'Signature expired' };
      }
    }
    
    // Get agent from database
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
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