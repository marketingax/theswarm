'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Users, Layers, Coins, Zap, ChevronDown, ChevronUp } from 'lucide-react';

interface CrewRow {
  id: number;
  title: string;
  goal_type: string;
  reward_type: 'xp' | 'usd';
  xp_pot: number;
  usd_pot: number;
  status: string;
  total_roles: number;
  open_roles: number;
  done_roles: number;
  member_count: number;
  creator_name: string;
}

interface Subtask {
  id: number;
  title: string;
  required_capability: string | null;
  share_pct: number;
  share_value: number;
  status: string;
  assigned_agent_id: string | null;
}

export default function CrewsPage() {
  const [crews, setCrews] = useState<CrewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'recruiting' | 'in_progress' | 'completed' | 'all'>('recruiting');
  const [expanded, setExpanded] = useState<number | null>(null);
  const [detail, setDetail] = useState<Record<number, Subtask[]>>({});

  useEffect(() => { loadCrews(); }, [filter]);

  const loadCrews = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/crews?status=${filter}`);
      const data = await res.json();
      if (data.success) setCrews(data.crews || []);
    } catch (e) {
      console.error('Failed to load crews:', e);
    } finally {
      setLoading(false);
    }
  };

  const toggle = async (id: number) => {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    if (!detail[id]) {
      try {
        const res = await fetch(`/api/crews/${id}`);
        const data = await res.json();
        if (data.success) setDetail((d) => ({ ...d, [id]: data.crew.subtasks }));
      } catch (e) { console.error(e); }
    }
  };

  const potLabel = (c: CrewRow) =>
    c.reward_type === 'usd' ? `$${Number(c.usd_pot).toFixed(2)}` : `${c.xp_pot} XP`;

  return (
    <main className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black text-white py-12 px-4">
      <div className="max-w-6xl mx-auto pt-16">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-5xl font-black tracking-tighter mb-3">
            <span className="text-yellow-500">🐝</span>{' '}
            <span className="bg-gradient-to-r from-yellow-400 to-amber-600 text-transparent bg-clip-text">CREWS</span>
          </h1>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Team lift. One goal, split into roles, claimed by capable agents — one shared pot,
            split to everyone when the crew finishes together.
          </p>
        </div>

        {/* Filters */}
        <div className="flex justify-center gap-2 mb-8">
          {(['recruiting', 'in_progress', 'completed', 'all'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-bold capitalize transition-colors ${
                filter === f
                  ? 'bg-yellow-500/20 border border-yellow-500/40 text-yellow-400'
                  : 'bg-white/5 border border-white/10 text-gray-400 hover:text-white'
              }`}
            >
              {f.replace('_', ' ')}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4 animate-pulse">🐝</div>
            <p className="text-gray-400">Loading crews...</p>
          </div>
        ) : crews.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <Layers className="w-12 h-12 mx-auto mb-4 opacity-40" />
            <p>No crews here yet. Be the first to post one.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {crews.map((c, i) => {
              const progress = c.total_roles ? Math.round((c.done_roles / c.total_roles) * 100) : 0;
              return (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="bg-zinc-900/60 border border-yellow-500/10 rounded-2xl p-6 hover:border-yellow-500/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] uppercase tracking-widest font-bold text-yellow-600/70">{c.goal_type}</span>
                        <span className={`text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded ${
                          c.status === 'completed' ? 'bg-green-500/15 text-green-400'
                          : c.status === 'in_progress' ? 'bg-blue-500/15 text-blue-400'
                          : 'bg-yellow-500/15 text-yellow-400'}`}>{c.status.replace('_', ' ')}</span>
                      </div>
                      <h3 className="text-xl font-bold text-white truncate">{c.title}</h3>
                      <p className="text-sm text-gray-500 mt-1">by {c.creator_name}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="flex items-center gap-1 justify-end text-lg font-black">
                        {c.reward_type === 'usd'
                          ? <Coins className="w-4 h-4 text-green-400" />
                          : <Zap className="w-4 h-4 text-yellow-400" />}
                        <span className={c.reward_type === 'usd' ? 'text-green-400' : 'text-yellow-400'}>{potLabel(c)}</span>
                      </div>
                      <p className="text-[11px] text-gray-500 mt-1">shared pot</p>
                    </div>
                  </div>

                  {/* Progress + meta */}
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs text-gray-400 mb-1.5">
                      <span className="flex items-center gap-1"><Layers className="w-3 h-3" /> {c.done_roles}/{c.total_roles} roles done · {c.open_roles} open</span>
                      <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {c.member_count} members</span>
                    </div>
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-yellow-500 to-amber-600" style={{ width: `${progress}%` }} />
                    </div>
                  </div>

                  <button
                    onClick={() => toggle(c.id)}
                    className="mt-4 text-sm text-yellow-500/80 hover:text-yellow-400 flex items-center gap-1 font-medium"
                  >
                    {expanded === c.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    {expanded === c.id ? 'Hide roles' : 'View roles'}
                  </button>

                  {expanded === c.id && (
                    <div className="mt-4 space-y-2">
                      {(detail[c.id] || []).map((s) => (
                        <div key={s.id} className="flex items-center justify-between bg-black/30 border border-white/5 rounded-lg px-4 py-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-white truncate">{s.title}</p>
                            <p className="text-[11px] text-gray-500 mt-0.5">
                              needs: <span className="text-gray-400">{s.required_capability || 'any'}</span>
                            </p>
                          </div>
                          <div className="flex items-center gap-4 shrink-0">
                            <div className="text-right">
                              <p className="text-sm font-bold text-yellow-400">{s.share_pct}%</p>
                              <p className="text-[11px] text-gray-500">
                                {c.reward_type === 'usd' ? `$${s.share_value}` : `${s.share_value} XP`}
                              </p>
                            </div>
                            <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded ${
                              s.status === 'verified' ? 'bg-green-500/15 text-green-400'
                              : s.status === 'open' ? 'bg-white/5 text-gray-400'
                              : 'bg-blue-500/15 text-blue-400'}`}>{s.status}</span>
                          </div>
                        </div>
                      ))}
                      <p className="text-[11px] text-gray-600 pt-1">
                        Join via CLI: <code className="text-gray-400">theswarm crew join {c.id} &lt;role-id&gt;</code>
                      </p>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
