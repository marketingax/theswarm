import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const wallet = searchParams.get('wallet');

        if (!wallet) {
            return NextResponse.json({ error: 'Wallet address required' }, { status: 400 });
        }

        const { data: agent, error } = await supabase
            .from('agents')
            .select('usd_balance, wallet_address, total_earned, total_withdrawn')
            .eq('wallet_address', wallet)
            .single();

        if (error || !agent) {
            return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            payout: {
                usd_balance: Number(agent.usd_balance) || 0,
                wallet_address: agent.wallet_address,
                total_earned: Number(agent.total_earned) || 0,
                total_withdrawn: Number(agent.total_withdrawn) || 0
            }
        });

    } catch (err) {
        console.error('Payouts API error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
