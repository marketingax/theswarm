import { NextRequest, NextResponse } from 'next/server';
import { authenticateAPI } from '@/lib/middleware';
import { getServiceSupabase } from '@/lib/crew';
import { getSettlementProvider } from '@/lib/settlement';

// Solana settlement needs the Node runtime (not edge).
export const runtime = 'nodejs';

// POST /api/agents/withdraw-sol  { amount }
// Cash out internal USD balance as real USDC sent to the agent's Solana wallet.
// Custodial v1: the treasury wallet sends the USDC; the internal ledger is
// debited only after the transfer confirms (so a failed transfer never burns
// the balance).
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateAPI(request, true);
    if (!auth.authenticated || !auth.agentId) {
      return NextResponse.json({ error: 'Authentication required', details: auth.error }, { status: 401 });
    }
    const { amount } = await request.json();
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 });
    }

    const provider = getSettlementProvider();
    if (!provider) {
      return NextResponse.json(
        { error: 'On-chain settlement is not configured yet (set SWARM_TREASURY_SECRET).' },
        { status: 503 }
      );
    }

    const db = getServiceSupabase();
    const { data: agent } = await db
      .from('agents')
      .select('id, wallet_address, usd_balance')
      .eq('id', auth.agentId)
      .single();
    if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 403 });
    if (!agent.wallet_address) return NextResponse.json({ error: 'Agent has no wallet address' }, { status: 400 });

    const balance = Number(agent.usd_balance) || 0;
    if (balance < amt) {
      return NextResponse.json({ error: `Insufficient balance: have ${balance}, requested ${amt}` }, { status: 400 });
    }

    // Send the USDC on-chain FIRST; only debit the ledger if it confirms.
    const result = await provider.payout(agent.wallet_address, amt);
    if (!result.ok) {
      return NextResponse.json({ error: `Settlement failed: ${result.error}` }, { status: 502 });
    }

    await db.from('agents').update({ usd_balance: balance - amt, updated_at: new Date().toISOString() }).eq('id', agent.id);
    await db.from('transactions').insert({
      agent_id: agent.id, amount: -amt, type: 'usd', action: 'withdraw_sol',
      description: `USDC withdrawal to ${agent.wallet_address} — tx ${result.signature}`,
    }).then(undefined, () => {});

    return NextResponse.json({
      success: true,
      amount: amt,
      signature: result.signature,
      remaining_balance: balance - amt,
      provider: provider.kind,
      message: `Sent ${amt} USDC on-chain.`,
    });
  } catch (err) {
    console.error('withdraw-sol error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
