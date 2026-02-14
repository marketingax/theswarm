'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { 
  DollarSign,
  TrendingUp,
  Target,
  Users,
  Clock,
  AlertCircle,
  CheckCircle,
  Wallet,
  BarChart3,
  Shield,
} from 'lucide-react';

interface UsdMission {
  id: number;
  mission_type: string;
  target_name: string;
  target_url: string;
  target_count: number;
  current_count: number;
  usd_budget: number;
  usd_reward: number;
  status: string;
  requester_name?: string;
}

interface DashboardStats {
  total_agents: number;
  total_xp_circulating: number;
  total_missions_active: number;
  total_usd_available: number;
  pending_approvals: number;
}

export default function AdminDashboard() {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [stats, setStats] = useState<DashboardStats>({
    total_agents: 0,
    total_xp_circulating: 0,
    total_missions_active: 0,
    total_usd_available: 0,
    pending_approvals: 0,
  });
  const [usdMissions, setUsdMissions] = useState<UsdMission[]>([]);
  const [loading, setLoading] = useState(true);

  const ADMIN_WALLET = 'Fu7QnuVuGu1piks6FYeqp7GdP4P8MWjMeAeBbG5XYdUD';

  useEffect(() => {
    const wallet = localStorage.getItem('connectedWallet');
    setWalletAddress(wallet);
    setIsAdmin(wallet === ADMIN_WALLET);
    
    if (wallet === ADMIN_WALLET) {
      loadAdminDashboard();
    } else {
      setLoading(false);
    }
  }, []);

  const loadAdminDashboard = async () => {
    try {
      // Fetch missions
      const missionsRes = await fetch('/api/missions?limit=100');
      const missionsData = await missionsRes.json();
      if (missionsData.success && missionsData.missions) {
        setUsdMissions(missionsData.missions.filter((m: any) => m.usd_reward));
      }

      // Fetch leaderboard for stats
      const leaderboardRes = await fetch('/api/agents/leaderboard?limit=1000');
      const leaderboardData = await leaderboardRes.json();
      
      if (leaderboardData.success) {
        const totalXP = leaderboardData.leaderboard.reduce((sum: number, a: any) => sum + a.xp, 0);
        setStats({
          total_agents: leaderboardData.leaderboard.length,
          total_xp_circulating: totalXP,
          total_missions_active: missionsData.missions?.filter((m: any) => m.status === 'active').length || 0,
          total_usd_available: missionsData.missions?.reduce((sum: number, m: any) => sum + (m.usd_budget || 0), 0) || 0,
          pending_approvals: missionsData.missions?.filter((m: any) => m.status === 'pending_review').length || 0,
        });
      }
    } catch (err) {
      console.error('Failed to load admin dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-pulse">🛡️</div>
          <p className="text-gray-400">Loading admin dashboard...</p>
        </div>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black text-white flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-6">🔒</div>
          <h1 className="text-3xl font-bold mb-4">Admin Only</h1>
          <p className="text-gray-400 mb-8">
            Connect your admin wallet to access this dashboard.
          </p>
          <button
            onClick={() => window.location.href = '/'}
            className="px-6 py-3 bg-yellow-500 text-black font-bold rounded-lg hover:bg-yellow-400 transition-colors"
          >
            Go Home
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black text-white py-12 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12"
        >
          <h1 className="text-5xl font-black flex items-center gap-3 mb-4">
            <Shield className="w-12 h-12 text-purple-500" />
            <span className="bg-gradient-to-r from-purple-400 to-pink-600 text-transparent bg-clip-text">
              ADMIN CONTROL CENTER
            </span>
          </h1>
          <p className="text-gray-400 text-lg">Platform management & oversight</p>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-12">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="bg-gradient-to-br from-blue-600 to-blue-900 rounded-lg p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-blue-100 opacity-75">Total Agents</div>
                <div className="text-3xl font-black">{stats.total_agents}</div>
              </div>
              <Users className="w-8 h-8 text-blue-300" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-gradient-to-br from-yellow-600 to-amber-900 rounded-lg p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-amber-100 opacity-75">XP Circulating</div>
                <div className="text-3xl font-black">{(stats.total_xp_circulating / 1000).toFixed(1)}K</div>
              </div>
              <TrendingUp className="w-8 h-8 text-amber-300" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="bg-gradient-to-br from-green-600 to-emerald-900 rounded-lg p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-emerald-100 opacity-75">Active Missions</div>
                <div className="text-3xl font-black">{stats.total_missions_active}</div>
              </div>
              <Target className="w-8 h-8 text-emerald-300" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 }}
            className="bg-gradient-to-br from-pink-600 to-rose-900 rounded-lg p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-rose-100 opacity-75">USD Available</div>
                <div className="text-3xl font-black">${Math.round(stats.total_usd_available)}</div>
              </div>
              <DollarSign className="w-8 h-8 text-rose-300" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 }}
            className="bg-gradient-to-br from-orange-600 to-red-900 rounded-lg p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-red-100 opacity-75">Pending Review</div>
                <div className="text-3xl font-black">{stats.pending_approvals}</div>
              </div>
              <AlertCircle className="w-8 h-8 text-red-300" />
            </div>
          </motion.div>
        </div>

        {/* USD Missions Section */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="bg-gray-900/50 border border-gray-800 rounded-lg p-8"
        >
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-pink-500" />
            USD Missions
          </h2>

          {usdMissions.length === 0 ? (
            <p className="text-gray-400 text-center py-8">No USD missions yet</p>
          ) : (
            <div className="space-y-4">
              {usdMissions.slice(0, 10).map((mission) => (
                <motion.div
                  key={mission.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 flex items-start justify-between"
                >
                  <div className="flex-1">
                    <div className="font-bold text-white mb-1">{mission.target_name}</div>
                    <div className="text-sm text-gray-400">
                      ${mission.usd_reward} × {mission.target_count} claims = ${mission.usd_budget}
                    </div>
                    <div className="text-xs text-gray-500 mt-2">
                      Progress: {mission.current_count} / {mission.target_count}
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        mission.status === 'active'
                          ? 'bg-green-500/20 text-green-300'
                          : 'bg-yellow-500/20 text-yellow-300'
                      }`}
                    >
                      {mission.status}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Admin Info */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-12 bg-purple-500/10 border border-purple-500/30 rounded-lg p-6"
        >
          <div className="flex items-center gap-3 mb-2">
            <Wallet className="w-5 h-5 text-purple-400" />
            <span className="text-sm text-purple-300">Admin Wallet Connected</span>
          </div>
          <div className="text-xs text-gray-400 font-mono">
            {walletAddress?.substring(0, 6)}...{walletAddress?.substring(walletAddress.length - 4)}
          </div>
        </motion.div>
      </div>
    </main>
  );
}
