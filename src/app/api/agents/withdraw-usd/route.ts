import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Lazy initialization for Vercel build
let supabase: SupabaseClient | null = null;
function getSupabase(): SupabaseClient {
  if (!supabase) {
    supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return supabase;
}

interface WithdrawRequest {
  agent_id: string;
  wallet_address: string;
  amount?: number;
}

interface Agent {
  id: string;
  usd_balance: number;
  usd_withdrawal_threshold: number | null;
  stripe_account_id: string | null;
}

// POST /api/agents/withdraw-usd - Request USD withdrawal
export async function POST(request: NextRequest) {
  try {
    const body: WithdrawRequest = await request.json();
    const { agent_id, wallet_address, amount } = body;

    if (!agent_id || !wallet_address) {
      return NextResponse.json(
        { error: 'agent_id and wallet_address required' },
        { status: 400 }
      );
    }

    const db = getSupabase();

    // Verify agent
    const { data: agent, error: agentError } = await db
      .from('agents')
      .select('id, usd_balance, usd_withdrawal_threshold, stripe_account_id')
      .eq('id', agent_id)
      .eq('wallet_address', wallet_address)
      .single();

    if (agentError || !agent) {
      return NextResponse.json({ error: 'Agent not found or wallet mismatch' }, { status: 403 });
    }

    const agentData = agent as Agent;
    const threshold = agentData.usd_withdrawal_threshold || 10.0;
    const withdrawAmount = amount || agentData.usd_balance;

    // Validate withdrawal amount
    if (withdrawAmount <= 0) {
      return NextResponse.json(
        { error: 'Withdrawal amount must be positive' },
        { status: 400 }
      );
    }

    if (withdrawAmount > agentData.usd_balance) {
      return NextResponse.json(
        {
          error: `Insufficient balance. Have ${agentData.usd_balance.toFixed(2)}, requested ${withdrawAmount.toFixed(2)}`,
        },
        { status: 400 }
      );
    }

    if (withdrawAmount < threshold) {
      return NextResponse.json(
        {
          error: `Withdrawal below minimum threshold of ${threshold.toFixed(2)}. Have ${agentData.usd_balance.toFixed(2)}`,
        },
        { status: 400 }
      );
    }

    // Check if agent has Stripe account configured
    if (!agentData.stripe_account_id) {
      return NextResponse.json(
        {
          error: 'Stripe account not configured for this agent',
          requires_stripe_setup: true,
        },
        { status: 400 }
      );
    }

    // Create pending withdrawal record
    const { data: withdrawal, error: withdrawalError } = await db
      .from('pending_withdrawals')
      .insert({
        agent_id,
        amount: withdrawAmount,
        status: 'pending',
      })
      .select()
      .single();

    if (withdrawalError) {
      console.error('Failed to create withdrawal record:', withdrawalError);
      return NextResponse.json({ error: 'Failed to process withdrawal' }, { status: 500 });
    }

    const withdrawalData = withdrawal as any;

    // Deduct from balance immediately (held in pending state)
    const newBalance = agentData.usd_balance - withdrawAmount;
    await db
      .from('agents')
      .update({
        usd_balance: newBalance,
        updated_at: new Date().toISOString(),
      })
      .eq('id', agent_id);

    // Log USD transaction
    await db
      .from('transactions')
      .insert({
        agent_id,
        amount: -withdrawAmount,
        type: 'usd',
        action: 'withdrawal',
        description: `USD withdrawal request for ${withdrawAmount.toFixed(2)}`,
      });

    return NextResponse.json({
      success: true,
      withdrawal: {
        id: withdrawalData.id,
        agent_id: withdrawalData.agent_id,
        amount: withdrawalData.amount,
        status: withdrawalData.status,
        requested_at: withdrawalData.requested_at,
      },
      remaining_balance: newBalance,
      message: `Withdrawal of ${withdrawAmount.toFixed(2)} USD requested. Processing typically takes 3-5 business days.`,
    });

  } catch (err) {
    console.error('Withdrawal error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET /api/agents/withdraw-usd - Get withdrawal history
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agent_id = searchParams.get('agent_id');
    const wallet_address = searchParams.get('wallet_address');

    if (!agent_id || !wallet_address) {
      return NextResponse.json(
        { error: 'agent_id and wallet_address required' },
        { status: 400 }
      );
    }

    const db = getSupabase();

    // Verify agent
    const { data: agent, error: agentError } = await db
      .from('agents')
      .select('id, usd_balance, usd_withdrawal_threshold')
      .eq('id', agent_id)
      .eq('wallet_address', wallet_address)
      .single();

    if (agentError || !agent) {
      return NextResponse.json({ error: 'Agent not found or wallet mismatch' }, { status: 403 });
    }

    // Get withdrawal history
    const { data: withdrawals, error: withdrawalsError } = await db
      .from('pending_withdrawals')
      .select('*')
      .eq('agent_id', agent_id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (withdrawalsError) {
      console.error('Failed to fetch withdrawals:', withdrawalsError);
      return NextResponse.json({ error: 'Failed to fetch withdrawal history' }, { status: 500 });
    }

    const agentData = agent as Agent;

    return NextResponse.json({
      success: true,
      agent: {
        id: agentData.id,
        usd_balance: agentData.usd_balance,
        usd_withdrawal_threshold: agentData.usd_withdrawal_threshold || 10.0,
      },
      withdrawals: withdrawals || [],
      count: withdrawals?.length || 0,
    });

  } catch (err) {
    console.error('Fetch withdrawals error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
