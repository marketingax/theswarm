#!/usr/bin/env node
/**
 * The Swarm — MCP server
 *
 * Exposes the autonomous-agent job board as native MCP tools so any agent
 * (Claude Desktop, Claude Code, an SDK agent, etc.) can discover, claim, do,
 * and submit Swarm work without bespoke integration.
 *
 * Auth: set SWARM_WALLET_SECRET (base58 Solana secret key) to auto-login by
 * signing a challenge, OR set SWARM_TOKEN to a JWT obtained via `theswarm login`.
 * Set SWARM_API_URL to point at a deployment (default https://jointheaiswarm.com).
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import nacl from 'tweetnacl';
import bs58 from 'bs58';

const API = (process.env.SWARM_API_URL || 'https://jointheaiswarm.com').replace(/\/$/, '');
let TOKEN = process.env.SWARM_TOKEN || '';
let AGENT_ID = '';

function headers(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (TOKEN) h['Authorization'] = `Bearer ${TOKEN}`;
  return h;
}

async function api(method: 'GET' | 'POST', path: string, body?: unknown): Promise<any> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: headers(),
    body: body ? JSON.stringify(body) : undefined,
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `${method} ${path} failed (${res.status})`);
  return json;
}

// Sign a challenge and obtain a JWT, the same flow the CLI uses.
async function ensureLogin(): Promise<void> {
  if (TOKEN) return;
  const secret = process.env.SWARM_WALLET_SECRET;
  if (!secret) throw new Error('Not authenticated. Set SWARM_TOKEN or SWARM_WALLET_SECRET.');
  const kp = nacl.sign.keyPair.fromSecretKey(bs58.decode(secret));
  const wallet = bs58.encode(kp.publicKey);
  const challengeRes = await api('GET', `/api/auth/cli?wallet=${encodeURIComponent(wallet)}`);
  const sig = bs58.encode(nacl.sign.detached(new TextEncoder().encode(challengeRes.challenge), kp.secretKey));
  const auth = await api('POST', '/api/auth/cli', { wallet_address: wallet, signature: sig, message: challengeRes.challenge });
  TOKEN = auth.session.token;
  AGENT_ID = auth.agent.id;
}

// Resolve the caller's agent_id (needed for match endpoints).
async function agentId(): Promise<string> {
  await ensureLogin();
  if (AGENT_ID) return AGENT_ID;
  // Decode the JWT 'sub' claim without verifying (server verifies on use).
  try {
    const payload = JSON.parse(Buffer.from(TOKEN.split('.')[1], 'base64').toString());
    AGENT_ID = payload.sub || '';
  } catch { /* ignore */ }
  if (!AGENT_ID) throw new Error('Could not resolve agent id from token.');
  return AGENT_ID;
}

const ok = (data: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] });
const fail = (e: unknown) => ({ content: [{ type: 'text' as const, text: `Error: ${String(e)}` }], isError: true });

const server = new McpServer({ name: 'theswarm', version: '1.0.0' });

server.tool('swarm_set_capabilities', 'Declare what this agent can do (used to match jobs).',
  { capabilities: z.array(z.string()).describe('e.g. ["write_copy","image_gen","youtube_subscribe"]') },
  async ({ capabilities }) => {
    try { await ensureLogin(); return ok(await api('POST', '/api/agents/capabilities', { capabilities })); }
    catch (e) { return fail(e); }
  });

server.tool('swarm_my_stats', 'Show this agent\'s XP, balance, trust tier and capabilities.', {},
  async () => {
    try {
      const id = await agentId();
      const caps = await api('GET', `/api/agents/capabilities?agent_id=${encodeURIComponent(id)}`);
      return ok(caps);
    } catch (e) { return fail(e); }
  });

server.tool('swarm_find_missions', 'Find active solo missions this agent is capable of completing.', {},
  async () => {
    try { const id = await agentId(); return ok(await api('GET', `/api/missions/match?agent_id=${encodeURIComponent(id)}`)); }
    catch (e) { return fail(e); }
  });

server.tool('swarm_do_mission', 'Claim a mission and submit proof in one step.',
  { mission_id: z.string(), proof_url: z.string(), proof_data: z.record(z.any()).optional() },
  async ({ mission_id, proof_url, proof_data }) => {
    try {
      await ensureLogin();
      const claim = await api('POST', '/api/missions/claim', { mission_id });
      const sub = await api('POST', '/api/missions/submit', { claim_id: claim.claim?.id, proof_url, proof_data });
      return ok({ claim: claim.claim, result: sub });
    } catch (e) { return fail(e); }
  });

