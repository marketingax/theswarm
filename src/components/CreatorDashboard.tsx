'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Creator {
  id: string;
  agent_id: string;
  agent_name: string;
  status: 'pending' | 'approved' | 'active' | 'suspended' | 'rejected';
  category: string;
  follower_count: number;
  revenue_share: number;
  social_handle: string;
  social_proof_url: string;
  onboarded_at: string;
  approved_at?: string;
  rejection_reason?: string;
}

interface CreatorEarnings {
  creator_id: string;
  total_earned: number;
  total_paid: number;
  pending_payout: number;
  last_payout_date?: string;
}

const categoryIcons: { [key: string]: string } = {
  youtube: '📺',
  twitch: '🎮',
  tiktok: '🎵',
  instagram: '📷',
  podcast: '🎙️',
  newsletter: '📰',
  other: '🌐'
};

export default function CreatorDashboard() {
  const [creators, setCreators] = useState<Creator[]>([]);
  const [earnings, setEarnings] = useState<{ [key: string]: CreatorEarnings }>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchCreators();
    fetchEarnings();
  }, [filter]);

  const fetchCreators = async () => {
    try {
      const sessionToken = document.cookie
        .split('; ')
        .find(row => row.startsWith('session_token='))
        ?.split('=')[1];

      if (!sessionToken) return;

      const response = await fetch(`/api/admin/creators?status=${filter}`, {
        headers: {
          'Authorization': `Bearer ${sessionToken}`
        }
      });

      const data = await response.json();
      if (data.success) {
        setCreators(data.creators);
      }
    } catch (error) {
      console.error('Failed to fetch creators:', error);
      setError('Failed to load creators');
    } finally {
      setLoading(false);
    }
  };

  const fetchEarnings = async () => {
    try {
      const sessionToken = document.cookie
        .split('; ')
        .find(row => row.startsWith('session_token='))
        ?.split('=')[1];

      if (!sessionToken) return;

      const response = await fetch('/api/admin/creator-earnings', {
        headers: {
          'Authorization': `Bearer ${sessionToken}`
        }
      });

      const data = await response.json();
      if (data.success) {
        setEarnings(data.earnings);
      }
    } catch (error) {
      console.error('Failed to fetch earnings:', error);
    }
  };

  const handleApprove = async (creatorId: string) => {
    try {
      const sessionToken = document.cookie
        .split('; ')
        .find(row => row.startsWith('session_token='))
        ?.split('=')[1];

      if (!sessionToken) return;

      const response = await fetch('/api/creators/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          creator_id: creatorId,
          approve: true
        })
      });

      const data = await response.json();
      if (data.success) {
        fetchCreators();
      }
    } catch (error) {
      console.error('Failed to approve creator:', error);
    }
  };

  const handleReject = async (creatorId: string, reason: string) => {
    try {
      const sessionToken = document.cookie
        .split('; ')
        .find(row => row.startsWith('session_token='))
        ?.split('=')[1];

      if (!sessionToken) return;

      const response = await fetch('/api/creators/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          creator_id: creatorId,
          approve: false,
          rejection_reason: reason
        })
      });

      const data = await response.json();
      if (data.success) {
        fetchCreators();
      }
    } catch (error) {
      console.error('Failed to reject creator:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-slate-400">Loading creators...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold text-white mb-2">Creator Management</h2>
        <p className="text-slate-400">Manage creator program applications and earnings</p>
      </div>

      {error && (
        <div className="p-4 bg-red-500 bg-opacity-10 border border-red-500 rounded-lg text-red-200">
          {error}
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-slate-700">
        {['pending', 'approved', 'active', 'suspended', 'rejected'].map(status => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 font-semibold transition-colors ${
              filter === status
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      {/* Creators Table */}
      <div className="bg-slate-700 bg-opacity-50 rounded-lg border border-slate-600 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-800 bg-opacity-50 border-b border-slate-600">
              <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Creator</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Category</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Followers</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Revenue Share</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Earnings</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Status</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Actions</th>
            </tr>
          </thead>
          <tbody>
            {creators.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-slate-400">
                  No creators found
                </td>
              </tr>
            ) : (
              creators.map(creator => {
                const creatorEarnings = earnings[creator.id] || {
                  total_earned: 0,
                  total_paid: 0,
                  pending_payout: 0
                };
                return (
                  <tr key={creator.id} className="border-b border-slate-600 hover:bg-slate-600 hover:bg-opacity-20 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-semibold text-white">{creator.agent_name}</span>
                        <a
                          href={creator.social_proof_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-400 hover:text-blue-300"
                        >
                          {creator.social_handle}
                        </a>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-white">
                      {categoryIcons[creator.category]} {creator.category.charAt(0).toUpperCase() + creator.category.slice(1)}
                    </td>
                    <td className="px-6 py-4 text-white">
                      {creator.follower_count.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-white">
                      {(creator.revenue_share * 100).toFixed(0)}%
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col text-sm">
                        <span className="text-slate-300">Total: <span className="text-white font-semibold">${creatorEarnings.total_earned.toFixed(2)}</span></span>
                        <span className="text-slate-400">Pending: <span className="text-yellow-400">${creatorEarnings.pending_payout.toFixed(2)}</span></span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        creator.status === 'active' ? 'bg-green-500 bg-opacity-20 text-green-300' :
                        creator.status === 'pending' ? 'bg-yellow-500 bg-opacity-20 text-yellow-300' :
                        creator.status === 'suspended' ? 'bg-red-500 bg-opacity-20 text-red-300' :
                        creator.status === 'approved' ? 'bg-blue-500 bg-opacity-20 text-blue-300' :
                        'bg-slate-500 bg-opacity-20 text-slate-300'
                      }`}>
                        {creator.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {creator.status === 'pending' && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleApprove(creator.id)}
                            className="px-3 py-1 rounded text-xs bg-green-600 text-white hover:bg-green-700 transition-colors"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => {
                              const reason = prompt('Rejection reason:');
                              if (reason) handleReject(creator.id, reason);
                            }}
                            className="px-3 py-1 rounded text-xs bg-red-600 text-white hover:bg-red-700 transition-colors"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                      {creator.status === 'active' && (
                        <Link
                          href={`/admin/creators/${creator.id}`}
                          className="text-blue-400 hover:text-blue-300 text-sm"
                        >
                          View Details →
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
