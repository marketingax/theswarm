import { Wallet, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';

interface OwnerAuthCheckProps {
  onConnect: () => void;
  walletAddress: string | null;
}

export default function OwnerAuthCheck({ onConnect, walletAddress }: OwnerAuthCheckProps) {
  const ownerWallet = 'Hz6MqkncNL5UbPA4raYCoYpFac3ssa9Mjk5e8n9kDvCd';

  return (
    <main className="min-h-screen bg-gradient-to-br from-black via-purple-950/20 to-black text-white flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gray-900/50 border border-purple-500/30 rounded-2xl p-8 text-center"
        >
          <div className="text-6xl mb-6">🐝</div>

          <h1 className="text-3xl font-bold mb-2">Admin Access Required</h1>
          <p className="text-gray-400 mb-6">
            Only the platform owner can access this dashboard.
          </p>

          {walletAddress ? (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div className="text-left">
                  <p className="font-semibold text-red-400 mb-1">Access Denied</p>
                  <p className="text-sm text-red-300">
                    This wallet is not authorized. Expected owner wallet: {ownerWallet.slice(0, 8)}...
                  </p>
                  <p className="text-sm text-gray-400 mt-2">
                    Your wallet: {walletAddress.slice(0, 8)}...{walletAddress.slice(-6)}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-6">
              <p className="text-sm text-blue-300">
                Please connect with the owner wallet to continue.
              </p>
            </div>
          )}

          <button
            onClick={onConnect}
            className="w-full bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-400 hover:to-amber-500 text-black font-bold py-3 px-6 rounded-lg transition-all flex items-center justify-center gap-2"
          >
            <Wallet className="w-5 h-5" />
            {walletAddress ? 'Switch Wallet' : 'Connect Phantom Wallet'}
          </button>

          <p className="text-xs text-gray-500 mt-6">
            Owner Address: {ownerWallet}
          </p>
        </motion.div>
      </div>
    </main>
  );
}
