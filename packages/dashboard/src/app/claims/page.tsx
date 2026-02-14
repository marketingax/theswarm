'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, Clock, XCircle, ExternalLink } from 'lucide-react';

interface Claim {
  id: string;
  mission_id: number;
  status: 'submitted' | 'verified' | 'rejected';
  submitted_at: string;
  verified_at?: string;
  rejected_at?: string;
  proof_url: string;
  xp_earned?: number;
}

export default function ClaimsPage() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const wallet = localStorage.getItem('walletAddress');
    if (wallet) {
      loadClaims(wallet);
    } else {
      setLoading(false);
    }
  }, []);

  const loadClaims = async (wallet: string) => {
    try {
      const res = await fetch(`/api/claims?wallet=${wallet}`);
      const data = await res.json();
      if (data.success) {
        setClaims(data.claims || []);
      }
    } catch (err) {
      console.error('Failed to load claims:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'verified':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'rejected':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'submitted':
        return <Clock className="w-5 h-5 text-yellow-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'verified':
        return 'bg-green-500/10 text-green-500 border-green-500/30';
      case 'rejected':
        return 'bg-red-500/10 text-red-500 border-red-500/30';
      case 'submitted':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30';
      default:
        return 'bg-gray-500/10 text-gray-500 border-gray-500/30';
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-pulse">🐝</div>
          <p className="text-gray-400">Loading claims...</p>
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
          <div>
            <h1 className="text-5xl font-black mb-2">Claims History</h1>
            <p className="text-gray-500">Track your mission submissions and verifications</p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-gray-900 border border-yellow-500/20 rounded-xl p-4">
              <div className="text-gray-500 text-sm mb-2">Submitted</div>
              <div className="text-3xl font-black text-yellow-500">
                {claims.filter(c => c.status === 'submitted').length}
              </div>
            </div>
            <div className="bg-gray-900 border border-green-500/20 rounded-xl p-4">
              <div className="text-gray-500 text-sm mb-2">Verified</div>
              <div className="text-3xl font-black text-green-500">
                {claims.filter(c => c.status === 'verified').length}
              </div>
            </div>
            <div className="bg-gray-900 border border-red-500/20 rounded-xl p-4">
              <div className="text-gray-500 text-sm mb-2">Rejected</div>
              <div className="text-3xl font-black text-red-500">
                {claims.filter(c => c.status === 'rejected').length}
              </div>
            </div>
          </div>

          {/* Claims List */}
          <div className="space-y-4">
            {claims.length === 0 ? (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-12 text-center">
                <div className="text-6xl mb-4">🔍</div>
                <p className="text-gray-400 text-lg">No claims yet</p>
                <a href="/dashboard" className="text-yellow-500 hover:text-yellow-400 mt-4 inline-block">
                  → Start completing missions
                </a>
              </div>
            ) : (
              claims.map((claim, i) => (
                <motion.div
                  key={claim.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-xl p-6 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        {getStatusIcon(claim.status)}
                        <span className={`px-3 py-1 rounded-full text-sm font-semibold border ${getStatusColor(claim.status)}`}>
                          {claim.status.charAt(0).toUpperCase() + claim.status.slice(1)}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mb-3">
                        <div>
                          <p className="text-gray-500 text-sm">Mission</p>
                          <p className="font-semibold">Mission #{claim.mission_id}</p>
                        </div>
                        <div>
                          <p className="text-gray-500 text-sm">Submitted</p>
                          <p className="font-semibold">
                            {new Date(claim.submitted_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      <div>
                        <p className="text-gray-500 text-sm mb-1">Proof</p>
                        <a 
                          href={claim.proof_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-yellow-500 hover:text-yellow-400 flex items-center gap-2 text-sm"
                        >
                          View Proof
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                    </div>

                    {claim.xp_earned && (
                      <div className="text-right">
                        <p className="text-gray-500 text-sm mb-1">XP Earned</p>
                        <p className="text-2xl font-black text-yellow-500">+{claim.xp_earned}</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))
            )}
          </div>

          {/* Navigation */}
          <div className="flex gap-4">
            <a href="/profile" className="flex-1 bg-gray-900 hover:bg-gray-800 border border-gray-700 text-white font-bold py-3 rounded-lg text-center transition-colors">
              ← Profile
            </a>
            <a href="/payouts" className="flex-1 bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-3 rounded-lg text-center transition-colors">
              Payouts →
            </a>
          </div>
        </motion.div>
      </div>
    </main>
  );
}
