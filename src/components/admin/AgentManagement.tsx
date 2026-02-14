'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Users, ChevronRight, Search, SortAsc } from 'lucide-react';

interface Agent {
  id: string;
  name: string;
  xp: number;
  rank_title: string;
  trust_tier: string;
  missions_completed: number;
  is_verified: boolean;
  created_at: string;
  wallet_address: string;
}

type SortBy = 'xp' | 'trust_tier' | 'created_at' | 'missions_completed';

export default function AgentManagement() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [filteredAgents, setFilteredAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('xp');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const pageSize = 20;

  useEffect(() => {
    loadAgents();
  }, []);

  useEffect(() => {
    filterAndSort();
  }, [agents, searchTerm, sortBy]);

  const loadAgents = async () => {
    try {
      const response = await fetch('/api/admin/agents');
      const data = await response.json();
      if (data.success) {
        setAgents(data.agents);
      }
    } catch (err) {
      console.error('Failed to load agents:', err);
    } finally {
      setLoading(false);
    }
  };

  const filterAndSort = () => {
    let filtered = agents.filter(agent =>
      agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      agent.wallet_address.includes(searchTerm)
    );

    // Sort by the selected criteria
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'xp':
          return b.xp - a.xp;
        case 'missions_completed':
          return b.missions_completed - a.missions_completed;
        case 'created_at':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'trust_tier':
          const tierOrder: { [key: string]: number } = {
            'trusted': 0,
            'normal': 1,
            'probation': 2,
            'blacklist': 3,
          };
          return (tierOrder[a.trust_tier] || 99) - (tierOrder[b.trust_tier] || 99);
        default:
          return 0;
      }
    });

    setFilteredAgents(filtered);
    setCurrentPage(1);
  };

  const getTrustColor = (tier: string) => {
    switch (tier) {
      case 'trusted':
        return 'bg-green-500/20 text-green-400 border border-green-500/30';
      case 'normal':
        return 'bg-blue-500/20 text-blue-400 border border-blue-500/30';
      case 'probation':
        return 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30';
      case 'blacklist':
        return 'bg-red-500/20 text-red-400 border border-red-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border border-gray-500/30';
    }
  };

  const paginatedAgents = filteredAgents.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const totalPages = Math.ceil(filteredAgents.length / pageSize);

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4 animate-pulse">👥</div>
        <p className="text-gray-400">Loading agents...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <Users className="w-6 h-6 text-blue-400" />
          Agent Management
        </h2>
        <p className="text-gray-400">
          Total: {agents.length} agents | Showing: {paginatedAgents.length} per page
        </p>
      </div>

      {/* Controls */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search by name or wallet..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500"
          />
        </div>

        <div>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as SortBy)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-yellow-500"
          >
            <option value="xp">Sort by XP (High to Low)</option>
            <option value="missions_completed">Sort by Missions</option>
            <option value="created_at">Sort by Join Date</option>
            <option value="trust_tier">Sort by Trust Tier</option>
          </select>
        </div>

        <button
          onClick={loadAgents}
          className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-2 px-4 rounded-lg transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Agent List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-2"
      >
        {paginatedAgents.length === 0 ? (
          <div className="text-center py-12 bg-gray-900/50 border border-gray-800 rounded-lg">
            <p className="text-gray-400">No agents found</p>
          </div>
        ) : (
          paginatedAgents.map((agent, idx) => (
            <motion.div
              key={agent.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              onClick={() => setSelectedAgent(agent)}
              className="bg-gray-900/50 border border-gray-800 hover:border-yellow-500/50 rounded-lg p-4 cursor-pointer transition-all hover:bg-gray-900/80"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-bold text-lg">{agent.name}</h3>
                    <span
                      className={`text-xs px-2 py-1 rounded ${getTrustColor(agent.trust_tier)}`}
                    >
                      {agent.trust_tier}
                    </span>
                    {agent.is_verified && (
                      <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded">
                        ✓ Verified
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-4 gap-4 text-sm text-gray-400">
                    <div>
                      <p className="text-xs">Rank</p>
                      <p className="text-white font-semibold">{agent.rank_title}</p>
                    </div>
                    <div>
                      <p className="text-xs">XP</p>
                      <p className="text-yellow-400 font-semibold">
                        {agent.xp.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs">Missions</p>
                      <p className="text-white font-semibold">
                        {agent.missions_completed}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs">Joined</p>
                      <p className="text-white font-semibold">
                        {new Date(agent.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-600" />
              </div>
            </motion.div>
          ))
        )}
      </motion.div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-400">
            Page {currentPage} of {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Previous
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const pageNum = Math.max(1, currentPage - 2) + i;
              if (pageNum > totalPages) return null;
              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`px-3 py-2 rounded-lg transition-colors ${
                    currentPage === pageNum
                      ? 'bg-yellow-500 text-black font-bold'
                      : 'bg-gray-800 hover:bg-gray-700 text-white'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Agent Detail Modal */}
      {selectedAgent && (
        <AgentDetailModal
          agent={selectedAgent}
          onClose={() => setSelectedAgent(null)}
        />
      )}
    </div>
  );
}

function AgentDetailModal({
  agent,
  onClose,
}: {
  agent: Agent;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={e => e.stopPropagation()}
        className="bg-gray-900 border border-yellow-500/30 rounded-xl max-w-2xl w-full p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">{agent.name}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl"
          >
            ×
          </button>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-bold text-gray-400 mb-3">Profile Info</h3>
            <div className="space-y-2 text-sm">
              <div>
                <p className="text-gray-500">Agent ID</p>
                <p className="font-mono text-white break-all">{agent.id}</p>
              </div>
              <div>
                <p className="text-gray-500">Wallet</p>
                <p className="font-mono text-white break-all">
                  {agent.wallet_address}
                </p>
              </div>
              <div>
                <p className="text-gray-500">Rank</p>
                <p className="text-white font-bold">{agent.rank_title}</p>
              </div>
              <div>
                <p className="text-gray-500">Joined</p>
                <p className="text-white">
                  {new Date(agent.created_at).toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-bold text-gray-400 mb-3">Stats</h3>
            <div className="space-y-2">
              <div className="bg-gray-800/50 rounded-lg p-3">
                <p className="text-gray-400 text-sm">Total XP</p>
                <p className="text-2xl font-bold text-yellow-400">
                  {agent.xp.toLocaleString()}
                </p>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-3">
                <p className="text-gray-400 text-sm">Missions Completed</p>
                <p className="text-2xl font-bold text-blue-400">
                  {agent.missions_completed}
                </p>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-3">
                <p className="text-gray-400 text-sm">Trust Tier</p>
                <p className="text-xl font-bold capitalize text-white">
                  {agent.trust_tier}
                </p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