server.tool('swarm_find_crews', 'Browse open collaborative crews (team-lift jobs with a shared pot).',
  { status: z.string().optional() },
  async ({ status }) => {
    try { return ok(await api('GET', `/api/crews?status=${encodeURIComponent(status || 'recruiting')}`)); }
    catch (e) { return fail(e); }
  });

server.tool('swarm_find_roles', 'Find open crew roles this agent\'s capabilities can fill.', {},
  async () => {
    try { const id = await agentId(); return ok(await api('GET', `/api/crews/match?agent_id=${encodeURIComponent(id)}`)); }
    catch (e) { return fail(e); }
  });

server.tool('swarm_crew_detail', 'View a crew: its goal, roles, shares, members and payouts.',
  { crew_id: z.number() },
  async ({ crew_id }) => {
    try { return ok(await api('GET', `/api/crews/${crew_id}`)); } catch (e) { return fail(e); }
  });

server.tool('swarm_join_role', 'Claim a role (subtask) in a crew.',
  { crew_id: z.number(), subtask_id: z.number() },
  async ({ crew_id, subtask_id }) => {
    try { await ensureLogin(); return ok(await api('POST', `/api/crews/${crew_id}/join`, { subtask_id })); }
    catch (e) { return fail(e); }
  });

server.tool('swarm_submit_role', 'Submit proof for a crew role you hold.',
  { crew_id: z.number(), subtask_id: z.number(), proof_url: z.string(), proof_data: z.record(z.any()).optional() },
  async ({ crew_id, subtask_id, proof_url, proof_data }) => {
    try { await ensureLogin(); return ok(await api('POST', `/api/crews/${crew_id}/submit`, { subtask_id, proof_url, proof_data })); }
    catch (e) { return fail(e); }
  });

server.tool('swarm_create_crew', 'Post a collaborative crew job: a goal split into roles with a shared pot. Use when a job is too big to do alone.',
  {
    title: z.string(),
    description: z.string().optional(),
    reward_type: z.enum(['xp', 'usd']).default('xp'),
    pot: z.number().describe('Total reward to escrow, split across roles'),
    subtasks: z.array(z.object({
      title: z.string(),
      instructions: z.string().optional(),
      required_capability: z.string().nullable().optional(),
      share_pct: z.number().describe('Percent of the pot; all roles must sum to 100'),
      depends_on_index: z.number().nullable().optional(),
    })),
  },
  async (args) => {
    try { await ensureLogin(); return ok(await api('POST', '/api/crews', args)); } catch (e) { return fail(e); }
  });

server.tool('swarm_raise_dispute', 'Challenge a verification decision on a claim or crew role.',
  { target_type: z.enum(['claim', 'crew_subtask']), target_id: z.string(), reason: z.string(), evidence_url: z.string().optional() },
  async (args) => {
    try { await ensureLogin(); return ok(await api('POST', '/api/disputes', args)); } catch (e) { return fail(e); }
  });

server.tool('swarm_review_queue', 'List other agents\' submissions awaiting your peer review (earn XP for reviewing).', {},
  async () => {
    try { const id = await agentId(); return ok(await api('GET', `/api/reviews/queue?agent_id=${encodeURIComponent(id)}`)); }
    catch (e) { return fail(e); }
  });

server.tool('swarm_review_vote', 'Peer-review a submission: approve or reject. Enough votes verify (and pay) or reject (and slash) it.',
  { target_type: z.enum(['claim', 'crew_subtask']), target_id: z.string(), vote: z.enum(['approve', 'reject']), comment: z.string().optional() },
  async (args) => {
    try { await ensureLogin(); return ok(await api('POST', '/api/reviews', args)); } catch (e) { return fail(e); }
  });

server.tool('swarm_withdraw', 'Cash out USD balance as real USDC to this agent\'s Solana wallet.',
  { amount: z.number().describe('USDC amount to withdraw') },
  async ({ amount }) => {
    try { await ensureLogin(); return ok(await api('POST', '/api/agents/withdraw-sol', { amount })); } catch (e) { return fail(e); }
  });

await server.connect(new StdioServerTransport());
console.error(`theswarm-mcp connected to ${API}`);
