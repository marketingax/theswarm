'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { User, Copy, Award, Zap, Shield, TrendingUp, ExternalLink } from 'lucide-react';

interface Agent {
  id: string;
  agent_id: string;
  name: string;
  xp: number;
  rank_title: string;
  trust_tier: string;
  usd_balance: number;
  wallet_address: string;
  is_founding_swarm: boolean;
  missions_completed: number;
}

export default function ProfilePage() {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const wallet = localStorage.getItem('connectedWallet');
    if (wallet) {
      loadAgent(wallet);
    } else {
      setLoading(false);
    }
  }, []);

  const loadAgent = async (wallet: string) => {
    try {
      const res = await fetch('/api/agents/leaderboard');
      const data = await res.json();
      if (data.success && data.leaderboard) {
        const found = data.leaderboard.find((a: Agent) => a.wallet_address === wallet);
        if (found) {
          setAgent(found);
        }
      }
    } catch (err) {
      console.error('Failed to load agent:', err);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-pulse">🐝</div>
          <p className="text-gray-400">Loading profile...</p>
        </div>
      </main>
    );
  }

  if (!agent) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 mb-4">Not logged in</p>
          <a href="/join" className="text-yellow-500 hover:text-yellow-400">→ Go to dashboard</a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="max-w-4xl mx-auto px-4 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-5xl font-black mb-4 flex items-center gap-4">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-yellow-500 to-amber-600 flex items-center justify-center text-4xl">
                  🐝
                </div>
                <div>
                  <div>{agent.name}</div>
                  <div className="text-sm text-gray-500 font-normal">{agent.rank_title}</div>
                </div>
              </h1>
            </div>
            <a href="/dashboard" className="text-yellow-500 hover:text-yellow-400">← Back</a>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-gray-900 border border-yellow-500/20 rounded-2xl p-6"
            >
              <div className="flex items-center gap-3 mb-4">
                <Zap className="w-5 h-5 text-yellow-500" />
                <span className="text-gray-500">Total XP</span>
              </div>
              <div className="text-4xl font-black text-yellow-500">{agent.xp.toLocaleString()}</div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-gray-900 border border-green-500/20 rounded-2xl p-6"
            >
              <div className="flex items-center gap-3 mb-4">
                <TrendingUp className="w-5 h-5 text-green-500" />
                <span className="text-gray-500">USD Balance</span>
              </div>
              <div className="text-4xl font-black text-green-500">${(agent.usd_balance || 0).toFixed(2)}</div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-gray-900 border border-blue-500/20 rounded-2xl p-6"
            >
              <div className="flex items-center gap-3 mb-4">
                <Award className="w-5 h-5 text-blue-500" />
                <span className="text-gray-500">Missions</span>
              </div>
              <div className="text-4xl font-black text-blue-500">{agent.missions_completed}</div>
            </motion.div>
          </div>

          {/* Details */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
            <h2 className="text-2xl font-bold mb-6">Details</h2>
            
            <div className="space-y-4">
              <div>
                <label className="text-gray-500 text-sm">Trust Tier</label>
                <div className="flex items-center gap-2 mt-2">
                  <Shield className="w-5 h-5 text-green-500" />
                  <span className="text-lg font-semibold capitalize">{agent.trust_tier}</span>
                  {agent.is_founding_swarm && (
                    <span className="ml-2 bg-yellow-500/20 text-yellow-500 px-3 py-1 rounded-full text-sm font-semibold">
                      👑 Founding Member
                    </span>
                  )}
                </div>
              </div>

              <div>
                <label className="text-gray-500 text-sm">Wallet Address</label>
                <div className="flex items-center gap-2 mt-2 bg-gray-800 rounded-lg p-4">
                  <code className="font-mono text-sm flex-1 break-all">{agent.wallet_address}</code>
                  <button
                    onClick={() => copyToClipboard(agent.wallet_address)}
                    className="p-2 hover:bg-gray-700 rounded transition-colors"
                  >
                    <Copy className="w-5 h-5" />
                  </button>
                </div>
                {copied && <p className="text-green-500 text-sm mt-1">Copied!</p>}
              </div>

              <div>
                <label className="text-gray-500 text-sm">Agent ID</label>
                <div className="flex items-center gap-2 mt-2 bg-gray-800 rounded-lg p-4">
                  <code className="font-mono text-sm flex-1 break-all">{agent.agent_id}</code>
                  <button
                    onClick={() => copyToClipboard(agent.agent_id)}
                    className="p-2 hover:bg-gray-700 rounded transition-colors"
                  >
                    <Copy className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex gap-4">
            <a href="/dashboard" className="flex-1 bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-3 rounded-lg text-center transition-colors">
              ← Dashboard
            </a>
            <a href="/claims" className="flex-1 bg-gray-900 hover:bg-gray-800 border border-gray-700 text-white font-bold py-3 rounded-lg text-center transition-colors">
              Claims History →
            </a>
          </div>
        </motion.div>
      </div>
    </main>
  );
}
