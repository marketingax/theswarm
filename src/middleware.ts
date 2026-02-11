// src/middleware.ts
// Next.js middleware for The Swarm - applies security headers and authentication

import { NextRequest, NextResponse } from 'next/server';
import { securityHeaders, rateLimit, csrfProtection } from '@/lib/middleware';
import { requireAuth, checkAgentRateLimit } from '@/lib/auth';

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  
  // Apply security headers to all responses
  const response = securityHeaders(request);
  
  // Rate limiting for API endpoints
  if (pathname.startsWith('/api/')) {
    const ip = request.headers.get('x-forwarded-for') || 
               request.headers.get('x-real-ip') || 
               'unknown';
    
    const rateLimitResult = rateLimit(request, 100, 60000); // 100 requests per minute
    
    if (!rateLimitResult.allowed) {
      return new NextResponse(
        JSON.stringify({ 
          error: 'Rate limit exceeded',
          retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': '100',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': rateLimitResult.resetTime.toString(),
            ...Object.fromEntries(response.headers)
          }
        }
      );
    }
    
    // Add rate limit headers to response
    response.headers.set('X-RateLimit-Limit', '100');
    response.headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString());
    response.headers.set('X-RateLimit-Reset', rateLimitResult.resetTime.toString());
  }
  
  // CSRF protection for state-changing endpoints
  const protectedEndpoints = [
    '/api/missions',
    '/api/missions/claim',
    '/api/missions/submit',
    '/api/agents/register',
    '/api/auth/cli'
  ];
  
  // CSRF exemption for API endpoints that use wallet signatures
  const csrfExemptEndpoints = [
    '/api/auth/cli'
  ];
  
  const requiresCSRF = protectedEndpoints.some(endpoint => pathname.startsWith(endpoint)) &&
                       !csrfExemptEndpoints.some(endpoint => pathname.startsWith(endpoint));
  
  if (requiresCSRF) {
    if (!csrfProtection(request)) {
      return new NextResponse(
        JSON.stringify({ error: 'CSRF token missing or invalid' }),
        {
          status: 403,
          headers: {
            'Content-Type': 'application/json',
            ...Object.fromEntries(response.headers)
          }
        }
      );
    }
  }
  
  // Authentication check for protected endpoints
  const authRequiredEndpoints = [
    '/api/missions', // POST requires auth
    '/api/missions/claim',
    '/api/missions/submit',
    '/api/agents/wallet'
  ];
  
  // Only check auth for POST, PUT, DELETE methods on protected endpoints
  const requiresAuth = authRequiredEndpoints.some(endpoint => pathname.startsWith(endpoint)) &&
                       request.method !== 'GET' && request.method !== 'OPTIONS';
  
  if (requiresAuth) {
    // Check for authentication
    const authResult = await requireAuth(request);
    
    if (!authResult.authenticated) {
      return new NextResponse(
        JSON.stringify({ error: 'Authentication required', details: authResult.error }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            'WWW-Authenticate': 'Bearer realm="The Swarm API", error="invalid_token"',
            ...Object.fromEntries(response.headers)
          }
        }
      );
    }
    
    // Apply agent-specific rate limiting
    if (authResult.agentId) {
      const agentRateLimit = checkAgentRateLimit(authResult.agentId, pathname, 50, 60000); // 50 requests per minute per agent
      
      if (!agentRateLimit.allowed) {
        return new NextResponse(
          JSON.stringify({ 
            error: 'Agent rate limit exceeded',
            retryAfter: Math.ceil((agentRateLimit.resetTime - Date.now()) / 1000)
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'X-Agent-RateLimit-Limit': '50',
              'X-Agent-RateLimit-Remaining': '0',
              'X-Agent-RateLimit-Reset': agentRateLimit.resetTime.toString(),
              ...Object.fromEntries(response.headers)
            }
          }
        );
      }
      
      // Add agent rate limit headers
      response.headers.set('X-Agent-RateLimit-Limit', '50');
      response.headers.set('X-Agent-RateLimit-Remaining', agentRateLimit.remaining.toString());
      response.headers.set('X-Agent-RateLimit-Reset', agentRateLimit.resetTime.toString());
    }
  }
  
  // Set CORS headers for API endpoints
  if (pathname.startsWith('/api/')) {
    response.headers.set('Access-Control-Allow-Origin', process.env.NEXT_PUBLIC_FRONTEND_URL || '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token');
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    
    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return new NextResponse(null, {
        status: 200,
        headers: Object.fromEntries(response.headers)
      });
    }
  }
  
  return response;
}

// Configure which paths the middleware runs on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public (public files)
     */
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
};