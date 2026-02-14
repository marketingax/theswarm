'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Target, Play, Pause, Trash2, Star, Search } from 'lucide-react';

interface Mission {
  id: string;
  title: string;
  type: string;
  creator_id: string;
  creator_name: string;
  target_url: string;
  current_claims: number;
  max_claims: number;
  xp_reward: number;
  status: 'open' | 'in_progress' | 'completed' | 'cancelled' | 'paused';
  created_at: string;
  stake_required: number;
}

type StatusFilter = 'all' | 'open' | 'in_progress' | 'completed' | 'cancelled' | 'paused';

export default function MissionMonitoring() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [filteredMissions, setFilteredMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadMissions();
  }, []);

  useEffect(() => {
    filterMissions();
  }, [missions, statusFilter, searchTerm]);

  const loadMissions = async () => {
    try {
      const response = await fetch('/api/admin/missions');
      const data = await response.json();
      if (data.success) {
        setMissions(data.missions);
      }
    } catch (err) {
      console.error('Failed to load missions:', err);
    } finally {
      setLoading(false);
    }
  };

  const filterMissions = () => {
    let filtered = missions;

    if (statusFilter !== 'all') {
      filtered = filtered.filter(m => m.status === statusFilter);
    }

    if (searchTerm) {
      filtered = filtered.filter(m =>
        m.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.creator_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredMissions(filtered);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-green-500/20 text-green-400 border border-green-500/30';
      case 'in_progress':
        return 'bg-blue-500/20 text-blue-400 border border-blue-500/30';
      case 'completed':
        return 'bg-purple-500/20 text-purple-400 border border-purple-500/30';
      case 'paused':
        return 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30';
      case 'cancelled':
        return 'bg-red-500/20 text-red-400 border border-red-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border border-gray-500/30';
    }
  };

  const handleStatusChange = async (missionId: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/admin/missions/${missionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        loadMissions();
      }
    } catch (err) {
      console.error('Failed to update mission:', err);
    }
  };

  const handleFeature = async (missionId: string) => {
    try {
      const response = await fetch(`/api/admin/missions/${missionId}/feature`, {
        method: 'POST',
      });

      if (response.ok) {
        loadMissions();
      }
    } catch (err) {
      console.error('Failed to feature mission:', err);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4 animate-pulse">🎯</div>
        <p className="text-gray-400">Loading missions...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <Target className="w-6 h-6 text-yellow-400" />
          Mission Monitoring
        </h2>
        <p className="text-gray-400">
          Total: {missions.length} missions | Showing: {filteredMissions.length}
        </p>
      </div>

      {/* Controls */}
      <div className="flex gap-4 flex-wrap">
        <div className="relative flex-1 min-w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search missions..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500"
          />
        </div>

        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as StatusFilter)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-yellow-500"
        >
          <option value="all">All Status</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="paused">Paused</option>
          <option value="cancelled">Cancelled</option>
        </select>

        <button
          onClick={loadMissions}
          className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-2 px-4 rounded-lg transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Missions List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-3"
      >
        {filteredMissions.length === 0 ? (
          <div className="text-center py-12 bg-gray-900/50 border border-gray-800 rounded-lg">
            <p className="text-gray-400">No missions found</p>
          </div>
        ) : (
          filteredMissions.map((mission, idx) => {
            const progress = mission.max_claims
              ? (mission.current_claims / mission.max_claims) * 100
              : 0;

            return (
              <motion.div
                key={mission.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 hover:border-yellow-500/50 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-bold text-lg mb-1">{mission.title}</h3>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-1 rounded">
                        {mission.type}
                      </span>
                      <span
                        className={`text-xs px-2 py-1 rounded ${getStatusColor(mission.status)}`}
                      >
                        {mission.status}
                      </span>
                      <span className="text-xs text-gray-400">
                        by {mission.creator_name}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-yellow-400">{mission.xp_reward} XP</p>
                    <p className="text-xs text-gray-400">reward</p>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm text-gray-400">
                      Claims: {mission.current_claims}/{mission.max_claims}
                    </p>
                    <p className="text-sm font-bold text-white">{progress.toFixed(0)}%</p>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-yellow-500 to-amber-600 h-full transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  {mission.status !== 'paused' && (
                    <button
                      onClick={() => handleStatusChange(mission.id, 'paused')}
                      className="flex-1 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 px-3 py-2 rounded text-sm font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      <Pause className="w-4 h-4" />
                      Pause
                    </button>
                  )}
                  {mission.status === 'paused' && (
                    <button
                      onClick={() => handleStatusChange(mission.id, 'open')}
                      className="flex-1 bg-green-500/20 hover:bg-green-500/30 text-green-400 px-3 py-2 rounded text-sm font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      <Play className="w-4 h-4" />
                      Resume
                    </button>
                  )}
                  {mission.status !== 'completed' && (
                    <button
                      onClick={() => handleStatusChange(mission.id, 'cancelled')}
                      className="flex-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 px-3 py-2 rounded text-sm font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      Cancel
                    </button>
                  )}
                  <button
                    onClick={() => handleFeature(mission.id)}
                    className="flex-1 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 px-3 py-2 rounded text-sm font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <Star className="w-4 h-4" />
                    Feature
                  </button>
                </div>
              </motion.div>
            );
          })
        )}
      </motion.div>
    </div>
  );
}
