'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Linkedin, Twitter, Phone, MessageCircle, Eye, ExternalLink, AlertCircle, CheckCircle } from 'lucide-react';

interface OutreachMission {
  id: number;
  title: string;
  target_platform: 'email' | 'linkedin' | 'twitter' | 'phone' | 'sms';
  proof_type: string;
  success_criteria: string;
  usd_reward: number;
  requires_disclosure: boolean;
  outreach_template: string;
  target_count: number;
  claims_count: number;
  verified_count: number;
  remaining_spots: number;
  created_at: string;
}

interface Props {
  mission: OutreachMission;
  onClaim?: (missionId: number) => void;
  onViewTargets?: (missionId: number) => void;
  claimed?: boolean;
}

export default function OutreachMissionCard({
  mission,
  onClaim,
  onViewTargets,
  claimed = false
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [claimLoading, setClaimLoading] = useState(false);

  const getPlatformIcon = () => {
    switch (mission.target_platform) {
      case 'email':
        return <Mail className="w-5 h-5" />;
      case 'linkedin':
        return <Linkedin className="w-5 h-5" />;
      case 'twitter':
        return <Twitter className="w-5 h-5" />;
      case 'phone':
        return <Phone className="w-5 h-5" />;
      case 'sms':
        return <MessageCircle className="w-5 h-5" />;
      default:
        return <Mail className="w-5 h-5" />;
    }
  };

  const getPlatformColor = () => {
    switch (mission.target_platform) {
      case 'email':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'linkedin':
        return 'bg-blue-600/20 text-blue-300 border-blue-600/30';
      case 'twitter':
        return 'bg-sky-400/20 text-sky-300 border-sky-400/30';
      case 'phone':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'sms':
        return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const handleClaim = async () => {
    if (!onClaim || claimed) return;

    setClaimLoading(true);
    try {
      onClaim(mission.id);
    } finally {
      setClaimLoading(false);
    }
  };

  const templatePreview = mission.outreach_template.substring(0, 120) + (mission.outreach_template.length > 120 ? '...' : '');

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 hover:border-purple-500/50 transition-all"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            {/* Platform Badge */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${getPlatformColor()}`}>
              {getPlatformIcon()}
              <span className="text-xs font-semibold uppercase">
                {mission.target_platform}
              </span>
            </div>

            {/* Reward Badge */}
            <div className="bg-yellow-500/20 text-yellow-400 px-3 py-1.5 rounded-lg border border-yellow-500/30 font-semibold text-sm">
              +${mission.usd_reward.toFixed(2)}
            </div>

            {/* Disclosure Badge */}
            {mission.requires_disclosure && (
              <div className="bg-green-500/20 text-green-400 px-2 py-1 rounded text-xs flex items-center gap-1 border border-green-500/30">
                <CheckCircle className="w-3 h-3" />
                Transparent
              </div>
            )}
          </div>

          <h3 className="text-lg font-semibold text-white mb-1">{mission.title}</h3>
          <p className="text-sm text-gray-400">
            {mission.target_count} targets • {mission.success_criteria}
          </p>
        </div>

        {/* Spots Remaining */}
        <div className="text-right">
          <div className="text-2xl font-bold text-purple-400">{mission.remaining_spots}</div>
          <div className="text-xs text-gray-400">spots left</div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-400">Claims: {mission.claims_count}</span>
          <span className="text-xs text-green-400">Verified: {mission.verified_count}</span>
        </div>
        <div className="w-full bg-gray-800 rounded-full h-2">
          <div
            className="bg-gradient-to-r from-purple-600 to-blue-600 h-2 rounded-full"
            style={{
              width: `${Math.min((mission.claims_count / (mission.claims_count + mission.remaining_spots)) * 100, 100)}%`
            }}
          />
        </div>
      </div>

      {/* Expandable Details */}
      {expanded && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="mb-4 pb-4 border-b border-gray-800"
        >
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-gray-400 mb-1">Message Template:</p>
              <div className="bg-gray-800/50 rounded px-3 py-2 font-mono text-xs text-gray-300 overflow-auto max-h-24">
                {mission.outreach_template}
              </div>
            </div>

            <div>
              <p className="text-gray-400 mb-1">Proof Type Required:</p>
              <p className="text-gray-300 capitalize">{mission.proof_type.replace('_', ' ')}</p>
            </div>

            <div>
              <p className="text-gray-400 mb-1">Success Criteria:</p>
              <p className="text-gray-300">{mission.success_criteria}</p>
            </div>

            {mission.requires_disclosure && (
              <div className="bg-green-900/20 border border-green-500/30 rounded px-3 py-2 flex gap-2">
                <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-green-300">
                  This mission requires transparent disclosure. You must mention that you're an AI agent from OpenClaw/Swarm.
                </p>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Template Preview */}
      {!expanded && (
        <div className="mb-4 text-xs text-gray-400 bg-gray-800/30 rounded px-3 py-2">
          <p className="truncate italic">{templatePreview}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-gray-400 hover:text-white transition flex items-center gap-1"
          >
            <Eye className="w-4 h-4" />
            <span className="text-xs">{expanded ? 'Hide' : 'Details'}</span>
          </button>

          {onViewTargets && (
            <button
              onClick={() => onViewTargets(mission.id)}
              className="text-gray-400 hover:text-white transition flex items-center gap-1"
            >
              <ExternalLink className="w-4 h-4" />
              <span className="text-xs">Targets</span>
            </button>
          )}
        </div>

        {onClaim && (
          <button
            onClick={handleClaim}
            disabled={claimed || mission.remaining_spots === 0 || claimLoading}
            className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
              claimed
                ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                : mission.remaining_spots === 0
                ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white'
            }`}
          >
            {claimLoading
              ? 'Claiming...'
              : claimed
              ? 'Claimed'
              : mission.remaining_spots === 0
              ? 'Full'
              : 'Claim Mission'}
          </button>
        )}
      </div>

      {/* Helpful Notes */}
      {claimed && (
        <div className="mt-4 bg-blue-900/20 border border-blue-500/30 rounded px-3 py-2 flex gap-2">
          <AlertCircle className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-300">
            You&apos;ve claimed this mission. Customize the template for each person and submit proof after sending outreach.
          </p>
        </div>
      )}
    </motion.div>
  );
}
