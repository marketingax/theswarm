import { CATEGORY_ICONS, getCreatorTier } from '@/types/creator';
import type { CreatorCategory } from '@/types/creator';

interface CreatorBadgeProps {
  category: CreatorCategory;
  followerCount: number;
  revenueShare?: number;
  variant?: 'compact' | 'full';
}

export default function CreatorBadge({
  category,
  followerCount,
  revenueShare,
  variant = 'compact'
}: CreatorBadgeProps) {
  const icon = CATEGORY_ICONS[category];
  const tier = getCreatorTier(followerCount);
  
  const tierStyles = {
    platinum: 'from-purple-500 to-pink-500',
    gold: 'from-yellow-500 to-orange-500',
    silver: 'from-gray-400 to-gray-300',
    bronze: 'from-amber-700 to-amber-600'
  };

  if (variant === 'compact') {
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold text-white bg-gradient-to-r ${tierStyles[tier]}`}>
        <span>{icon}</span>
        <span>Creator</span>
      </span>
    );
  }

  return (
    <div className={`inline-flex flex-col gap-2 px-3 py-2 rounded-lg bg-gradient-to-r ${tierStyles[tier]} bg-opacity-10 border border-current`}>
      <div className="flex items-center gap-2">
        <span className="text-lg">{icon}</span>
        <span className="font-semibold">Creator</span>
      </div>
      {revenueShare && (
        <div className="text-xs">
          Revenue Share: <span className="font-bold">{(revenueShare * 100).toFixed(0)}%</span>
        </div>
      )}
      <div className="text-xs">
        Followers: <span className="font-bold">{followerCount.toLocaleString()}</span>
      </div>
      <div className="text-xs capitalize">
        Tier: <span className="font-bold">{tier}</span>
      </div>
    </div>
  );
}
