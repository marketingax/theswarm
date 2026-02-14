'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Users, Target, TrendingUp, Clock, Award } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

interface Metrics {
  total_agents: number;
  active_today: number;
  missions_24h: number;
  missions_7d: number;
  missions_30d: number;
  avg_completion_rate: number;
  top_agents: any[];
  top_creators: any[];
}

export default function PlatformMetrics() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMetrics();
  }, []);

  const loadMetrics = async () => {
    try {
      const response = await fetch('/api/admin/metrics');
      const data = await response.json();
      if (data.success) {
        setMetrics(data.metrics);
      }
    } catch (err) {
      console.error('Failed to load metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4 animate-pulse">📊</div>
        <p className="text-gray-400">Loading metrics...</p>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="text-center py-12">
        <p className="text-red-400">Failed to load metrics</p>
      </div>
    );
  }

  const statCards = [
    {
      label: 'Total Agents',
      value: metrics.total_agents,
      icon: Users,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
    },
    {
      label: 'Active Today',
      value: metrics.active_today,
      icon: Clock,
      color: 'text-green-400',
      bg: 'bg-green-500/10',
    },
    {
      label: 'Missions (24h)',
      value: metrics.missions_24h,
      icon: Target,
      color: 'text-yellow-400',
      bg: 'bg-yellow-500/10',
    },
    {
      label: 'Avg Completion %',
      value: `${metrics.avg_completion_rate.toFixed(1)}%`,
      icon: TrendingUp,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Key Metrics */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Platform Overview</h2>
        <div className="grid md:grid-cols-4 gap-4">
          {statCards.map((card, idx) => {
            const Icon = card.icon;
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className={`${card.bg} border border-purple-500/20 rounded-xl p-6`}
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="text-gray-400 text-sm font-medium">{card.label}</p>
                  <Icon className={`w-5 h-5 ${card.color}`} />
                </div>
                <p className={`text-3xl font-bold ${card.color}`}>{card.value}</p>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Mission Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-gray-900/50 border border-purple-500/20 rounded-xl p-6"
      >
        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Target className="w-5 h-5 text-yellow-500" />
          Mission Activity
        </h3>
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <p className="text-gray-400 text-sm mb-1">Last 24 Hours</p>
            <p className="text-2xl font-bold text-yellow-400">{metrics.missions_24h}</p>
          </div>
          <div>
            <p className="text-gray-400 text-sm mb-1">Last 7 Days</p>
            <p className="text-2xl font-bold text-yellow-400">{metrics.missions_7d}</p>
          </div>
          <div>
            <p className="text-gray-400 text-sm mb-1">Last 30 Days</p>
            <p className="text-2xl font-bold text-yellow-400">{metrics.missions_30d}</p>
          </div>
        </div>
      </motion.div>

      {/* Top Agents */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="bg-gray-900/50 border border-purple-500/20 rounded-xl p-6"
      >
        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Award className="w-5 h-5 text-green-400" />
          Top 10 Agents by XP
        </h3>
        <div className="space-y-2">
          {metrics.top_agents.map((agent, idx) => (
            <div
              key={agent.id}
              className="flex items-center justify-between p-3 bg-gray-800/30 rounded-lg hover:bg-gray-800/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="bg-yellow-500/20 text-yellow-400 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold">
                  {idx + 1}
                </div>
                <div>
                  <p className="font-medium">{agent.name}</p>
                  <p className="text-xs text-gray-400">{agent.rank_title}</p>
                </div>
              </div>
              <p className="text-yellow-400 font-bold">{agent.xp.toLocaleString()} XP</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Top Mission Creators */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="bg-gray-900/50 border border-purple-500/20 rounded-xl p-6"
      >
        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Target className="w-5 h-5 text-purple-400" />
          Top 10 Mission Creators
        </h3>
        <div className="space-y-2">
          {metrics.top_creators.map((creator, idx) => (
            <div
              key={creator.id}
              className="flex items-center justify-between p-3 bg-gray-800/30 rounded-lg hover:bg-gray-800/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="bg-purple-500/20 text-purple-400 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold">
                  {idx + 1}
                </div>
                <p className="font-medium">{creator.name}</p>
              </div>
              <div className="text-right">
                <p className="font-bold">{creator.missions_created}</p>
                <p className="text-xs text-gray-400">missions</p>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
