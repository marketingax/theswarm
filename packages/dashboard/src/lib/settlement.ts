// src/lib/settlement.ts
// Money rails — hybrid by design.
//
// The internal ledger (agents.usd_balance) stays the source of truth for fast,
// gas-free escrow and split payouts. SETTLEMENT is the act of moving real value
// on-chain — done at withdrawal (cash-out), not per micro-payment.
//
// Everything sits behind a SettlementProvider interface so the custodial
// treasury impl shipping today can be swapped for a non-custodial on-chain
// escrow PROGRAM later without touching the API routes.
import {
  Connection,
  Keypair,
  PublicKey,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  getOrCreateAssociatedTokenAccount,
  transfer as splTransfer,
} from '@solana/spl-token';
import bs58 from 'bs58';

export interface SettlementResult {
  ok: boolean;
  signature?: string;
  error?: string;
}

export interface SettlementProvider {
  readonly kind: string;
  // Pay `usdcAmount` (human units, e.g. 12.50) to a recipient wallet.
  payout(toWallet: string, usdcAmount: number): Promise<SettlementResult>;
  treasuryUsdc(): Promise<number | null>;
}

// USDC has 6 decimals. Devnet USDC mint by default; override for mainnet.
const USDC_DECIMALS = 6;
const DEFAULT_DEVNET_USDC = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'; // circle devnet USDC

class CustodialSolanaProvider implements SettlementProvider {
  readonly kind = 'custodial-solana';
  private conn: Connection;
  private treasury: Keypair;
  private mint: PublicKey;

  constructor(secret: string, rpcUrl: string, mint: string) {
    this.conn = new Connection(rpcUrl, 'confirmed');
    this.treasury = Keypair.fromSecretKey(bs58.decode(secret));
    this.mint = new PublicKey(mint);
  }

  async payout(toWallet: string, usdcAmount: number): Promise<SettlementResult> {
    try {
      const owner = new PublicKey(toWallet);
      const base = BigInt(Math.round(usdcAmount * 10 ** USDC_DECIMALS));
      if (base <= BigInt(0)) return { ok: false, error: 'amount must be positive' };

      const sourceAta = await getAssociatedTokenAddress(this.mint, this.treasury.publicKey);
      // Creates the recipient's token account if it doesn't exist (treasury pays rent).
      const destAta = await getOrCreateAssociatedTokenAccount(this.conn, this.treasury, this.mint, owner);

      const sig = await splTransfer(
        this.conn,
        this.treasury,         // fee payer + signer
        sourceAta,
        destAta.address,
        this.treasury,         // source owner
        base
      );
      return { ok: true, signature: sig };
    } catch (e) {
      return { ok: false, error: String((e as Error)?.message || e) };
    }
  }

  async treasuryUsdc(): Promise<number | null> {
    try {
      const ata = await getAssociatedTokenAddress(this.mint, this.treasury.publicKey);
      const bal = await this.conn.getTokenAccountBalance(ata);
      return bal.value.uiAmount;
    } catch {
      return null;
    }
  }
}

let _provider: SettlementProvider | null = null;

// Returns the configured provider, or null if settlement isn't set up yet
// (so the rest of the app runs fine on the internal ledger alone).
//
// Env:
//   SWARM_TREASURY_SECRET — base58 secret key of the treasury wallet (SECRET)
//   SWARM_SOLANA_RPC      — RPC url (default Solana devnet)
//   SWARM_USDC_MINT       — USDC mint address (default devnet USDC)
export function getSettlementProvider(): SettlementProvider | null {
  if (_provider) return _provider;
  const secret = process.env.SWARM_TREASURY_SECRET;
  if (!secret) return null;
  const rpc = process.env.SWARM_SOLANA_RPC || 'https://api.devnet.solana.com';
  const mint = process.env.SWARM_USDC_MINT || DEFAULT_DEVNET_USDC;
  try {
    _provider = new CustodialSolanaProvider(secret, rpc, mint);
    return _provider;
  } catch {
    return null;
  }
}
