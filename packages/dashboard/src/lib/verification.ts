// src/lib/verification.ts
// The verification engine — decides whether submitted work is acceptable.
//
// This is the trust backbone of the economy: without trustworthy completion
// proof, every payout is fraud-by-default. A mission/role declares an
// acceptance_criteria object and a verification_method; this module runs the
// checks (and optionally an LLM judge) and returns a decision.

export interface AcceptanceCriteria {
  url_resolves?: boolean;          // proof_url must return a 2xx
  keywords?: string[];             // proof text must contain ALL of these
  required_proof_fields?: string[];// proof_data must contain these non-empty keys
  regex?: string;                  // proof text must match this pattern
  min_length?: number;             // proof text must be at least this long
  judge_prompt?: string;           // extra instruction for the LLM judge
}

export interface CheckResult {
  passed: boolean;     // all required checks satisfied
  score: number;       // 0..1 fraction of checks passed
  reasons: string[];   // human-readable per-check outcomes
}

export type Decision = {
  decision: 'verified' | 'rejected' | 'audit';
  score: number;
  notes: string;
};

function proofText(proofUrl?: string, proofData?: unknown): string {
  let s = proofUrl || '';
  if (proofData) {
    try { s += ' ' + (typeof proofData === 'string' ? proofData : JSON.stringify(proofData)); } catch { /* ignore */ }
  }
  return s;
}

// Run the deterministic acceptance checks. No external services except an
// optional HEAD/GET to confirm a proof URL resolves.
export async function runAcceptanceChecks(
  criteria: AcceptanceCriteria,
  proofUrl?: string,
  proofData?: Record<string, unknown> | null
): Promise<CheckResult> {
  const reasons: string[] = [];
  let total = 0;
  let passed = 0;
  let hardFail = false;

  const text = proofText(proofUrl, proofData);

  if (criteria.url_resolves) {
    total++;
    let ok = false;
    if (proofUrl && /^https?:\/\//i.test(proofUrl)) {
      try {
        const ctrl = AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined;
        const res = await fetch(proofUrl, { method: 'GET', signal: ctrl });
        ok = res.ok;
      } catch { ok = false; }
    }
    if (ok) { passed++; reasons.push('url_resolves: ok'); }
    else { hardFail = true; reasons.push('url_resolves: FAILED (no 2xx response)'); }
  }

  if (criteria.required_proof_fields?.length) {
    for (const f of criteria.required_proof_fields) {
      total++;
      const v = proofData ? (proofData as Record<string, unknown>)[f] : undefined;
      if (v !== undefined && v !== null && String(v).trim() !== '') { passed++; reasons.push(`field "${f}": present`); }
      else { hardFail = true; reasons.push(`field "${f}": MISSING`); }
    }
  }

  if (criteria.keywords?.length) {
    const lower = text.toLowerCase();
    for (const kw of criteria.keywords) {
      total++;
      if (lower.includes(kw.toLowerCase())) { passed++; reasons.push(`keyword "${kw}": found`); }
      else { hardFail = true; reasons.push(`keyword "${kw}": MISSING`); }
    }
  }

  if (criteria.regex) {
    total++;
    try {
      if (new RegExp(criteria.regex).test(text)) { passed++; reasons.push('regex: matched'); }
      else { hardFail = true; reasons.push('regex: NO MATCH'); }
    } catch { reasons.push('regex: invalid pattern (skipped)'); total--; }
  }

  if (criteria.min_length) {
    total++;
    if (text.trim().length >= criteria.min_length) { passed++; reasons.push('min_length: ok'); }
    else { hardFail = true; reasons.push(`min_length: too short (${text.trim().length} < ${criteria.min_length})`); }
  }

  const score = total === 0 ? 1 : passed / total;
  return { passed: total > 0 && !hardFail, score, reasons };
}

// Optional LLM-as-judge. Grades how well the proof satisfies the task. Returns
// null (skipped) if no ANTHROPIC_API_KEY is configured, so the system degrades
// gracefully to deterministic checks only.
export async function judgeWithLLM(
  taskDescription: string,
  criteria: AcceptanceCriteria,
  proofUrl?: string,
  proofData?: unknown
): Promise<{ score: number; reasoning: string } | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const prompt = `You are a strict but fair work verifier for an autonomous agent job board.
Task the agent was paid to do:
"""${taskDescription}"""
${criteria.judge_prompt ? `\nExtra acceptance guidance: ${criteria.judge_prompt}` : ''}

The agent submitted this proof:
- proof_url: ${proofUrl || '(none)'}
- proof_data: ${proofData ? JSON.stringify(proofData).slice(0, 2000) : '(none)'}

Decide how well the proof demonstrates the task was genuinely completed.
Respond with ONLY a JSON object: {"score": <0.0-1.0>, "reasoning": "<one sentence>"}.
Score 1.0 = clearly done well, 0.0 = clearly not done or fabricated.`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: process.env.SWARM_JUDGE_MODEL || 'claude-haiku-4-5',
        max_tokens: 200,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: AbortSignal.timeout ? AbortSignal.timeout(20000) : undefined,
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    const text: string = data?.content?.[0]?.text || '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]);
    const score = Math.max(0, Math.min(1, Number(parsed.score)));
    return { score, reasoning: String(parsed.reasoning || '').slice(0, 300) };
  } catch {
    return null;
  }
}

// Top-level decision. Returns null when the method is 'auto'/absent so the
// caller falls back to its existing trust-tier + random-audit behaviour
// (fully back-compatible with missions that set no criteria).
export async function decideVerification(opts: {
  method?: string;
  criteria?: AcceptanceCriteria | null;
  taskDescription?: string;
  proofUrl?: string;
  proofData?: Record<string, unknown> | null;
}): Promise<Decision | null> {
  const method = opts.method || 'auto';
  const criteria = opts.criteria || {};

  if (method === 'auto') return null;            // legacy path
  if (method === 'manual') return { decision: 'audit', score: 0, notes: 'manual review required' };
  if (method === 'peer') return { decision: 'audit', score: 0, notes: 'awaiting peer review' };

  const checks = await runAcceptanceChecks(criteria, opts.proofUrl, opts.proofData);

  if (method === 'criteria') {
    if (checks.passed) return { decision: 'verified', score: checks.score, notes: checks.reasons.join('; ') };
    if (checks.score === 0) return { decision: 'rejected', score: 0, notes: checks.reasons.join('; ') };
    return { decision: 'audit', score: checks.score, notes: checks.reasons.join('; ') };
  }

  if (method === 'judge') {
    // Hard deterministic failures short-circuit before spending a judge call.
    if (!checks.passed && checks.score < 0.5) {
      return { decision: 'rejected', score: checks.score, notes: `checks failed: ${checks.reasons.join('; ')}` };
    }
    const judged = await judgeWithLLM(opts.taskDescription || '', criteria, opts.proofUrl, opts.proofData);
    if (!judged) {
      // No judge available — fall back to deterministic result.
      return checks.passed
        ? { decision: 'verified', score: checks.score, notes: `checks ok (judge unavailable): ${checks.reasons.join('; ')}` }
        : { decision: 'audit', score: checks.score, notes: `judge unavailable: ${checks.reasons.join('; ')}` };
    }
    const combined = (checks.score + judged.score) / 2;
    if (judged.score >= 0.7) return { decision: 'verified', score: combined, notes: `judge: ${judged.reasoning}` };
    if (judged.score < 0.4) return { decision: 'rejected', score: combined, notes: `judge: ${judged.reasoning}` };
    return { decision: 'audit', score: combined, notes: `judge borderline: ${judged.reasoning}` };
  }

  return null;
}
