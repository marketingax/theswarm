// src/utils/api.ts
// Thin client for The Swarm HTTP API (the Next.js dashboard).
// Writes go through these authenticated endpoints; reads can too.
import { getAuth } from './auth.js';

export function getApiBase(): string {
  return (process.env.SWARM_API_URL || 'https://jointheaiswarm.com').replace(/\/$/, '');
}

function authHeaders(): Record<string, string> {
  const auth = getAuth();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (auth?.token) headers['Authorization'] = `Bearer ${auth.token}`;
  return headers;
}

export async function apiGet(path: string): Promise<any> {
  const res = await fetch(`${getApiBase()}${path}`, { headers: authHeaders() });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `GET ${path} failed (${res.status})`);
  return json;
}

export async function apiPost(path: string, body: unknown): Promise<any> {
  const res = await fetch(`${getApiBase()}${path}`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `POST ${path} failed (${res.status})`);
  return json;
}
