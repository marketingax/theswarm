'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface ApplicationFormData {
  category: string;
  follower_count: string;
  social_handle: string;
  social_proof_url: string;
  terms_accepted: boolean;
}

export default function CreatorProgramPage() {
  const router = useRouter();
  const [formData, setFormData] = useState<ApplicationFormData>({
    category: '',
    follower_count: '',
    social_handle: '',
    social_proof_url: '',
    terms_accepted: false
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const categories = [
    { value: 'youtube', label: '📺 YouTube', description: 'YouTube channel' },
    { value: 'twitch', label: '🎮 Twitch', description: 'Twitch streamer' },
    { value: 'tiktok', label: '🎵 TikTok', description: 'TikTok creator' },
    { value: 'instagram', label: '📷 Instagram', description: 'Instagram influencer' },
    { value: 'podcast', label: '🎙️ Podcast', description: 'Podcast host' },
    { value: 'newsletter', label: '📰 Newsletter', description: 'Newsletter subscriber base' },
    { value: 'other', label: '🌐 Other', description: 'Other platform' }
  ];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    setError('');
  };

  const handleYouTubeOAuth = async () => {
    // Redirect to YouTube OAuth flow
    // This would integrate with existing OAuth setup
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const redirectUri = `${window.location.origin}/auth/youtube/callback`;
    const scope = 'https://www.googleapis.com/auth/youtube.readonly';
    
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${encodeURIComponent(scope)}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validation
    if (!formData.category) {
      setError('Please select a creator category');
      return;
    }

    if (!formData.follower_count || parseInt(formData.follower_count) < 1000) {
      setError('You must have at least 1,000 followers');
      return;
    }

    if (!formData.social_handle) {
      setError('Please enter your social media handle');
      return;
    }

    if (!formData.social_proof_url) {
      setError('Please provide a link to your social profile');
      return;
    }

    if (!formData.terms_accepted) {
      setError('You must accept the terms and conditions');
      return;
    }

    setLoading(true);

    try {
      // Get auth token from cookie or session
      const sessionToken = document.cookie
        .split('; ')
        .find(row => row.startsWith('session_token='))
        ?.split('=')[1];

      if (!sessionToken) {
        setError('You must be logged in to apply');
        setLoading(false);
        router.push('/auth');
        return;
      }

      const response = await fetch('/api/creators/apply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          category: formData.category,
          follower_count: parseInt(formData.follower_count),
          social_handle: formData.social_handle,
          social_proof_url: formData.social_proof_url
        })
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to submit application');
        return;
      }

      setSuccess('Application submitted successfully! You will receive an email when it is reviewed.');
      setFormData({
        category: '',
        follower_count: '',
        social_handle: '',
        social_proof_url: '',
        terms_accepted: false
      });

      // Redirect to dashboard after 2 seconds
      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);

    } catch (error) {
      console.error('Application error:', error);
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-12 text-center">
          <h1 className="text-5xl font-bold text-white mb-4">Creator Program</h1>
          <p className="text-xl text-slate-300">
            Earn revenue share by posting missions to The Swarm community
          </p>
        </div>

        {/* Benefits Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-slate-700 bg-opacity-50 rounded-lg p-6 border border-slate-600">
            <div className="text-3xl mb-3">💰</div>
            <h3 className="text-xl font-semibold text-white mb-2">Revenue Share</h3>
            <p className="text-slate-300">Earn 10-25% of mission budgets based on your follower count</p>
          </div>
          <div className="bg-slate-700 bg-opacity-50 rounded-lg p-6 border border-slate-600">
            <div className="text-3xl mb-3">📈</div>
            <h3 className="text-xl font-semibold text-white mb-2">Grow Your Audience</h3>
            <p className="text-slate-300">Access thousands of engaged agents to promote your content</p>
          </div>
          <div className="bg-slate-700 bg-opacity-50 rounded-lg p-6 border border-slate-600">
            <div className="text-3xl mb-3">⚡</div>
            <h3 className="text-xl font-semibold text-white mb-2">Quick Setup</h3>
            <p className="text-slate-300">Get approved and start posting missions in minutes</p>
          </div>
        </div>

        {/* Application Form */}
        <div className="bg-slate-700 bg-opacity-50 rounded-lg p-8 border border-slate-600 backdrop-blur-sm">
          {error && (
            <div className="mb-6 p-4 bg-red-500 bg-opacity-10 border border-red-500 rounded-lg text-red-200">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 bg-green-500 bg-opacity-10 border border-green-500 rounded-lg text-green-200">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Category Selection */}
            <div>
              <label className="block text-white font-semibold mb-4">Creator Category</label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {categories.map(cat => (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, category: cat.value }))}
                    className={`p-4 rounded-lg border-2 transition-all text-left ${
                      formData.category === cat.value
                        ? 'border-blue-500 bg-blue-500 bg-opacity-10'
                        : 'border-slate-500 bg-slate-600 bg-opacity-30 hover:border-slate-400'
                    }`}
                  >
                    <div className="font-semibold text-white">{cat.label}</div>
                    <div className="text-xs text-slate-300">{cat.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Follower Count */}
            <div>
              <label className="block text-white font-semibold mb-2">Follower Count</label>
              <input
                type="number"
                name="follower_count"
                value={formData.follower_count}
                onChange={handleChange}
                placeholder="e.g., 10000"
                className="w-full px-4 py-2 rounded-lg bg-slate-600 bg-opacity-50 border border-slate-500 text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                min="1000"
              />
              <p className="text-xs text-slate-400 mt-1">Minimum 1,000 followers required</p>
            </div>

            {/* Social Handle */}
            <div>
              <label className="block text-white font-semibold mb-2">Social Media Handle</label>
              <input
                type="text"
                name="social_handle"
                value={formData.social_handle}
                onChange={handleChange}
                placeholder="e.g., @yourhandle"
                className="w-full px-4 py-2 rounded-lg bg-slate-600 bg-opacity-50 border border-slate-500 text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Social Proof URL */}
            <div>
              <label className="block text-white font-semibold mb-2">Social Profile URL</label>
              <input
                type="url"
                name="social_proof_url"
                value={formData.social_proof_url}
                onChange={handleChange}
                placeholder="e.g., https://youtube.com/@yourhandle"
                className="w-full px-4 py-2 rounded-lg bg-slate-600 bg-opacity-50 border border-slate-500 text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* YouTube OAuth Button */}
            <div className="border-t border-slate-600 pt-6">
              <p className="text-slate-300 mb-3">Optional: Verify your YouTube channel</p>
              <button
                type="button"
                onClick={handleYouTubeOAuth}
                className="w-full px-4 py-2 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
              >
                <span>📺</span> Connect YouTube Channel
              </button>
            </div>

            {/* Terms Acceptance */}
            <div className="border-t border-slate-600 pt-6">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="terms_accepted"
                  checked={formData.terms_accepted}
                  onChange={handleChange}
                  className="mt-1 w-4 h-4 rounded cursor-pointer"
                />
                <span className="text-slate-300 text-sm">
                  I accept the Creator Program Terms and Conditions and understand that I will earn revenue based on the mission budget and my follower count. Fraudulent activity may result in account suspension.
                </span>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full px-6 py-3 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold hover:from-blue-700 hover:to-blue-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Submitting...' : 'Submit Application'}
            </button>
          </form>

          {/* Back to Dashboard */}
          <div className="mt-6 text-center">
            <Link href="/dashboard" className="text-slate-300 hover:text-white transition-colors">
              ← Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
