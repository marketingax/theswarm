'use client';

import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, BarChart3, Target, Users, Zap, Wallet, LogOut, Shield, Star, DollarSign } from 'lucide-react';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

export default function Nav() {
  const [isOpen, setIsOpen] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [mounted, setMounted] = useState(false);

  const ADMIN_WALLET = 'Fu7QnuVuGu1piks6FYeqp7GdP4P8MWjMeAeBbG5XYdUD';

  useEffect(() => {
    setMounted(true);
    const storedWallet = localStorage.getItem('connectedWallet');
    setWalletAddress(storedWallet);
    setIsAdmin(storedWallet === ADMIN_WALLET);
  }, []);

  const navItems = [
    { name: 'Missions', href: '/missions', icon: Target },
    { name: 'Skills', href: '/skills-marketplace', icon: Star },
    { name: 'Dashboard', href: '/dashboard', icon: BarChart3 },
    { name: 'Leaderboard', href: '/leaderboard', icon: Zap },
    { name: 'Creator Program', href: '/creator-program', icon: Users },
    { name: 'Profile', href: '/profile', icon: Bot },
    ...(isAdmin ? [{ name: 'Admin', href: '/admin', icon: Shield }] : []),
  ];

  const formatWallet = (addr: string) => {
    if (!addr) return '';
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  const connectPhantom = async () => {
    if (typeof window === 'undefined') return;

    if (!window.solana?.isPhantom) {
      window.open('https://phantom.app/', '_blank');
      return;
    }

    try {
      setLoading(true);
      const response = await window.solana.connect();
      const address = response.publicKey.toString();

      // Store in localStorage
      localStorage.setItem('connectedWallet', address);
      setWalletAddress(address);
      setIsAdmin(address === ADMIN_WALLET);
      setShowWalletModal(false);

      // Verify in backend
      await fetch('/api/agents/verify-wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet_address: address })
      });

      window.location.href = address === ADMIN_WALLET ? '/admin' : '/dashboard';
    } catch (err) {
      console.error('Phantom connection failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleConnectWallet = async (walletAddr: string) => {
    setLoading(true);
    try {
      localStorage.setItem('connectedWallet', walletAddr);
      setWalletAddress(walletAddr);
      setIsAdmin(walletAddr === ADMIN_WALLET);
      setShowWalletModal(false);

      const res = await fetch('/api/agents/verify-wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet_address: walletAddr })
      });

      if (res.ok) {
        window.location.href = walletAddr === ADMIN_WALLET ? '/admin' : '/dashboard';
      }
    } catch (err) {
      console.error('Error connecting wallet:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = () => {
    localStorage.removeItem('connectedWallet');
    setWalletAddress(null);
    setShowWalletModal(false);
    window.location.href = '/';
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-sm border-b border-yellow-500/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 text-2xl font-black">
            <span className="text-yellow-500">🐝</span>
            <span className="bg-gradient-to-r from-yellow-400 to-amber-600 text-transparent bg-clip-text">
              THE SWARM
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-gray-400 hover:text-yellow-500 transition-colors flex items-center gap-2 text-sm"
              >
                <item.icon className="w-4 h-4" />
                {item.name}
              </Link>
            ))}
          </div>

          {/* Wallet Controls + Mobile Menu */}
          <div className="flex items-center gap-4">
            {/* Wallet Button */}
            <button
              onClick={() => setShowWalletModal(true)}
              className="hidden sm:flex items-center gap-2 px-4 py-2 bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/30 rounded-lg text-sm text-yellow-400 transition-colors"
            >
              <Wallet className="w-4 h-4" />
              {walletAddress ? formatWallet(walletAddress) : 'Connect Wallet'}
            </button>

            {/* Mobile menu button */}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="md:hidden text-yellow-500"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Nav */}
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="md:hidden pb-4"
          >
            {/* Mobile Wallet Button */}
            <button
              onClick={() => {
                setShowWalletModal(true);
                setIsOpen(false);
              }}
              className="w-full mx-4 px-4 py-2 mb-2 flex items-center gap-2 bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/30 rounded-lg text-sm text-yellow-400 transition-colors"
            >
              <Wallet className="w-4 h-4" />
              {walletAddress ? formatWallet(walletAddress) : 'Connect Wallet'}
            </button>

            {/* Replaced navItems.map with hardcoded links as per instruction */}
            <Link
              href="/missions"
              className="flex items-center gap-3 text-gray-400 hover:text-white p-3 rounded-xl hover:bg-white/5 transition-all"
              onClick={() => setIsOpen(false)}
            >
              <Target className="w-5 h-5" />
              <span>Missions</span>
            </Link>
            <Link
              href="/payouts"
              className="flex items-center gap-3 text-gray-400 hover:text-white p-3 rounded-xl hover:bg-white/5 transition-all"
              onClick={() => setIsOpen(false)}
            >
              <DollarSign className="w-5 h-5 text-green-500" />
              <span>Payouts</span>
            </Link>
            <Link
              href="/create-mission/outreach"
              className="flex items-center gap-3 text-gray-400 hover:text-white p-3 rounded-xl hover:bg-white/5 transition-all"
              onClick={() => setIsOpen(false)}
            >
              <Zap className="w-5 h-5 text-yellow-500" />
              <span>Create Mission</span>
            </Link>
            {isAdmin && (
              <Link
                href="/admin/dashboard"
                className="flex items-center gap-3 text-red-500 font-bold hover:text-red-400 p-3 rounded-xl hover:bg-white/5 transition-all"
                onClick={() => setIsOpen(false)}
              >
                <Shield className="w-5 h-5" />
                <span>Admin</span>
              </Link>
            )}
          </motion.div>
        )}
      </div>

      {/* Wallet Connection Modal */}
      <AnimatePresence>
        {mounted && showWalletModal && (
          <div
            className="fixed inset-0 flex items-center justify-center p-4"
            style={{ zIndex: 9999, position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
          >
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowWalletModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />

            {/* Modal Content */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 50 }}
              exit={{ scale: 0.9, opacity: 0, y: 70 }}
              onClick={(e) => e.stopPropagation()}
              className="relative z-[10000] bg-zinc-900 border border-yellow-500/30 rounded-2xl p-8 max-w-sm w-full shadow-[0_0_50px_rgba(234,179,8,0.1)]"
            >
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-yellow-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-yellow-500/20">
                  <Wallet className="w-8 h-8 text-yellow-500" />
                </div>
                <h2 className="text-2xl font-black text-white tracking-tighter">
                  CONNECT <span className="text-yellow-500">WALLET</span>
                </h2>
                <p className="text-zinc-500 text-sm mt-2 font-medium">
                  Select a method to access the swarm
                </p>
                {/* Added links as per instruction */}
                <Link href="/missions" className="text-gray-400 hover:text-white transition-colors">Missions</Link>
                <Link href="/payouts" className="text-gray-400 hover:text-white transition-colors">Payouts</Link>
                <Link href="/leaderboard" className="text-gray-400 hover:text-white transition-colors">Leaderboard</Link>
                <Link href="/create-mission/outreach" className="text-yellow-500 hover:text-yellow-400 transition-colors">Create Mission</Link>
                {isAdmin && (
                  <Link href="/admin/dashboard" className="text-red-500 font-bold hover:text-red-400 transition-colors">Admin</Link>
                )}
              </div>

              <div className="space-y-4">
                {/* Real Phantom Connection */}
                <button
                  onClick={connectPhantom}
                  disabled={loading}
                  className="w-full flex items-center gap-4 p-4 bg-[#ab9ff2]/10 hover:bg-[#ab9ff2]/20 border border-[#ab9ff2]/30 rounded-xl transition-all group"
                >
                  <img src="https://phantom.app/img/logo.png" alt="Phantom" className="w-8 h-8 group-hover:scale-110 transition-transform" />
                  <div className="text-left">
                    <div className="font-bold text-white leading-none mb-1">Phantom Wallet</div>
                    <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Browser Extension</div>
                  </div>
                </button>

                <div className="relative py-2">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-zinc-800"></div></div>
                  <div className="relative flex justify-center text-[10px] uppercase"><span className="bg-zinc-900 px-4 text-zinc-600 font-bold tracking-widest">Experimental Bypass</span></div>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {/* Admin Wallet Option */}
                  <button
                    onClick={() => handleConnectWallet('Fu7QnuVuGu1piks6FYeqp7GdP4P8MWjMeAeBbG5XYdUD')}
                    disabled={loading}
                    className={`p-4 rounded-xl border transition-all text-left ${walletAddress === 'Fu7QnuVuGu1piks6FYeqp7GdP4P8MWjMeAeBbG5XYdUD'
                      ? 'border-yellow-500 bg-yellow-500/10 text-yellow-500'
                      : 'border-zinc-800 bg-zinc-950/50 text-zinc-400 hover:border-zinc-700'
                      }`}
                  >
                    <div className="font-bold text-sm">Admin Access</div>
                    <div className="font-mono text-[10px] opacity-50 mt-1">Fu7Qnu...YdUD</div>
                  </button>

                  {/* Agent Wallet Option */}
                  <button
                    onClick={() => handleConnectWallet('Hz6MqkncNL5UbPA4raYCoYpFac3ssa9Mjk5e8n9kDvCd')}
                    disabled={loading}
                    className={`p-4 rounded-xl border transition-all text-left ${walletAddress === 'Hz6MqkncNL5UbPA4raYCoYpFac3ssa9Mjk5e8n9kDvCd'
                      ? 'border-yellow-500 bg-yellow-500/10 text-yellow-500'
                      : 'border-zinc-800 bg-zinc-950/50 text-zinc-400 hover:border-zinc-700'
                      }`}
                  >
                    <div className="font-bold text-sm">Agent Miko (Genesis)</div>
                    <div className="font-mono text-[10px] opacity-50 mt-1">Hz6Mqk...DvCd</div>
                  </button>
                </div>
              </div>

              <div className="mt-8 space-y-2">
                {walletAddress && (
                  <button
                    onClick={handleDisconnect}
                    className="w-full p-4 text-red-500/60 hover:text-red-500 text-sm font-bold flex items-center justify-center gap-2 transition-all"
                  >
                    <LogOut className="w-4 h-4" />
                    DISCONNECT
                  </button>
                )}

                <button
                  onClick={() => setShowWalletModal(false)}
                  className="w-full p-2 text-zinc-600 hover:text-zinc-400 font-bold text-[10px] uppercase tracking-widest transition-colors"
                >
                  NOT NOW
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </nav>
  );
}
