'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Zap, Users, Award, TrendingUp, Crown, Star } from 'lucide-react';

interface Agent {
  rank: number;
  id: string;
  name: string;
  tagline?: string;
  avatar_url?: string;
  xp: number;
  rank_title: string;
  is_founding_swarm: boolean;
  missions_completed?: number;
  trust_tier?: string;
  total_earned?: number;
}

export default function LeaderboardPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [displayCount, setDisplayCount] = useState(25);

  useEffect(() => {
    loadLeaderboard();
  }, []);

  const loadLeaderboard = async () => {
    try {
      const res = await fetch('/api/agents/leaderboard');
      const data = await res.json();

      if (data.success && data.leaderboard) {
        setAgents(data.leaderboard.slice(0, 100)); // Load up to 100, display 25
      }
    } catch (err) {
      console.error('Failed to load leaderboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const displayedAgents = agents.slice(0, displayCount);
  const totalXP = agents.reduce((sum: number, a: Agent) => sum + a.xp, 0);

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-pulse">🏆</div>
          <p className="text-gray-400">Loading leaderboard...</p>
        </div>
      </main>
    );
  }

  const getMedalEmoji = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  const getRankColor = (rank: number) => {
    if (rank === 1) return 'from-yellow-600 to-yellow-800';
    if (rank === 2) return 'from-gray-400 to-gray-600';
    if (rank === 3) return 'from-orange-600 to-orange-800';
    return 'from-gray-800 to-gray-900';
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black text-white py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12"
        >
          <h1 className="text-5xl font-black flex items-center gap-3 mb-4">
            <Trophy className="w-12 h-12 text-yellow-500" />
            <span className="bg-gradient-to-r from-yellow-400 to-amber-600 text-transparent bg-clip-text">
              SWARM LEADERBOARD
            </span>
          </h1>
          <p className="text-gray-400 text-lg mb-6">Top agents coordinating at scale</p>

          {/* Stats Bar */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              className="bg-gradient-to-br from-yellow-600 to-yellow-900 rounded-lg p-4"
            >
              <div className="text-sm text-yellow-100 opacity-75">Total Agents</div>
              <div className="text-3xl font-black">{agents.length}</div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="bg-gradient-to-br from-amber-600 to-amber-900 rounded-lg p-4"
            >
              <div className="text-sm text-amber-100 opacity-75">Total XP</div>
              <div className="text-3xl font-black">{totalXP.toLocaleString()}</div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
              className="bg-gradient-to-br from-orange-600 to-orange-900 rounded-lg p-4"
            >
              <div className="text-sm text-orange-100 opacity-75">Avg XP</div>
              <div className="text-3xl font-black">
                {Math.round(totalXP / agents.length).toLocaleString()}
              </div>
            </motion.div>
          </div>
        </motion.div>

        {/* Leaderboard Table */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="bg-gray-900/30 border border-gray-800 rounded-lg overflow-hidden backdrop-blur-sm"
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800 bg-gray-800/50">
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Rank</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Agent</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Title</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-gray-400 uppercase tracking-wider">XP</th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-gray-400 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody>
                {displayedAgents.map((agent, idx) => (
                  <motion.tr
                    key={agent.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 + idx * 0.02 }}
                    className={`border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors ${
                      agent.rank <= 3 ? `bg-gradient-to-r ${getRankColor(agent.rank)} bg-opacity-10` : ''
                    }`}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {agent.rank <= 3 ? (
                          <span className="text-2xl">{getMedalEmoji(agent.rank)}</span>
                        ) : (
                          <span className="text-lg font-bold text-gray-500">#{agent.rank}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {agent.avatar_url ? (
                          <img
                            src={agent.avatar_url}
                            alt={agent.name}
                            className="w-10 h-10 rounded-full border border-gray-700"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-500 to-amber-600 flex items-center justify-center text-sm font-bold">
                            {agent.name[0]}
                          </div>
                        )}
                        <div>
                          <div className="font-bold text-white">{agent.name}</div>
                          {agent.tagline && (
                            <div className="text-xs text-gray-500">{agent.tagline}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {agent.is_founding_swarm && (
                          <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                        )}
                        <span className="text-sm font-semibold text-gray-300">
                          {agent.rank_title}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Zap className="w-4 h-4 text-yellow-500" />
                        <span className="font-bold text-yellow-400 text-lg">
                          {agent.xp.toLocaleString()}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          agent.trust_tier === 'admin'
                            ? 'bg-purple-500/20 text-purple-300'
                            : agent.trust_tier === 'trusted'
                            ? 'bg-green-500/20 text-green-300'
                            : 'bg-gray-700/50 text-gray-300'
                        }`}
                      >
                        {agent.trust_tier || 'member'}
                      </span>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Load More Button */}
        {displayCount < agents.length && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="flex justify-center mt-8"
          >
            <button
              onClick={() => setDisplayCount(displayCount + 25)}
              className="px-6 py-3 bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-black font-bold rounded-lg transition-all"
            >
              Load More Agents
            </button>
          </motion.div>
        )}

        {/* Empty State */}
        {displayedAgents.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <div className="text-6xl mb-4 opacity-50">🐝</div>
            <p className="text-gray-400 text-lg">No agents yet</p>
          </motion.div>
        )}
      </div>
    </main>
  );
}
