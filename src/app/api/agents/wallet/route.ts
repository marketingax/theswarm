import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import nacl from 'tweetnacl';
import bs58 from 'bs58';

// Lazy initialization
let supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;
    
    if (!url || !key) {
      throw new Error('Missing Supabase configuration');
    }
    
    supabase = createClient(url, key);
  }
  return supabase;
}

/**
 * Update Agent Wallet Address
 * 
 * Allows an agent to update their wallet address by proving ownership of the new wallet.
 * Requires signature from the NEW wallet to prove ownership.
 * 
 * Used when:
 * - Agent needs to rotate keys
 * - Original wallet was compromised
 * - Agent created wallet through human and needs to switch to self-owned wallet
 */

export async function POST(request: NextRequest) {
  try {
    const db = getSupabase();
    const body = await request.json();
    
    const { 
      agent_id,
      old_wallet_address,
      new_wallet_address,
      signature,
      message
    } = body;

    // Validate required fields
    if (!agent_id || !new_wallet_address || !signature || !message) {
      return NextResponse.json(
        { success: false, error: 'agent_id, new_wallet_address, signature, and message are required' },
        { status: 400 }
      );
    }

    // Verify the signature is from the NEW wallet (proves ownership)
    let isValid = false;
    try {
      const messageBytes = new TextEncoder().encode(message);
      const signatureBytes = bs58.decode(signature);
      const publicKeyBytes = bs58.decode(new_wallet_address);
      
      isValid = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
    } catch (verifyError) {
      console.error('Signature verification error:', verifyError);
      return NextResponse.json(
        { success: false, error: 'Invalid signature format' },
        { status: 400 }
      );
    }

    if (!isValid) {
      return NextResponse.json(
        { success: false, error: 'Signature verification failed - cannot prove ownership of new wallet' },
        { status: 401 }
      );
    }

    // Verify agent exists
    const { data: agent, error: fetchError } = await db
      .from('agents')
      .select('id, name, wallet_address')
      .eq('id', agent_id)
      .single();

    if (fetchError || !agent) {
      return NextResponse.json(
        { success: false, error: 'Agent not found' },
        { status: 404 }
      );
    }

    // Optional: Verify old wallet matches (extra security)
    if (old_wallet_address && agent.wallet_address !== old_wallet_address) {
      return NextResponse.json(
        { success: false, error: 'Old wallet address does not match current wallet' },
        { status: 400 }
      );
    }

    // Check new wallet isn't already in use
    const { data: existingWallet } = await db
      .from('agents')
      .select('id')
      .eq('wallet_address', new_wallet_address)
      .single();

    if (existingWallet) {
      return NextResponse.json(
        { success: false, error: 'New wallet address is already registered to another agent' },
        { status: 400 }
      );
    }

    // Update the wallet address
    const { error: updateError } = await db
      .from('agents')
      .update({ wallet_address: new_wallet_address })
      .eq('id', agent_id);

    if (updateError) {
      console.error('Wallet update error:', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to update wallet: ' + updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Wallet updated for agent ${agent.name}`,
      agent_id: agent.id,
      old_wallet: agent.wallet_address.slice(0, 8) + '...',
      new_wallet: new_wallet_address.slice(0, 8) + '...'
    });

  } catch (error) {
    console.error('Wallet update error:', error);
    return NextResponse.json(
      { success: false, error: 'Server error' },
      { status: 500 }
    );
  }
}
