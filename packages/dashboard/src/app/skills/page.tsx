'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Star, Plus, Trash2, CheckCircle } from 'lucide-react';

interface Skill {
  id: string;
  skill_name: string;
  category: string;
  proficiency: 'beginner' | 'intermediate' | 'expert';
  verified: boolean;
}

const SKILL_CATEGORIES = [
  'YouTube Creator',
  'Web Development',
  'Content Writing',
  'Social Media',
  'Email Marketing',
  'Customer Support',
  'Data Analysis',
  'Graphic Design',
  'Video Editing',
  'SEO',
  'AI/Machine Learning',
  'Other'
];

export default function SkillsPage() {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [skillName, setSkillName] = useState('');
  const [proficiency, setProficiency] = useState<'beginner' | 'intermediate' | 'expert'>('intermediate');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const wallet = localStorage.getItem('connectedWallet');
    setWalletAddress(wallet);
    if (wallet) {
      loadSkills(wallet);
    } else {
      setLoading(false);
    }
  }, []);

  const loadSkills = async (wallet: string) => {
    try {
      const res = await fetch(`/api/agents/skills?wallet=${wallet}`);
      const data = await res.json();
      if (data.success && data.skills) {
        setSkills(data.skills);
      }
    } catch (err) {
      console.error('Failed to load skills:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddSkill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walletAddress || !selectedCategory || !skillName) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/agents/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet_address: walletAddress,
          skill_name: skillName,
          category: selectedCategory,
          proficiency
        })
      });

      if (res.ok) {
        const data = await res.json();
        setSkills([...skills, data.skill]);
        setSkillName('');
        setSelectedCategory('');
        setProficiency('intermediate');
      }
    } catch (err) {
      console.error('Failed to add skill:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSkill = async (skillId: string) => {
    try {
      const res = await fetch(`/api/agents/skills/${skillId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet_address: walletAddress })
      });

      if (res.ok) {
        setSkills(skills.filter(s => s.id !== skillId));
      }
    } catch (err) {
      console.error('Failed to delete skill:', err);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-pulse">⭐</div>
          <p className="text-gray-400">Loading skills...</p>
        </div>
      </main>
    );
  }

  if (!walletAddress) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black text-white flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-6">🔗</div>
          <h1 className="text-3xl font-bold mb-4">Connect Your Wallet</h1>
          <p className="text-gray-400">Connect your wallet to add your skills and get matched to better missions.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black text-white py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12"
        >
          <h1 className="text-5xl font-black flex items-center gap-3 mb-2">
            <Star className="w-12 h-12 text-yellow-500" />
            Your Skills
          </h1>
          <p className="text-gray-400">Tell The Swarm what you're good at to get matched with relevant missions</p>
        </motion.div>

        {/* Add Skill Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gray-900/50 border border-gray-800 rounded-lg p-8 mb-12"
        >
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <Plus className="w-6 h-6 text-yellow-500" />
            Add a Skill
          </h2>

          <form onSubmit={handleAddSkill} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Category</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:border-yellow-500 focus:outline-none"
                  required
                >
                  <option value="">Select a category...</option>
                  {SKILL_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Skill Name</label>
                <input
                  type="text"
                  value={skillName}
                  onChange={(e) => setSkillName(e.target.value)}
                  placeholder="e.g., YouTube Channel Growth"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:border-yellow-500 focus:outline-none"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Proficiency Level</label>
              <div className="flex gap-3">
                {['beginner', 'intermediate', 'expert'].map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setProficiency(level as any)}
                    className={`flex-1 px-4 py-2 rounded-lg font-semibold transition-colors capitalize ${
                      proficiency === level
                        ? 'bg-yellow-500 text-black'
                        : 'bg-gray-800 border border-gray-700 text-gray-300 hover:border-yellow-500'
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || !selectedCategory || !skillName}
              className="w-full px-4 py-3 bg-yellow-500 hover:bg-yellow-400 disabled:bg-gray-700 disabled:text-gray-500 text-black font-bold rounded-lg transition-colors"
            >
              {submitting ? 'Adding...' : 'Add Skill'}
            </button>
          </form>
        </motion.div>

        {/* Skills List */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <h2 className="text-2xl font-bold mb-6">Your Skills ({skills.length})</h2>

          {skills.length === 0 ? (
            <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-12 text-center">
              <div className="text-6xl mb-4 opacity-50">⭐</div>
              <p className="text-gray-400">No skills added yet. Add your first skill above!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {skills.map((skill) => (
                <motion.div
                  key={skill.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-gray-900/50 border border-gray-800 rounded-lg p-6 hover:border-yellow-500/30 transition-all"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-white mb-1">{skill.skill_name}</h3>
                      <p className="text-sm text-gray-400 mb-2">{skill.category}</p>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded text-xs font-semibold capitalize ${
                          skill.proficiency === 'expert' ? 'bg-yellow-500/20 text-yellow-400' :
                          skill.proficiency === 'intermediate' ? 'bg-blue-500/20 text-blue-400' :
                          'bg-gray-700/50 text-gray-300'
                        }`}>
                          {skill.proficiency}
                        </span>
                        {skill.verified && (
                          <div className="flex items-center gap-1 text-green-400 text-xs">
                            <CheckCircle className="w-4 h-4" />
                            Verified
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteSkill(skill.id)}
                      className="text-gray-400 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Info Box */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-12 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-6"
        >
          <h3 className="font-bold text-yellow-400 mb-2">💡 How Skills Work</h3>
          <p className="text-gray-300 text-sm">
            When you add skills, The Swarm matches you with missions that need your expertise. Verified skills boost your reputation and earn you special badges. More skills = more mission options!
          </p>
        </motion.div>
      </div>
    </main>
  );
}
