// src/lib/csrf.ts
// CSRF protection utilities for The Swarm

// Get CSRF token from cookie (for client-side use)
export function getCSRFToken(): string | null {
  if (typeof document === 'undefined') return null;
  
  const match = document.cookie.match(/csrf_token=([^;]+)/);
  return match ? match[1] : null;
}

// Set CSRF token in cookie (for testing/debugging)
export function setCSRFToken(token: string): void {
  if (typeof document === 'undefined') return;
  
  document.cookie = `csrf_token=${token}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Strict${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
}

// Generate CSRF token for forms
export function generateCSRFToken(): string {
  return Math.random().toString(36).substring(2) + 
         Date.now().toString(36) + 
         Math.random().toString(36).substring(2);
}

// Validate CSRF token
export function validateCSRFToken(token: string | null): boolean {
  if (!token) return false;
  
  const expectedToken = getCSRFToken();
  return token === expectedToken;
}

// Fetch with CSRF protection
export async function fetchWithCSRF(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const csrfToken = getCSRFToken();
  
  const headers = new Headers(options.headers || {});
  
  // Add CSRF token for non-GET requests
  if (options.method && options.method !== 'GET' && options.method !== 'HEAD') {
    if (csrfToken) {
      headers.set('X-CSRF-Token', csrfToken);
    }
  }
  
  return fetch(url, {
    ...options,
    headers,
    credentials: 'include' // Include cookies
  });
}

// Form submission with CSRF protection
export async function submitFormWithCSRF(
  url: string,
  data: any,
  method: string = 'POST'
): Promise<Response> {
  const csrfToken = getCSRFToken();
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  
  if (csrfToken && method !== 'GET' && method !== 'HEAD') {
    headers['X-CSRF-Token'] = csrfToken;
  }
  
  return fetch(url, {
    method,
    headers,
    body: JSON.stringify(data),
    credentials: 'include'
  });
}