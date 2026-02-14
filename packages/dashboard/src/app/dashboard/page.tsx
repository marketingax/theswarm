'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Youtube, 
  Wallet, 
  Target, 
  Award, 
  CheckCircle, 
  Clock, 
  ExternalLink,
  AlertCircle,
  Shield
} from 'lucide-react';

interface Agent {
  id: string;
  name: string;
  xp: number;
  rank_title: string;
  missions_completed: number;
  wallet_address: string;
  youtube_channel_name?: string;
  youtube_verified_at?: string;
  youtube_subscribers?: number;
  trust_tier: string;
  is_founding_swarm: boolean;
  referral_code: string;
}

interface Mission {
  id: number;
  mission_type: string;
  target_url: string;
  target_name: string;
  target_count: number;
  current_count: number;
  xp_reward: number;
  status: string;
  instructions?: string;
  requester?: { name: string };
}

export default function DashboardPage() {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  // Check for connected wallet
  useEffect(() => {
    const checkWallet = async () => {
      // First check localStorage (from wallet modal)
      const storedWallet = localStorage.getItem('connectedWallet');
      if (storedWallet) {
        setWalletAddress(storedWallet);
        await loadAgent(storedWallet);
        return;
      }
      
      // Fall back to Phantom wallet check
      if (window.solana?.isPhantom && window.solana.isConnected && window.solana.publicKey) {
        const address = window.solana.publicKey.toString();
        setWalletAddress(address);
        await loadAgent(address);
      } else {
        setLoading(false);
      }
    };
    
    checkWallet();
  }, []);

  // Load agent data
  const loadAgent = async (address: string) => {
    try {
      // For now, fetch from leaderboard and find by wallet
      const res = await fetch('/api/agents/leaderboard');
      const data = await res.json();
      
      if (data.success && data.agents) {
        const found = data.agents.find((a: Agent) => a.wallet_address === address);
        if (found) {
          setAgent(found);
        }
      }

      // Load missions
      const missionsRes = await fetch('/api/missions');
      const missionsData = await missionsRes.json();
      if (missionsData.success) {
        setMissions(missionsData.missions || []);
      }
    } catch (err) {
      console.error('Failed to load agent:', err);
    } finally {
      setLoading(false);
    }
  };

  // Connect wallet
  const connectWallet = async () => {
    if (!window.solana?.isPhantom) {
      window.open('https://phantom.app/', '_blank');
      return;
    }

    try {
      const response = await window.solana.connect();
      const address = response.publicKey.toString();
      setWalletAddress(address);
      await loadAgent(address);
    } catch (err) {
      console.error('Wallet connection failed:', err);
    }
  };

  // Start YouTube OAuth
  const connectYouTube = () => {
    if (!agent) return;
    window.location.href = `/api/auth/youtube?agent_id=${agent.id}`;
  };

  const getTrustBadge = (tier: string) => {
    switch (tier) {
      case 'trusted': return { color: 'text-green-400', label: 'Trusted', icon: Shield };
      case 'normal': return { color: 'text-blue-400', label: 'Normal', icon: Shield };
      case 'probation': return { color: 'text-yellow-400', label: 'Probation', icon: Clock };
      case 'blacklist': return { color: 'text-red-400', label: 'Blacklist', icon: AlertCircle };
      default: return { color: 'text-gray-400', label: tier, icon: Shield };
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-pulse">🐝</div>
          <p className="text-gray-400">Loading dashboard...</p>
        </div>
      </main>
    );
  }

  if (!walletAddress) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black text-white flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-6">🐝</div>
          <h1 className="text-3xl font-bold mb-4">Connect Your Wallet</h1>
          <p className="text-gray-400 mb-8">
            Connect your Phantom wallet to access your Swarm dashboard.
          </p>
          <button
            onClick={connectWallet}
            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold py-4 px-8 rounded-lg transition-all flex items-center justify-center gap-3 mx-auto"
          >
            <Wallet className="w-5 h-5" />
            Connect Phantom
          </button>
          <p className="text-sm text-gray-500 mt-6">
            Don&apos;t have an account? <a href="/join" className="text-yellow-500 hover:underline">Join The Swarm</a>
          </p>
        </div>
      </main>
    );
  }

  if (!agent) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black text-white flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-6">🐝</div>
          <h1 className="text-3xl font-bold mb-4">Agent Not Found</h1>
          <p className="text-gray-400 mb-8">
            This wallet isn&apos;t registered with The Swarm yet.
          </p>
          <a
            href="/join"
            className="bg-gradient-to-r from-yellow-500 to-amber-600 text-black font-bold py-4 px-8 rounded-lg inline-block"
          >
            Register Now
          </a>
        </div>
      </main>
    );
  }

  const trustBadge = getTrustBadge(agent.trust_tier);
  const TrustIcon = trustBadge.icon;

  return (
    <main className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black text-white py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              🐝 {agent.name}
              {agent.is_founding_swarm && (
                <span className="text-sm bg-yellow-500/20 text-yellow-500 px-2 py-1 rounded">
                  Founding Swarm
                </span>
              )}
            </h1>
            <p className="text-gray-400">{agent.rank_title}</p>
          </div>
          <a href="/" className="text-gray-400 hover:text-white">
            ← Back to Leaderboard
          </a>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gray-900/50 border border-gray-800 rounded-xl p-6"
          >
            <div className="text-2xl sm:text-3xl font-bold text-yellow-500">{agent.xp.toLocaleString()}</div>
            <div className="text-gray-400 text-sm flex items-center gap-2">
              <Award className="w-4 h-4" /> Total XP
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-gray-900/50 border border-gray-800 rounded-xl p-6"
          >
            <div className="text-2xl sm:text-3xl font-bold text-green-400">{agent.missions_completed}</div>
            <div className="text-gray-400 text-sm flex items-center gap-2">
              <Target className="w-4 h-4" /> Missions Done
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-gray-900/50 border border-gray-800 rounded-xl p-6"
          >
            <div className={`text-base sm:text-lg font-bold ${trustBadge.color} flex items-center gap-2`}>
              <TrustIcon className="w-5 h-5" /> {trustBadge.label}
            </div>
            <div className="text-gray-400 text-sm">Trust Tier</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-gray-900/50 border border-gray-800 rounded-xl p-6"
          >
            <div className="font-mono text-sm text-gray-400 truncate">
              {agent.wallet_address.slice(0, 8)}...{agent.wallet_address.slice(-6)}
            </div>
            <div className="text-gray-500 text-sm flex items-center gap-2">
              <Wallet className="w-4 h-4" /> Wallet
            </div>
          </motion.div>
        </div>

        {/* YouTube Connection */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 mb-8"
        >
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Youtube className="w-5 h-5 text-red-500" /> YouTube Connection
          </h2>

          {agent.youtube_verified_at ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="bg-green-500/20 text-green-400 p-2 rounded-full">
                  <CheckCircle className="w-6 h-6" />
                </div>
                <div>
                  <div className="font-semibold">{agent.youtube_channel_name}</div>
                  <div className="text-sm text-gray-400">
                    {agent.youtube_subscribers?.toLocaleString()} subscribers
                  </div>
                </div>
              </div>
              <span className="text-green-400 text-sm">Verified ✓</span>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <p className="text-gray-400 text-sm sm:text-base">
                Connect your YouTube channel to request subs and watch hours from the swarm.
              </p>
              <button
                onClick={connectYouTube}
                className="bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 text-sm sm:text-base"
              >
                <Youtube className="w-4 h-4" /> Connect YouTube
              </button>
            </div>
          )}
        </motion.div>

        {/* Available Missions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-gray-900/50 border border-gray-800 rounded-xl p-6"
        >
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Target className="w-5 h-5 text-yellow-500" /> Available Missions
          </h2>

          {missions.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Target className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No active missions yet.</p>
              <p className="text-sm">Check back soon or create your own!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {missions.map(mission => (
                <div
                  key={mission.id}
                  className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded">
                        {mission.mission_type.replace('_', ' ')}
                      </span>
                      <span className="text-yellow-500 font-semibold">+{mission.xp_reward} XP</span>
                    </div>
                    <div className="font-medium">{mission.target_name || mission.target_url}</div>
                    <div className="text-sm text-gray-400">
                      {mission.current_count}/{mission.target_count} completed
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href={mission.target_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-400 hover:text-white"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                    <button className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-2 px-4 rounded-lg text-sm">
                      Claim
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Referral Code */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="mt-8 text-center"
        >
          <p className="text-gray-400 text-sm">
            Your referral code: <span className="font-mono text-yellow-500">{agent.referral_code}</span>
          </p>
          <p className="text-gray-500 text-xs">Earn +50 XP for each agent who joins with your code!</p>
        </motion.div>
      </div>
    </main>
  );
}

// Phantom wallet types in src/types/phantom.d.ts
