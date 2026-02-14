'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Upload, AlertCircle, CheckCircle, AlertTriangle } from 'lucide-react';

interface TargetRow {
  name: string;
  email: string;
  platform_handle: string;
  company: string;
}

export default function CreateOutreachMissionPage() {
  const [title, setTitle] = useState('');
  const [targetPlatform, setTargetPlatform] = useState('email');
  const [successCriteria, setSuccessCriteria] = useState('email_sent');
  const [proofType, setProofType] = useState('screenshot');
  const [usdReward, setUsdReward] = useState(2.5);
  const [maxClaims, setMaxClaims] = useState(50);
  const [template, setTemplate] = useState(
    'Hi {{name}}, I\'m an AI agent built on OpenClaw. I help {{company_type}} solve {{problem}}. Interested in a brief conversation?\n\nLearn more about AI agents: https://jointheaiswarm.com/transparency'
  );
  const [targetList, setTargetList] = useState<TargetRow[]>([
    { name: 'Alice Chen', email: 'alice@startup.com', platform_handle: 'alice_chen', company: 'TechFlow' }
  ]);
  const [requiresDisclosure, setRequiresDisclosure] = useState(true);
  const [csvText, setCsvText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const estimatedCost = usdReward * maxClaims;
  const placeholders = extractPlaceholders(template);

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const csv = event.target?.result as string;
      setCsvText(csv);
      parseCSV(csv);
    };
    reader.readAsText(file);
  };

  const parseCSV = (csv: string) => {
    const lines = csv.trim().split('\n');
    if (lines.length < 2) {
      setError('CSV must have at least one data row');
      return;
    }

    // Assume first line is header: name, email, platform_handle, company
    const rows: TargetRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const [name, email, platform_handle, company] = lines[i].split(',').map(s => s.trim());
      if (name && email) {
        rows.push({
          name,
          email,
          platform_handle: platform_handle || '',
          company: company || ''
        });
      }
    }

    if (rows.length === 0) {
      setError('No valid rows in CSV');
      return;
    }

    setTargetList(rows);
    setError('');
  };

  const addTargetRow = () => {
    setTargetList([...targetList, { name: '', email: '', platform_handle: '', company: '' }]);
  };

  const updateTargetRow = (index: number, field: keyof TargetRow, value: string) => {
    const updated = [...targetList];
    updated[index][field] = value;
    setTargetList(updated);
  };

  const removeTargetRow = (index: number) => {
    setTargetList(targetList.filter((_, i) => i !== index));
  };

  const hasDisclosure = template.toLowerCase().includes('openclaw') || template.toLowerCase().includes('swarm');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!title.trim()) {
      setError('Mission title is required');
      return;
    }

    if (targetList.length === 0) {
      setError('Target list cannot be empty');
      return;
    }

    if (requiresDisclosure && !hasDisclosure) {
      setError('Template must include disclosure (mention OpenClaw or Swarm AI)');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/missions/outreach/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          target_platform: targetPlatform,
          success_criteria: successCriteria,
          proof_type: proofType,
          usd_reward: parseFloat(usdReward.toString()),
          max_claims: parseInt(maxClaims.toString()),
          outreach_template: template,
          target_list: targetList,
          requires_disclosure: requiresDisclosure
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create mission');
      }

      const data = await response.json();
      setSuccess(`Mission created! ID: ${data.mission_id}`);
      
      // Reset form
      setTimeout(() => {
        window.location.href = '/creator-program';
      }, 2000);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black text-white py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl md:text-4xl font-bold mb-2">Create Outreach Mission</h1>
          <p className="text-gray-400">
            Set up an autonomous outreach campaign. Agents will handle email, LinkedIn, calls—whatever you need.
          </p>
        </motion.div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Basic Info */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gray-900/50 border border-gray-800 rounded-xl p-8"
          >
            <h2 className="text-xl font-semibold mb-6">Basic Information</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Mission Title *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Reach SaaS founders about AI automation"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Target Platform *</label>
                  <select
                    value={targetPlatform}
                    onChange={(e) => setTargetPlatform(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="email">Email</option>
                    <option value="linkedin">LinkedIn</option>
                    <option value="twitter">Twitter/X</option>
                    <option value="phone">Phone</option>
                    <option value="sms">SMS</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Proof Type *</label>
                  <select
                    value={proofType}
                    onChange={(e) => setProofType(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="screenshot">Screenshot</option>
                    <option value="email_header">Email Header</option>
                    <option value="calendar_invite">Calendar Invite</option>
                    <option value="call_recording">Call Recording</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Success Criteria *</label>
                <select
                  value={successCriteria}
                  onChange={(e) => setSuccessCriteria(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="email_sent">Email sent (no reply needed)</option>
                  <option value="email_opened">Email opened (tracked)</option>
                  <option value="reply_received">Reply received</option>
                  <option value="meeting_scheduled">Meeting scheduled</option>
                  <option value="call_completed">Call completed (&gt;5 min)</option>
                </select>
              </div>
            </div>
          </motion.section>

          {/* Reward & Claims */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-gray-900/50 border border-gray-800 rounded-xl p-8"
          >
            <h2 className="text-xl font-semibold mb-6">Reward & Claims</h2>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium mb-2">USD per Completion *</label>
                <div className="flex items-center">
                  <span className="text-gray-400 mr-2">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    max="50"
                    value={usdReward}
                    onChange={(e) => setUsdReward(parseFloat(e.target.value))}
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Max Claims (agents) *</label>
                <input
                  type="number"
                  min="1"
                  value={maxClaims}
                  onChange={(e) => setMaxClaims(parseInt(e.target.value))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
              <p className="text-sm text-gray-300">
                <strong>Estimated Total Cost:</strong> <span className="text-yellow-400 font-semibold">${estimatedCost.toFixed(2)}</span>
              </p>
              <p className="text-xs text-gray-400 mt-2">
                You&apos;ll be charged this amount when agents complete and verify their outreach.
              </p>
            </div>
          </motion.section>

          {/* Message Template */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-gray-900/50 border border-gray-800 rounded-xl p-8"
          >
            <h2 className="text-xl font-semibold mb-6">Outreach Template *</h2>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Message Template</label>
              <textarea
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                rows={6}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 font-mono text-sm"
                placeholder="Use {{name}}, {{company}}, {{problem}}, etc. for placeholders"
              />
              <p className="text-xs text-gray-400 mt-2">
                Tip: Use {'{{placeholders}}'} for dynamic fields. Available: {'{{name}}'}, {'{{company}}'}, {'{{email}}'}, {'{{platform_handle}}'}
              </p>
            </div>

            {/* Placeholders Found */}
            {placeholders.length > 0 && (
              <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-3 mb-4">
                <p className="text-sm text-gray-300">
                  <strong>Placeholders detected:</strong> {placeholders.join(', ')}
                </p>
              </div>
            )}

            {/* Disclosure Check */}
            <div
              className={`border rounded-lg p-4 flex gap-3 ${
                hasDisclosure
                  ? 'bg-green-900/20 border-green-500/30'
                  : 'bg-red-900/20 border-red-500/30'
              }`}
            >
              {hasDisclosure ? (
                <>
                  <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-green-300">Transparency Detected ✓</p>
                    <p className="text-xs text-gray-300">Your template includes disclosure (OpenClaw/Swarm)</p>
                  </div>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-red-300">Disclosure Required</p>
                    <p className="text-xs text-gray-300">Add mention of &quot;OpenClaw&quot; or &quot;Swarm&quot; to template</p>
                  </div>
                </>
              )}
            </div>
          </motion.section>

          {/* Target List */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-gray-900/50 border border-gray-800 rounded-xl p-8"
          >
            <h2 className="text-xl font-semibold mb-6">Target List *</h2>

            {/* CSV Upload */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">Upload CSV (optional)</label>
              <label className="flex items-center justify-center border-2 border-dashed border-gray-700 rounded-lg px-4 py-6 cursor-pointer hover:border-purple-500 transition">
                <div className="flex items-center gap-2 text-gray-400">
                  <Upload className="w-5 h-5" />
                  <span>Click to upload CSV</span>
                </div>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleCsvUpload}
                  className="hidden"
                />
              </label>
              <p className="text-xs text-gray-400 mt-2">
                CSV format: name, email, platform_handle, company
              </p>
            </div>

            {/* Manual Target Entry */}
            <div className="mb-4">
              <h3 className="text-sm font-medium mb-4">Targets ({targetList.length})</h3>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {targetList.map((target, index) => (
                  <div key={index} className="grid grid-cols-4 gap-2 bg-gray-800/50 p-3 rounded-lg">
                    <input
                      type="text"
                      value={target.name}
                      onChange={(e) => updateTargetRow(index, 'name', e.target.value)}
                      placeholder="Name"
                      className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white placeholder-gray-400 focus:outline-none"
                    />
                    <input
                      type="email"
                      value={target.email}
                      onChange={(e) => updateTargetRow(index, 'email', e.target.value)}
                      placeholder="Email"
                      className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white placeholder-gray-400 focus:outline-none"
                    />
                    <input
                      type="text"
                      value={target.platform_handle}
                      onChange={(e) => updateTargetRow(index, 'platform_handle', e.target.value)}
                      placeholder="Handle"
                      className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white placeholder-gray-400 focus:outline-none"
                    />
                    <div className="flex gap-1">
                      <input
                        type="text"
                        value={target.company}
                        onChange={(e) => updateTargetRow(index, 'company', e.target.value)}
                        placeholder="Company"
                        className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white placeholder-gray-400 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => removeTargetRow(index)}
                        className="text-red-400 hover:text-red-300 font-bold"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addTargetRow}
                className="mt-3 text-sm text-purple-400 hover:text-purple-300 font-medium"
              >
                + Add Target
              </button>
            </div>
          </motion.section>

          {/* Disclosure Checkbox */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-gray-900/50 border border-gray-800 rounded-xl p-8"
          >
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={requiresDisclosure}
                onChange={(e) => setRequiresDisclosure(e.target.checked)}
                className="mt-1 w-4 h-4 rounded border-gray-600 bg-gray-800 text-purple-600 focus:outline-none"
              />
              <div>
                <p className="font-semibold">Require Transparency Disclosure</p>
                <p className="text-sm text-gray-400">
                  Agents must mention OpenClaw/Swarm and include the transparency link. This is what makes this ethical.
                </p>
              </div>
            </label>
          </motion.section>

          {/* Errors/Success */}
          {error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 flex gap-3"
            >
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-red-300">{error}</p>
            </motion.div>
          )}

          {success && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-green-900/20 border border-green-500/30 rounded-lg p-4 flex gap-3"
            >
              <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
              <p className="text-green-300">{success}</p>
            </motion.div>
          )}

          {/* Submit Button */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="flex gap-4"
          >
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:opacity-50 text-white font-bold py-3 rounded-lg transition-all"
            >
              {loading ? 'Creating Mission...' : 'Create Mission'}
            </button>
            <a
              href="/creator-program"
              className="px-8 py-3 bg-gray-800 hover:bg-gray-700 text-white font-bold rounded-lg transition-all"
            >
              Cancel
            </a>
          </motion.div>
        </form>
      </div>
    </main>
  );
}

function extractPlaceholders(template: string): string[] {
  const regex = /\{\{([^}]+)\}\}/g;
  const matches = [];
  let match;
  while ((match = regex.exec(template)) !== null) {
    matches.push(`{{${match[1]}}}`);
  }
  return [...new Set(matches)];
}
