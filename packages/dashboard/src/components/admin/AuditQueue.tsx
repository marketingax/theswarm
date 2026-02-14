'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, CheckCircle, XCircle, ExternalLink } from 'lucide-react';

interface Claim {
  id: string;
  agent_id: string;
  agent_name: string;
  mission_id: string;
  mission_title: string;
  proof_url: string;
  proof_notes: string;
  submitted_at: string;
  staked_xp: number;
  reason_flagged: string;
}

export default function AuditQueue() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);

  useEffect(() => {
    loadClaims();
  }, []);

  const loadClaims = async () => {
    try {
      const response = await fetch('/api/admin/audits/queue');
      const data = await response.json();
      if (data.success) {
        setClaims(data.claims);
      }
    } catch (err) {
      console.error('Failed to load audit queue:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (claimId: string) => {
    try {
      const response = await fetch(`/api/admin/audits/${claimId}/approve`, {
        method: 'POST',
      });

      if (response.ok) {
        loadClaims();
        setSelectedClaim(null);
      }
    } catch (err) {
      console.error('Failed to approve claim:', err);
    }
  };

  const handleReject = async () => {
    if (!selectedClaim || !rejectionReason.trim()) return;

    try {
      const response = await fetch(`/api/admin/audits/${selectedClaim.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectionReason }),
      });

      if (response.ok) {
        loadClaims();
        setSelectedClaim(null);
        setShowRejectModal(false);
        setRejectionReason('');
      }
    } catch (err) {
      console.error('Failed to reject claim:', err);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4 animate-pulse">⏳</div>
        <p className="text-gray-400">Loading audit queue...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <AlertCircle className="w-6 h-6 text-orange-400" />
          Audit Queue
        </h2>
        <p className="text-gray-400">
          {claims.length} claim{claims.length !== 1 ? 's' : ''} waiting for manual review
        </p>
      </div>

      {/* Queue List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-3"
      >
        {claims.length === 0 ? (
          <div className="text-center py-12 bg-gray-900/50 border border-gray-800 rounded-lg">
            <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-400 opacity-50" />
            <p className="text-gray-400">All claims are processed!</p>
            <p className="text-sm text-gray-500">Great work keeping The Swarm clean. 🐝</p>
          </div>
        ) : (
          claims.map((claim, idx) => (
            <motion.div
              key={claim.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              onClick={() => setSelectedClaim(claim)}
              className="bg-gray-900/50 border border-orange-500/30 rounded-lg p-4 hover:border-orange-500/50 cursor-pointer transition-all hover:bg-gray-900/80"
            >
              <div className="mb-3">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-bold text-lg">{claim.mission_title}</h3>
                    <p className="text-sm text-gray-400">Claimed by {claim.agent_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-yellow-400">{claim.staked_xp} XP</p>
                    <p className="text-xs text-gray-400">staked</p>
                  </div>
                </div>

                <div className="bg-orange-500/10 border border-orange-500/30 rounded p-2 mb-3">
                  <p className="text-xs text-orange-400 font-medium">Reason Flagged</p>
                  <p className="text-sm text-orange-300">{claim.reason_flagged}</p>
                </div>

                <div className="text-xs text-gray-500">
                  Submitted: {new Date(claim.submitted_at).toLocaleString()}
                </div>
              </div>

              {claim.proof_notes && (
                <div className="mb-3 p-2 bg-gray-800/50 rounded text-sm">
                  <p className="text-gray-400">{claim.proof_notes}</p>
                </div>
              )}

              {claim.proof_url && (
                <a
                  href={claim.proof_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                >
                  <ExternalLink className="w-3 h-3" />
                  View Proof
                </a>
              )}
            </motion.div>
          ))
        )}
      </motion.div>

      {/* Claim Detail Modal */}
      {selectedClaim && (
        <AuditClaimModal
          claim={selectedClaim}
          onClose={() => setSelectedClaim(null)}
          onApprove={() => handleApprove(selectedClaim.id)}
          onReject={() => setShowRejectModal(true)}
        />
      )}

      {/* Rejection Modal */}
      {showRejectModal && selectedClaim && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowRejectModal(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={e => e.stopPropagation()}
            className="bg-gray-900 border border-red-500/30 rounded-xl max-w-md w-full p-6"
          >
            <h2 className="text-2xl font-bold mb-4">Reject Claim</h2>

            <div className="mb-4">
              <p className="text-gray-400 mb-2">Claim: {selectedClaim.mission_title}</p>
              <p className="text-sm text-gray-500">
                Agent: <span className="font-bold">{selectedClaim.agent_name}</span>
              </p>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">Rejection Reason</label>
              <textarea
                value={rejectionReason}
                onChange={e => setRejectionReason(e.target.value)}
                placeholder="Why are you rejecting this claim?"
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-red-500 min-h-24"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowRejectModal(false)}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-medium py-2 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-2 rounded transition-colors"
              >
                Reject
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function AuditClaimModal({
  claim,
  onClose,
  onApprove,
  onReject,
}: {
  claim: Claim;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
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
          <h2 className="text-2xl font-bold">Audit Review</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">
            ×
          </button>
        </div>

        <div className="space-y-4 mb-6">
          <div>
            <p className="text-gray-400 text-sm mb-1">Mission</p>
            <p className="text-lg font-bold">{claim.mission_title}</p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <p className="text-gray-400 text-sm mb-1">Agent</p>
              <p className="font-bold">{claim.agent_name}</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm mb-1">XP Staked</p>
              <p className="font-bold text-yellow-400">{claim.staked_xp}</p>
            </div>
          </div>

          <div>
            <p className="text-gray-400 text-sm mb-1">Reason Flagged</p>
            <p className="bg-orange-500/10 border border-orange-500/30 rounded p-3 text-orange-300">
              {claim.reason_flagged}
            </p>
          </div>

          {claim.proof_notes && (
            <div>
              <p className="text-gray-400 text-sm mb-1">Submission Notes</p>
              <p className="bg-gray-800/50 rounded p-3">{claim.proof_notes}</p>
            </div>
          )}

          {claim.proof_url && (
            <div>
              <p className="text-gray-400 text-sm mb-2">Proof</p>
              <a
                href={claim.proof_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 bg-blue-500/10 border border-blue-500/30 rounded px-3 py-2 text-sm"
              >
                <ExternalLink className="w-4 h-4" />
                View Proof
              </a>
            </div>
          )}

          <div className="text-xs text-gray-500">
            Submitted: {new Date(claim.submitted_at).toLocaleString()}
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onReject}
            className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors"
          >
            <XCircle className="w-5 h-5" />
            Reject
          </button>
          <button
            onClick={onApprove}
            className="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors"
          >
            <CheckCircle className="w-5 h-5" />
            Approve & Release XP
          </button>
        </div>
      </motion.div>
    </div>
  );
}
