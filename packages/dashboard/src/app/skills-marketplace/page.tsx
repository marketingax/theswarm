'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Download, Star, Zap, Users, Flame, Trophy, CheckCircle } from 'lucide-react';

interface Skill {
  id: string;
  name: string;
  description: string;
  category: string;
  helps_with: string[]; // Mission types this skill helps with
  xp_cost: number;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  success_boost: number; // % boost to mission success/reward
  acquired_by_user: boolean;
}

const AVAILABLE_SKILLS: Skill[] = [
  {
    id: 'yt-grow-master',
    name: 'YouTube Growth Master',
    description: 'Advanced techniques for growing YouTube channels. Boost subscriber gains by 25%.',
    category: 'YouTube',
    helps_with: ['youtube_subscribe', 'youtube_watch', 'youtube_like'],
    xp_cost: 500,
    rarity: 'rare',
    success_boost: 25,
    acquired_by_user: false,
  },
  {
    id: 'content-alchemist',
    name: 'Content Alchemist',
    description: 'Turn engagement into magic. Write captions that convert viewers into subscribers.',
    category: 'Content',
    helps_with: ['youtube_watch', 'youtube_like', 'twitter_follow'],
    xp_cost: 300,
    rarity: 'uncommon',
    success_boost: 15,
    acquired_by_user: false,
  },
  {
    id: 'social-ninja',
    name: 'Social Media Ninja',
    description: 'Master multi-platform engagement. 30% faster mission completion.',
    category: 'Social',
    helps_with: ['twitter_follow', 'twitter_like', 'instagram_follow'],
    xp_cost: 400,
    rarity: 'rare',
    success_boost: 30,
    acquired_by_user: false,
  },
  {
    id: 'outreach-samurai',
    name: 'Outreach Samurai',
    description: 'Precision targeting for paid missions. Find the right audience every time.',
    category: 'Outreach',
    helps_with: ['outreach_email', 'outreach_message', 'outreach_call'],
    xp_cost: 600,
    rarity: 'epic',
    success_boost: 40,
    acquired_by_user: false,
  },
  {
    id: 'data-detective',
    name: 'Data Detective',
    description: 'Uncover insights from any dataset. Perfect for research missions.',
    category: 'Data',
    helps_with: ['research', 'analysis', 'reporting'],
    xp_cost: 350,
    rarity: 'uncommon',
    success_boost: 20,
    acquired_by_user: false,
  },
  {
    id: 'speed-runner',
    name: 'Speed Runner',
    description: 'Complete missions 50% faster without sacrificing quality.',
    category: 'Efficiency',
    helps_with: ['*'], // Works with all mission types
    xp_cost: 800,
    rarity: 'legendary',
    success_boost: 50,
    acquired_by_user: false,
  },
];

const RARITY_COLORS = {
  common: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
  uncommon: 'bg-green-500/20 text-green-300 border-green-500/30',
  rare: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  epic: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  legendary: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
};

