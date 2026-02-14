'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, ChevronDown, Plus, Trash2, Clock } from 'lucide-react';

interface TrustEvent {
  id: string;
  agent_id: string;
  agent_name: string;
  previous_tier: string;
  new_tier: string;
  reason: string;
  created_at: string;
  changed_by: string;
}

interface Agent {
  id: string;
  name: string;
  wallet_address: string;
  trust_tier: string;
  fraud_flags: number;
  verified_claims: number;
  total_claims: number;
  probation_until: string | null;
}

type TrustTier = 'trusted' | 'normal' | 'probation' | 'blacklist';

export default function TrustManagement() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [trustHistory, setTrustHistory] = useState<TrustEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [showChangeModal, setShowChangeModal] = useState(false);
  const [newTier, setNewTier] = useState<TrustTier>('normal');
  const [reason, setReason] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [agentsRes, historyRes] = await Promise.all([
        fetch('/api/admin/trust/agents'),
        fetch('/api/admin/trust/history'),
      ]);

      const agentsData = await agentsRes.json();
      const historyData = await historyRes.json();

      if (agentsData.success) setAgents(agentsData.agents);
      if (historyData.success) setTrustHistory(historyData.history);
    } catch (err) {
      console.error('Failed to load trust data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleChangeTrust = async () => {
    if (!selectedAgent || !reason.trim()) return;

    try {
      const response = await fetch(`/api/admin/trust/change`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_id: selectedAgent.id,
          new_tier: newTier,
          reason,
        }),
      });

      if (response.ok) {
        setShowChangeModal(false);
        setReason('');
        loadData();
      }
    } catch (err) {
      console.error('Failed to change trust tier:', err);
    }
  };

  const getTierColor = (tier: string) => {
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

  const probationAgents = agents.filter(a => a.trust_tier === 'probation');
  const blacklistAgents = agents.filter(a => a.trust_tier === 'blacklist');
  const flaggedAgents = agents.filter(a => a.fraud_flags > 0);

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4 animate-pulse">🛡️</div>
        <p className="text-gray-400">Loading trust data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <Shield className="w-6 h-6 text-blue-400" />
          Trust Management
        </h2>
      </div>

      {/* Quick Stats */}
      <div className="grid md:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4"
        >
          <p className="text-yellow-400 text-sm font-medium mb-1">On Probation</p>
          <p className="text-3xl font-bold text-yellow-400">{probationAgents.length}</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-red-500/10 border border-red-500/30 rounded-lg p-4"
        >
          <p className="text-red-400 text-sm font-medium mb-1">Blacklisted</p>
          <p className="text-3xl font-bold text-red-400">{blacklistAgents.length}</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4"
        >
          <p className="text-orange-400 text-sm font-medium mb-1">Flagged for Review</p>
          <p className="text-3xl font-bold text-orange-400">{flaggedAgents.length}</p>
        </motion.div>
      </div>

      {/* Probation Agents */}
      {probationAgents.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gray-900/50 border border-yellow-500/30 rounded-lg p-6"
        >
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-yellow-400" />
            Agents on Probation
          </h3>
          <div className="space-y-3">
            {probationAgents.map(agent => (
              <TrustAgentCard
                key={agent.id}
                agent={agent}
                onSelect={() => {
                  setSelectedAgent(agent);
                  setNewTier(agent.trust_tier as TrustTier);
                  setShowChangeModal(true);
                }}
              />
            ))}
          </div>
        </motion.div>
      )}

      {/* Blacklist Agents */}
      {blacklistAgents.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gray-900/50 border border-red-500/30 rounded-lg p-6"
        >
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-red-400" />
            Blacklisted Agents
          </h3>
          <div className="space-y-3">
            {blacklistAgents.map(agent => (
              <TrustAgentCard
                key={agent.id}
                agent={agent}
                onSelect={() => {
                  setSelectedAgent(agent);
                  setNewTier(agent.trust_tier as TrustTier);
                  setShowChangeModal(true);
                }}
              />
            ))}
          </div>
        </motion.div>
      )}

      {/* All Agents by Trust Tier */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gray-900/50 border border-gray-800 rounded-lg p-6"
      >
        <h3 className="text-lg font-bold mb-4">All Agents - Trust Overview</h3>
        <div className="space-y-3">
          {agents.map(agent => (
            <div
              key={agent.id}
              className="flex items-center justify-between p-3 bg-gray-800/30 rounded hover:bg-gray-800/50 transition-colors cursor-pointer"
              onClick={() => {
                setSelectedAgent(agent);
                setNewTier(agent.trust_tier as TrustTier);
                setShowChangeModal(true);
              }}
            >
              <div className="flex-1">
                <p className="font-medium">{agent.name}</p>
                <p className="text-xs text-gray-400">
                  {agent.verified_claims}/{agent.total_claims} verified claims
                </p>
              </div>
              <div className="text-right">
                <span className={`px-3 py-1 rounded text-sm ${getTierColor(agent.trust_tier)}`}>
                  {agent.trust_tier}
                </span>
                {agent.fraud_flags > 0 && (
                  <p className="text-xs text-red-400 mt-1">
                    {agent.fraud_flags} flag{agent.fraud_flags !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Trust Change History */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gray-900/50 border border-gray-800 rounded-lg p-6"
      >
        <h3 className="text-lg font-bold mb-4">Recent Changes</h3>
        <div className="space-y-2">
          {trustHistory.slice(0, 10).map(event => (
            <div key={event.id} className="text-sm p-3 bg-gray-800/30 rounded">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium">{event.agent_name}</p>
                  <p className="text-gray-400">
                    {event.previous_tier} → {event.new_tier}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{event.reason}</p>
                </div>
                <p className="text-xs text-gray-500">
                  {new Date(event.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Trust Change Modal */}
      {showChangeModal && selectedAgent && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowChangeModal(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={e => e.stopPropagation()}
            className="bg-gray-900 border border-yellow-500/30 rounded-xl max-w-md w-full p-6"
          >
            <h2 className="text-2xl font-bold mb-4">Change Trust Tier</h2>

            <div className="mb-4">
              <p className="text-gray-400 mb-2">Agent: {selectedAgent.name}</p>
              <p className="text-sm text-gray-500">
                Current Tier: <span className="font-bold capitalize">{selectedAgent.trust_tier}</span>
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">New Trust Tier</label>
              <select
                value={newTier}
                onChange={e => setNewTier(e.target.value as TrustTier)}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-yellow-500"
              >
                <option value="trusted">Trusted</option>
                <option value="normal">Normal</option>
                <option value="probation">Probation</option>
                <option value="blacklist">Blacklist</option>
              </select>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">Reason</label>
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Why are you making this change?"
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500 min-h-20"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowChangeModal(false)}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-medium py-2 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleChangeTrust}
                className="flex-1 bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-2 rounded transition-colors"
              >
                Update
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function TrustAgentCard({
  agent,
  onSelect,
}: {
  agent: Agent;
  onSelect: () => void;
}) {
  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'trusted':
        return 'text-green-400';
      case 'normal':
        return 'text-blue-400';
      case 'probation':
        return 'text-yellow-400';
      case 'blacklist':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  return (
    <div
      onClick={onSelect}
      className="flex items-center justify-between p-3 bg-gray-800/30 hover:bg-gray-800/50 rounded transition-colors cursor-pointer"
    >
      <div className="flex-1">
        <p className="font-medium">{agent.name}</p>
        <p className="text-xs text-gray-400">
          {agent.verified_claims}/{agent.total_claims} verified | {agent.fraud_flags} flags
        </p>
        {agent.probation_until && (
          <p className="text-xs text-yellow-400 mt-1">
            Probation until: {new Date(agent.probation_until).toLocaleDateString()}
          </p>
        )}
      </div>
      <button className="text-gray-400 hover:text-white">
        <ChevronDown className="w-5 h-5" />
      </button>
    </div>
  );
}
