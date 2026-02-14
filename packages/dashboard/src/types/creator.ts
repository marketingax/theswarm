// Creator Program Types

export type CreatorStatus = 'pending' | 'approved' | 'active' | 'suspended' | 'rejected';
export type CreatorCategory = 'youtube' | 'twitch' | 'podcast' | 'newsletter' | 'tiktok' | 'instagram' | 'other';
export type EarningsType = 'mission_post' | 'per_completion' | 'bonus';
export type EarningsStatus = 'pending' | 'paid' | 'processing';
export type PaymentType = 'upfront' | 'per_claim' | 'mixed';

export interface Creator {
  id: string;
  agent_id: string;
  status: CreatorStatus;
  category: CreatorCategory;
  follower_count: number;
  revenue_share: number; // decimal 0.10-0.25
  social_proof_url: string;
  social_handle?: string;
  onboarded_at: string;
  approved_at?: string;
  approved_by?: string;
  rejection_reason?: string;
  created_at: string;
  updated_at: string;
}

export interface CreatorEarning {
  id: string;
  creator_id: string;
  agent_id: string;
  mission_id?: string;
  earnings_type: EarningsType;
  amount: number; // in USD
  currency: string; // default 'USD'
  earned_at: string;
  paid_at?: string;
  payment_tx_hash?: string;
  status: EarningsStatus;
  notes?: string;
  created_at: string;
}

export interface CreatorEarningsSummary {
  creator_id: string;
  total_earned: number;
  total_paid: number;
  pending_payout: number;
  last_payout_date?: string;
  mission_count: number;
}

export interface CreatorApplication {
  category: CreatorCategory;
  follower_count: number;
  social_handle: string;
  social_proof_url: string;
  wallet_address?: string;
}

export interface CreatorMissionPayload {
  type: 'subscribe' | 'watch' | 'like' | 'comment' | 'share' | 'custom';
  title: string;
  description?: string;
  target_url?: string;
  target_channel_id?: string;
  xp_reward: number;
  stake_required?: number;
  max_claims?: number;
  expires_at?: string;
  usd_budget?: number;
  per_completion?: number;
  payment_type: PaymentType;
}

export interface CreatorInfo {
  id: string;
  name: string;
  is_creator: boolean;
  creator_category?: CreatorCategory;
  creator_revenue_share?: number;
  creator_follower_count?: number;
}

export interface AgentWithCreator extends CreatorInfo {
  xp: number;
  rank_title: string;
  wallet_address: string;
  creator_badge?: {
    icon: string; // emoji
    label: string;
    tier?: 'bronze' | 'silver' | 'gold' | 'platinum';
  };
}

// Category icon mapping
export const CATEGORY_ICONS: Record<CreatorCategory, string> = {
  youtube: '📺',
  twitch: '🎮',
  tiktok: '🎵',
  instagram: '📷',
  podcast: '🎙️',
  newsletter: '📰',
  other: '🌐'
};

// Revenue share calculations
export function calculateRevenueShare(followerCount: number): number {
  if (followerCount >= 100000) return 0.25;
  if (followerCount >= 50000) return 0.22;
  if (followerCount >= 20000) return 0.20;
  if (followerCount >= 10000) return 0.18;
  if (followerCount >= 5000) return 0.16;
  return 0.15;
}

// Format revenue share for display
export function formatRevenueShare(share: number): string {
  return `${(share * 100).toFixed(0)}%`;
}

// Get creator tier based on followers
export function getCreatorTier(followerCount: number): 'bronze' | 'silver' | 'gold' | 'platinum' {
  if (followerCount >= 500000) return 'platinum';
  if (followerCount >= 100000) return 'gold';
  if (followerCount >= 50000) return 'silver';
  return 'bronze';
}