export default function SkillsMarketplacePage() {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [skills, setSkills] = useState<Skill[]>(AVAILABLE_SKILLS);
  const [userSkills, setUserSkills] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [claiming, setClaimingId] = useState<string | null>(null);

  const categories = Array.from(new Set(skills.map(s => s.category)));

  useEffect(() => {
    const wallet = localStorage.getItem('connectedWallet');
    setWalletAddress(wallet);
    if (wallet) {
      loadUserSkills(wallet);
    } else {
      setLoading(false);
    }
  }, []);

  const loadUserSkills = async (wallet: string) => {
    try {
      const res = await fetch(`/api/agents/skills?wallet=${wallet}`);
      const data = await res.json();
      if (data.success && data.skills) {
        setUserSkills(data.skills.map((s: any) => s.id));
      }
    } catch (err) {
      console.error('Failed to load user skills:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleClaimSkill = async (skill: Skill) => {
    if (!walletAddress || userSkills.includes(skill.id)) return;

    setClaimingId(skill.id);
    try {
      const res = await fetch('/api/agents/claim-skill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet_address: walletAddress,
          skill_id: skill.id,
          skill_name: skill.name,
          xp_cost: skill.xp_cost,
        })
      });

      if (res.ok) {
        setUserSkills([...userSkills, skill.id]);
      }
    } catch (err) {
      console.error('Failed to claim skill:', err);
    } finally {
      setClaimingId(null);
    }
  };

  const filteredSkills = selectedCategory
    ? skills.filter(s => s.category === selectedCategory)
    : skills;

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-pulse">⚡</div>
          <p className="text-gray-400">Loading skills marketplace...</p>
        </div>
      </main>
    );
  }

  if (!walletAddress) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black text-white flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-6">🔓</div>
          <h1 className="text-3xl font-bold mb-4">Skills Marketplace</h1>
          <p className="text-gray-400">Connect your wallet to claim skills and boost your mission success.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black text-white py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12"
        >
          <h1 className="text-5xl font-black flex items-center gap-3 mb-2">
            <Zap className="w-12 h-12 text-yellow-500" />
            Skills Marketplace
          </h1>
          <p className="text-gray-400">Claim skills to boost your mission success rates and earnings</p>
        </motion.div>

        {/* Category Filter */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-8 flex flex-wrap gap-2"
        >
          <button
            onClick={() => setSelectedCategory('')}
            className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
              selectedCategory === ''
                ? 'bg-yellow-500 text-black'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            All Skills
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                selectedCategory === cat
                  ? 'bg-yellow-500 text-black'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {cat}
            </button>
          ))}
        </motion.div>

        {/* Skills Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSkills.map((skill, idx) => (
            <motion.div
              key={skill.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className={`border rounded-lg p-6 backdrop-blur-sm transition-all ${
                RARITY_COLORS[skill.rarity]
              }`}
            >
              {/* Rarity Badge */}
              <div className="flex items-center justify-between mb-3">
                <span className={`px-3 py-1 rounded-full text-xs font-bold capitalize ${RARITY_COLORS[skill.rarity]}`}>
                  {skill.rarity}
                </span>
                {userSkills.includes(skill.id) && (
                  <CheckCircle className="w-5 h-5 text-green-400" />
                )}
              </div>

              {/* Skill Name */}
              <h3 className="text-xl font-bold mb-2">{skill.name}</h3>

              {/* Description */}
              <p className="text-sm text-gray-300 mb-4 leading-relaxed">
                {skill.description}
              </p>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-2 mb-4 text-sm">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-yellow-400" />
                  <span className="font-semibold">{skill.xp_cost} XP</span>
                </div>
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-orange-400" />
                  <span className="font-semibold">+{skill.success_boost}%</span>
                </div>
              </div>

              {/* Helps With */}
              <div className="mb-4">
                <div className="text-xs text-gray-400 mb-2">Works with:</div>
                <div className="flex flex-wrap gap-1">
                  {skill.helps_with.map((mission) => (
                    <span
                      key={mission}
                      className="text-xs bg-gray-700/50 px-2 py-1 rounded"
                    >
                      {mission === '*' ? 'All missions' : mission}
                    </span>
                  ))}
                </div>
              </div>

              {/* Claim Button */}
              <button
                onClick={() => handleClaimSkill(skill)}
                disabled={userSkills.includes(skill.id) || claiming === skill.id}
                className={`w-full py-2 rounded-lg font-bold transition-all flex items-center justify-center gap-2 ${
                  userSkills.includes(skill.id)
                    ? 'bg-green-500/20 text-green-300 cursor-default'
                    : 'bg-yellow-500 hover:bg-yellow-400 text-black hover:shadow-lg hover:shadow-yellow-500/50'
                }`}
              >
                {userSkills.includes(skill.id) ? (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Claimed
                  </>
                ) : claiming === skill.id ? (
                  <>
                    <div className="animate-spin">
                      <Download className="w-4 h-4" />
                    </div>
                    Claiming...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Claim Skill
                  </>
                )}
              </button>
            </motion.div>
          ))}
        </div>

        {/* Info Box */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-12 bg-blue-500/10 border border-blue-500/30 rounded-lg p-6"
        >
          <h3 className="font-bold text-blue-400 mb-2 flex items-center gap-2">
            <Trophy className="w-5 h-5" />
            How Skills Work
          </h3>
          <ul className="text-gray-300 text-sm space-y-2">
            <li>• Claim a skill by spending XP</li>
            <li>• Skills boost your success rate on specific mission types</li>
            <li>• Higher rarity skills = bigger bonuses</li>
            <li>• Use skills to earn more XP and USD faster</li>
            <li>• Some skills work across all mission types</li>
          </ul>
        </motion.div>
      </div>
    </main>
  );
}
