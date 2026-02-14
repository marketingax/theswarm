// src/lib/middleware.ts
// Security middleware for The Swarm API

import { NextRequest, NextResponse } from 'next/server';
import { generateJWT, verifyJWT, authenticateWithSignature, requireAuth, extractJWT, checkAgentRateLimit } from '@/lib/auth';

// Security headers middleware
export function securityHeaders(request: NextRequest): NextResponse {
  const response = NextResponse.next();
  
  // Content Security Policy
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' https:; frame-src 'none'; object-src 'none'; base-uri 'self';"
  );
  
  // X-Frame-Options
  response.headers.set('X-Frame-Options', 'DENY');
  
  // X-Content-Type-Options
  response.headers.set('X-Content-Type-Options', 'nosniff');
  
  // Referrer Policy
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Permissions Policy
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=()'
  );
  
  // Strict-Transport-Security (only in production)
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  
  return response;
}

// API Authentication middleware
export async function authenticateAPI(
  request: NextRequest,
  requireAuth: boolean = true
): Promise<{ authenticated: boolean; agentId?: string; error?: string; token?: string }> {
  try {
    // Check for JWT token in Authorization header
    const token = extractJWT(request);
    
    if (token) {
      const result = verifyJWT(token);
      if (result.valid && result.payload) {
        return { 
          authenticated: true, 
          agentId: result.payload.sub,
          token 
        };
      }
      
      if (requireAuth) {
        return { authenticated: false, error: result.error || 'Invalid token' };
      }
    }
    
    // Check for wallet signature (for CLI/API endpoints)
    if (!requireAuth) {
      return { authenticated: false };
    }
    
    // For endpoints that require wallet signature
    const body = await request.json().catch(() => ({}));
    const { wallet_address, signature, message } = body;
    
    if (!wallet_address || !signature || !message) {
      return { authenticated: false, error: 'Missing authentication parameters' };
    }
    
    const authResult = await authenticateWithSignature(wallet_address, signature, message);
    
    if (authResult.success && authResult.agentId) {
      // Generate JWT token for future requests
      // Note: We need agent name to generate JWT - would need to fetch from DB
      return { 
        authenticated: true, 
        agentId: authResult.agentId 
      };
    }
    
    return { authenticated: false, error: authResult.error };
    
  } catch (error) {
    console.error('Authentication error:', error);
    return { authenticated: false, error: 'Authentication failed' };
  }
}

// Rate limiting middleware
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export function rateLimit(
  request: NextRequest,
  limit: number = 100,
  windowMs: number = 60 * 1000
): { allowed: boolean; remaining: number; resetTime: number } {
  const ip = request.headers.get('x-forwarded-for') || 
             request.headers.get('x-real-ip') || 
             'unknown';
  const key = `${ip}:${request.nextUrl.pathname}`;
  const now = Date.now();
  
  const entry = rateLimitStore.get(key);
  
  if (!entry || entry.resetTime < now) {
    // New window
    rateLimitStore.set(key, {
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
  rateLimitStore.set(key, entry);
  
  return {
    allowed: true,
    remaining: limit - entry.count,
    resetTime: entry.resetTime
  };
}

// CSRF protection middleware
export function csrfProtection(request: NextRequest): boolean {
  // Check for CSRF token in headers
  const csrfToken = request.headers.get('X-CSRF-Token');
  const expectedToken = request.cookies.get('csrf_token')?.value;
  
  // For non-GET requests, require CSRF token
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    if (!csrfToken || csrfToken !== expectedToken) {
      return false;
    }
  }
  
  return true;
}

// Helper to generate CSRF token
export function generateCSRFToken(): string {
  return Math.random().toString(36).substring(2) + 
         Date.now().toString(36) + 
         Math.random().toString(36).substring(2);
}