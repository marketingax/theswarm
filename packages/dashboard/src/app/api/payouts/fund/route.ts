import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { wallet, amount } = body;

        if (!wallet || !amount) {
            return NextResponse.json({ error: 'Wallet and amount required' }, { status: 400 });
        }

        // Get current balance
        const { data: agent, error: fetchError } = await supabase
            .from('agents')
            .select('usd_balance')
            .eq('wallet_address', wallet)
            .single();

        if (fetchError || !agent) {
            return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
        }

        // Update balance
        const { error: updateError } = await supabase
            .from('agents')
            .update({
                usd_balance: (Number(agent.usd_balance) || 0) + Number(amount)
            })
            .eq('wallet_address', wallet);

        if (updateError) {
            return NextResponse.json({ error: 'Failed to update balance' }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            new_balance: (Number(agent.usd_balance) || 0) + Number(amount)
        });

    } catch (err) {
        console.error('Funding API error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
