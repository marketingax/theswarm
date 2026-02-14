'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Target, Award, Users, Clock, CheckCircle, Zap } from 'lucide-react';
import Link from 'next/link';

interface Mission {
  id: number;
  title?: string;
  type?: string;
  mission_type: string;
  target_url?: string;
  target_name: string;
  target_count: number;
  current_count: number;
  xp_reward?: number;
  usd_reward?: number;
  status: string;
  description?: string;
  instructions?: string;
  description?: string;
  type?: string;
  requester?: { name: string };
}

export default function MissionsPage() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  useEffect(() => {
    const wallet = localStorage.getItem('connectedWallet');
    setWalletAddress(wallet);
    loadMissions();
  }, []);

  const loadMissions = async () => {
    try {
      const res = await fetch('/api/missions');
      const data = await res.json();
      
      if (data.success) {
        setMissions(data.missions || []);
      }
    } catch (err) {
      console.error('Failed to load missions:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredMissions = missions.filter(m => {
    if (filter === 'active') return m.status === 'active';
    if (filter === 'completed') return m.status === 'completed' || m.current_count >= m.target_count;
    return true;
  });

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-pulse">🎯</div>
          <p className="text-gray-400">Loading missions...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black text-white py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold flex items-center gap-3 mb-2">
            <Target className="w-10 h-10 text-yellow-500" />
            Missions
          </h1>
          <p className="text-gray-400">Complete missions to earn XP and USD rewards</p>
        </div>

        {/* Login Prompt */}
        {!walletAddress && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-6 mb-8 flex items-center gap-4"
          >
            <div className="text-3xl">🔗</div>
            <div className="flex-1">
              <h2 className="font-bold text-yellow-400 mb-1">Connect Your Wallet</h2>
              <p className="text-gray-400 text-sm">Connect your wallet to claim and complete missions</p>
            </div>
            <button className="px-4 py-2 bg-yellow-500 text-black font-bold rounded-lg hover:bg-yellow-400 transition-colors">
              Connect Wallet
            </button>
          </motion.div>
        )}

        {/* Filter Tabs */}
        <div className="flex gap-4 mb-8 border-b border-gray-800 pb-4">
          {['all', 'active', 'completed'].map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab as any)}
              className={`px-4 py-2 font-semibold transition-colors capitalize ${
                filter === tab
                  ? 'text-yellow-400 border-b-2 border-yellow-400'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Missions Grid */}
        {filteredMissions.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4 opacity-50">🔍</div>
            <p className="text-gray-400">No missions found</p>
          </div>
        ) : (
          <div className="grid gap-6">
            {filteredMissions.map((mission) => (
              <motion.div
                key={mission.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gray-900/50 border border-gray-800 rounded-lg p-6 hover:border-yellow-500/30 transition-all"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold mb-2">{mission.target_name}</h2>
                    {(mission.description || mission.instructions) && (
                      <p className="text-gray-300 mb-3 leading-relaxed">{mission.description || mission.instructions}</p>
                    )}
                    <div className="flex items-center gap-4 text-sm text-gray-400">
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {mission.status}
                      </div>
                      {mission.type && (
                        <div className="flex items-center gap-1">
                          <Target className="w-4 h-4" />
                          {mission.type}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    {mission.xp_reward && (
                      <div className="flex items-center gap-1 text-yellow-400 font-bold mb-2">
                        <Zap className="w-5 h-5" />
                        {mission.xp_reward} XP
                      </div>
                    )}
                    {mission.usd_reward && (
                      <div className="flex items-center gap-1 text-green-400 font-bold">
                        <Award className="w-5 h-5" />
                        ${mission.usd_reward}
                      </div>
                    )}
                  </div>
                </div>

                {mission.instructions && (
                  <p className="text-gray-400 mb-4 text-sm">{mission.instructions}</p>
                )}

                {/* Progress Bar */}
                <div className="mb-4">
                  <div className="flex justify-between text-xs text-gray-500 mb-2">
                    <span>Progress</span>
                    <span>{mission.current_count} / {mission.target_count}</span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-yellow-500 to-amber-500 h-2 rounded-full transition-all"
                      style={{ width: `${Math.min(100, (mission.current_count / mission.target_count) * 100)}%` }}
                    />
                  </div>
                </div>

                {/* CTA */}
                {walletAddress ? (
                  <button className="px-4 py-2 bg-yellow-500 text-black font-bold rounded-lg hover:bg-yellow-400 transition-colors">
                    Claim Mission
                  </button>
                ) : (
                  <button className="px-4 py-2 bg-gray-700 text-gray-400 rounded-lg cursor-not-allowed">
                    Connect wallet to claim
                  </button>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
