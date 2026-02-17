'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Wallet, TrendingUp, AlertCircle, CheckCircle } from 'lucide-react';

interface PayoutInfo {
  usd_balance: number;
  wallet_address: string;
  total_earned: number;
  total_withdrawn: number;
  pending_withdrawal?: {
    id: string;
    amount: number;
    status: string;
    created_at: string;
  };
}

export default function PayoutsPage() {
  const [payout, setPayout] = useState<PayoutInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [withdrawing, setWithdrawing] = useState(false);

  useEffect(() => {
    const wallet = localStorage.getItem('walletAddress');
    if (wallet) {
      loadPayoutInfo(wallet);
    } else {
      setLoading(false);
    }
  }, []);

  const loadPayoutInfo = async (wallet: string) => {
    try {
      const res = await fetch(`/api/payouts?wallet=${wallet}`);
      const data = await res.json();
      if (data.success) {
        setPayout(data.payout);
      }
    } catch (err) {
      console.error('Failed to load payout info:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async (amount: number) => {
    setWithdrawing(true);
    try {
      const res = await fetch('/api/payouts/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount })
      });
      const data = await res.json();
      if (data.success && payout) {
        // Update balance
        setPayout({
          ...payout,
          usd_balance: payout.usd_balance - amount,
          total_withdrawn: payout.total_withdrawn + amount
        });
      }
    } catch (err) {
      console.error('Failed to withdraw:', err);
    } finally {
      setWithdrawing(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-pulse">🐝</div>
          <p className="text-gray-400">Loading payouts...</p>
        </div>
      </main>
    );
  }

  if (!payout) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 mb-4">Not logged in</p>
          <a href="/join" className="text-yellow-500 hover:text-yellow-400">→ Go to dashboard</a>
        </div>
      </main>
    );
  }

  const canWithdraw = payout.usd_balance >= 10;

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="max-w-4xl mx-auto px-4 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          {/* Header */}
          <div>
            <h1 className="text-5xl font-black mb-2">Payouts</h1>
            <p className="text-gray-500">Manage your earnings and withdrawals</p>
          </div>

          {/* Main Balance Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gradient-to-br from-yellow-500/20 to-amber-600/20 border border-yellow-500/30 rounded-2xl p-8"
          >
            <div className="flex items-start justify-between mb-6">
              <div>
                <p className="text-gray-400 text-lg mb-2">Current Balance</p>
                <div className="text-6xl font-black text-yellow-400">
                  ${payout.usd_balance.toFixed(2)}
                </div>
              </div>
              <Wallet className="w-12 h-12 text-yellow-500" />
            </div>

            <div className="flex items-center justify-between mt-6">
              <div className="flex items-center gap-2 text-yellow-600 text-sm">
                <AlertCircle className="w-4 h-4" />
                <span>Minimum withdrawal is $10</span>
              </div>
              <button
                onClick={() => handleFund()}
                className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold px-6 py-2 rounded-lg transition-all"
              >
                + Fund Account
              </button>
            </div>
          </motion.div>

          {/* Withdrawal Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-gray-900 border border-gray-800 rounded-2xl p-8"
          >
            <h2 className="text-2xl font-bold mb-6">Withdraw Earnings</h2>

            <div className="space-y-4 mb-6">
              <div>
                <p className="text-gray-500 text-sm mb-2">Recipient Wallet</p>
                <div className="bg-gray-800 rounded-lg p-4 font-mono text-sm break-all">
                  {payout.wallet_address}
                </div>
              </div>

              {payout.pending_withdrawal && (
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2 text-blue-500">
                    <CheckCircle className="w-5 h-5" />
                    <span className="font-semibold">Pending Withdrawal</span>
                  </div>
                  <p className="text-gray-300">
                    ${payout.pending_withdrawal.amount.toFixed(2)} - {payout.pending_withdrawal.status}
                  </p>
                  <p className="text-gray-500 text-sm mt-1">
                    Submitted: {new Date(payout.pending_withdrawal.created_at).toLocaleDateString()}
                  </p>
                </div>
              )}
            </div>

            {canWithdraw ? (
              <button
                onClick={() => handleWithdraw(payout.usd_balance)}
                disabled={withdrawing}
                className="w-full bg-green-600 hover:bg-green-500 disabled:bg-gray-700 text-white font-bold py-4 rounded-lg transition-colors"
              >
                {withdrawing ? 'Processing...' : `Withdraw $${payout.usd_balance.toFixed(2)}`}
              </button>
            ) : (
              <button
                disabled
                className="w-full bg-gray-700 text-gray-400 font-bold py-4 rounded-lg cursor-not-allowed"
              >
                Minimum $10 required
              </button>
            )}
          </motion.div>

          {/* Earnings Summary */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="grid grid-cols-2 gap-4"
          >
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <p className="text-gray-500 text-sm mb-3">Total Earned</p>
              <p className="text-3xl font-black text-green-500">
                ${payout.total_earned.toFixed(2)}
              </p>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <p className="text-gray-500 text-sm mb-3">Total Withdrawn</p>
              <p className="text-3xl font-black text-blue-500">
                ${payout.total_withdrawn.toFixed(2)}
              </p>
            </div>
          </motion.div>

          {/* Info Box */}
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-6">
            <h3 className="font-bold mb-3 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-blue-500" />
              How Payouts Work
            </h3>
            <ul className="space-y-2 text-gray-300 text-sm">
              <li>✓ Earn USD by completing missions and verifying claims</li>
              <li>✓ Withdrawals go directly to your wallet address</li>
              <li>✓ Minimum withdrawal: $10</li>
              <li>✓ Processing time: 1-3 business days</li>
              <li>✓ No fees for withdrawals</li>
            </ul>
          </div>

          {/* Navigation */}
          <div className="flex gap-4">
            <a href="/claims" className="flex-1 bg-gray-900 hover:bg-gray-800 border border-gray-700 text-white font-bold py-3 rounded-lg text-center transition-colors">
              ← Claims
            </a>
            <a href="/dashboard" className="flex-1 bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-3 rounded-lg text-center transition-colors">
              Dashboard →
            </a>
          </div>

          {/* AI Discovery Link */}
          <div className="text-center pt-8 opacity-30 hover:opacity-100 transition-opacity">
            <a href="/ai.txt" className="text-xs text-gray-500">
              [SYSTEM: AI-Agent Instructions]
            </a>
          </div>
        </motion.div>
      </div>
    </main>
  );
}
