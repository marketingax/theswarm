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
  requester_name: string;
  requester_avatar: string;
  claim_count: number;
  verified_count: number;
}

interface UsdEarner {
  id: string;
  name: string;
  avatar_url: string;
  usd_balance: number;
  total_usd_earned: number;
  usd_missions_completed: number;
}

interface PendingPayout {
  id: string;
  name: string;
  avatar_url: string;
  usd_balance: number;
  stripe_account_id: string | null;
  usd_withdrawal_threshold: number;
  eligible_for_withdrawal: boolean;
  pending_claims: number;
}

interface MissionStats {
  total_usd_budget: number;
  total_usd_completed: number;
  total_usd_paid: number;
  pending_missions: number;
  active_missions: number;
}

export default function AdminDashboard() {
  const [usdMissions, setUsdMissions] = useState<UsdMission[]>([]);
  const [topEarners, setTopEarners] = useState<UsdEarner[]>([]);
  const [pendingPayouts, setPendingPayouts] = useState<PendingPayout[]>([]);
  const [stats, setStats] = useState<MissionStats>({
    total_usd_budget: 0,
    total_usd_completed: 0,
    total_usd_paid: 0,
    pending_missions: 0,
    active_missions: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      // Fetch USD missions
      const missionsRes = await fetch('/api/missions?usdOnly=true');
      const missionsData = await missionsRes.json();
      
      if (missionsData.success) {
        setUsdMissions(missionsData.missions || []);
        
        // Calculate stats
        const stats: MissionStats = {
          total_usd_budget: missionsData.missions.reduce((sum: number, m: any) => sum + (m.usd_budget || 0), 0),
          total_usd_completed: missionsData.missions.reduce((sum: number, m: any) => sum + (m.usd_reward * m.verified_count || 0), 0),
          total_usd_paid: 0,
          pending_missions: missionsData.missions.filter((m: any) => m.status === 'pending_review').length,
          active_missions: missionsData.missions.filter((m: any) => m.status === 'active').length,
        };
        setStats(stats);
      }

      // TODO: Fetch top earners and pending payouts from views
      // For now, these would come from database views in production

    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-pulse">💰</div>
          <p className="text-gray-400">Loading admin dashboard...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black text-white py-12 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold flex items-center gap-3 mb-2">
            💰 USD Missions Admin Dashboard
          </h1>
          <p className="text-gray-400">Manage paid missions and track USD payments</p>
        </div>

        {/* Key Stats */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-green-900/20 to-green-900/5 border border-green-800/30 rounded-xl p-6"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="text-3xl font-bold text-green-400">${stats.total_usd_budget.toFixed(2)}</div>
              <DollarSign className="w-8 h-8 text-green-500 opacity-20" />
            </div>
            <div className="text-gray-400 text-sm">Total USD Budget</div>
            <div className="text-xs text-green-400 mt-2">Escrowed</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-gradient-to-br from-blue-900/20 to-blue-900/5 border border-blue-800/30 rounded-xl p-6"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="text-3xl font-bold text-blue-400">${stats.total_usd_completed.toFixed(2)}</div>
              <CheckCircle className="w-8 h-8 text-blue-500 opacity-20" />
            </div>
            <div className="text-gray-400 text-sm">USD Paid Out</div>
            <div className="text-xs text-blue-400 mt-2">Verified Claims</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-gradient-to-br from-yellow-900/20 to-yellow-900/5 border border-yellow-800/30 rounded-xl p-6"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="text-3xl font-bold text-yellow-400">{stats.active_missions}</div>
              <Target className="w-8 h-8 text-yellow-500 opacity-20" />
            </div>
            <div className="text-gray-400 text-sm">Active Missions</div>
            <div className="text-xs text-yellow-400 mt-2">USD-based</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-gradient-to-br from-orange-900/20 to-orange-900/5 border border-orange-800/30 rounded-xl p-6"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="text-3xl font-bold text-orange-400">{stats.pending_missions}</div>
              <Clock className="w-8 h-8 text-orange-500 opacity-20" />
            </div>
            <div className="text-gray-400 text-sm">Pending Review</div>
            <div className="text-xs text-orange-400 mt-2">Awaiting approval</div>
          </motion.div>
        </div>

        {/* USD Missions Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 mb-8"
        >
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-green-400" /> USD Missions
          </h2>

          {usdMissions.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Target className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p>No USD missions yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-3 px-4 text-gray-400">Mission</th>
                    <th className="text-center py-3 px-4 text-gray-400">Type</th>
                    <th className="text-right py-3 px-4 text-gray-400">Budget</th>
                    <th className="text-right py-3 px-4 text-gray-400">Per Task</th>
                    <th className="text-center py-3 px-4 text-gray-400">Progress</th>
                    <th className="text-center py-3 px-4 text-gray-400">Verified</th>
                    <th className="text-center py-3 px-4 text-gray-400">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {usdMissions.map(mission => (
                    <tr key={mission.id} className="border-b border-gray-700/50 hover:bg-gray-800/30 transition">
                      <td className="py-3 px-4">
                        <div>
                          <div className="font-medium">{mission.target_name}</div>
                          <div className="text-xs text-gray-500">{mission.mission_type}</div>
                        </div>
                      </td>
                      <td className="text-center py-3 px-4 text-xs">
                        <span className="bg-purple-500/20 text-purple-400 px-2 py-1 rounded">
                          {mission.mission_type.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="text-right py-3 px-4 font-semibold text-green-400">
                        ${mission.usd_budget.toFixed(2)}
                      </td>
                      <td className="text-right py-3 px-4 text-blue-400">
                        ${mission.usd_reward.toFixed(2)}
                      </td>
                      <td className="text-center py-3 px-4">
                        <div className="text-sm">
                          {mission.current_count}/{mission.target_count}
                        </div>
                        <div className="text-xs text-gray-500">
                          {Math.round((mission.current_count / mission.target_count) * 100)}%
                        </div>
                      </td>
                      <td className="text-center py-3 px-4">
                        <span className="bg-green-500/20 text-green-400 px-2 py-1 rounded text-xs">
                          {mission.verified_count}
                        </span>
                      </td>
                      <td className="text-center py-3 px-4">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            mission.status === 'active'
                              ? 'bg-green-500/20 text-green-400'
                              : mission.status === 'completed'
                              ? 'bg-blue-500/20 text-blue-400'
                              : 'bg-yellow-500/20 text-yellow-400'
                          }`}
                        >
                          {mission.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>

        {/* Top USD Earners (placeholder) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 mb-8"
        >
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-yellow-400" /> Top USD Earners
          </h2>

          {topEarners.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>No earners yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {topEarners.map((earner, idx) => (
                <div key={earner.id} className="flex items-center justify-between bg-gray-800/50 p-4 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-yellow-500">#{idx + 1}</span>
                    <img
                      src={earner.avatar_url}
                      alt={earner.name}
                      className="w-10 h-10 rounded-full"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://via.placeholder.com/40';
                      }}
                    />
                    <div>
                      <div className="font-medium">{earner.name}</div>
                      <div className="text-xs text-gray-400">{earner.usd_missions_completed} missions completed</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-green-400">${earner.total_usd_earned.toFixed(2)}</div>
                    <div className="text-xs text-gray-400">balance: ${earner.usd_balance.toFixed(2)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Pending Payouts */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-gray-900/50 border border-gray-800 rounded-xl p-6"
        >
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <Wallet className="w-6 h-6 text-blue-400" /> Pending Payouts Queue
          </h2>

          {pendingPayouts.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <CheckCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>No pending payouts</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingPayouts.map(payout => (
                <div
                  key={payout.id}
                  className={`flex items-center justify-between p-4 rounded-lg ${
                    payout.eligible_for_withdrawal
                      ? 'bg-green-900/20 border border-green-800/30'
                      : 'bg-gray-800/50 border border-gray-700/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {payout.eligible_for_withdrawal && (
                      <AlertCircle className="w-5 h-5 text-green-400" />
                    )}
                    <img
                      src={payout.avatar_url}
                      alt={payout.name}
                      className="w-10 h-10 rounded-full"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://via.placeholder.com/40';
                      }}
                    />
                    <div>
                      <div className="font-medium">{payout.name}</div>
                      <div className="text-xs text-gray-400">{payout.pending_claims} pending claims</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div
                      className={`text-lg font-bold ${
                        payout.eligible_for_withdrawal ? 'text-green-400' : 'text-gray-400'
                      }`}
                    >
                      ${payout.usd_balance.toFixed(2)}
                    </div>
                    <div className="text-xs text-gray-400">
                      {payout.stripe_account_id ? 'Stripe ready' : 'No Stripe'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </main>
  );
}
