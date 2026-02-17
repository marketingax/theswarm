'use client';

import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, BarChart3, Target, Users, Zap, Wallet, LogOut, Shield, Star } from 'lucide-react';
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

  const handleConnectWallet = async (walletAddr: string) => {
    setLoading(true);
    try {
      // Store in localStorage
      localStorage.setItem('connectedWallet', walletAddr);
      setWalletAddress(walletAddr);
      setIsAdmin(walletAddr === ADMIN_WALLET);
      setShowWalletModal(false);

      // Optionally verify wallet in backend
      const res = await fetch('/api/agents/verify-wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet_address: walletAddr })
      });

      if (res.ok) {
        const data = await res.json();
        console.log('Wallet verified:', data);
        // Redirect to appropriate dashboard
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

            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block px-4 py-2 text-gray-400 hover:text-yellow-500 hover:bg-yellow-500/5 rounded transition-colors"
                onClick={() => setIsOpen(false)}
              >
                {item.name}
              </Link>
            ))}
          </motion.div>
        )}
      </div>

      {/* Wallet Connection Modal */}
      <AnimatePresence>
        {mounted && showWalletModal && createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowWalletModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="relative z-[101] bg-gray-900 border border-yellow-500/30 rounded-xl p-8 max-w-md w-full shadow-2xl shadow-yellow-500/10"
            >
              <h2 className="text-2xl font-black text-yellow-500 mb-8 flex items-center gap-3">
                <Wallet className="w-8 h-8" />
                CONNECT WALLET
              </h2>

              <div className="space-y-4 mb-8">
                {/* Admin Wallet Option */}
                <button
                  onClick={() => handleConnectWallet('Fu7QnuVuGu1piks6FYeqp7GdP4P8MWjMeAeBbG5XYdUD')}
                  disabled={loading}
                  className={`w-full p-5 rounded-xl border-2 transition-all text-left group ${walletAddress === 'Fu7QnuVuGu1piks6FYeqp7GdP4P8MWjMeAeBbG5XYdUD'
                    ? 'border-yellow-500 bg-yellow-500/10 text-yellow-500'
                    : 'border-gray-800 bg-gray-950 text-gray-400 hover:border-yellow-500/50 hover:bg-gray-900'
                    }`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-black text-lg">ADMIN DOMAIN</span>
                    {walletAddress === 'Fu7QnuVuGu1piks6FYeqp7GdP4P8MWjMeAeBbG5XYdUD' && (
                      <span className="text-[10px] bg-yellow-500 text-black px-2 py-0.5 rounded-full font-bold">CONNECTED</span>
                    )}
                  </div>
                  <div className="font-mono text-xs opacity-50">Fu7Qnu...YdUD</div>
                </button>

                {/* Agent Wallet Option */}
                <button
                  onClick={() => handleConnectWallet('Hz6MqkncNL5UbPA4raYCoYpFac3ssa9Mjk5e8n9kDvCd')}
                  disabled={loading}
                  className={`w-full p-5 rounded-xl border-2 transition-all text-left group ${walletAddress === 'Hz6MqkncNL5UbPA4raYCoYpFac3ssa9Mjk5e8n9kDvCd'
                    ? 'border-yellow-500 bg-yellow-500/10 text-yellow-500'
                    : 'border-gray-800 bg-gray-950 text-gray-400 hover:border-yellow-500/50 hover:bg-gray-900'
                    }`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-black text-lg">AGENT MIKO (GENESIS)</span>
                    {walletAddress === 'Hz6MqkncNL5UbPA4raYCoYpFac3ssa9Mjk5e8n9kDvCd' && (
                      <span className="text-[10px] bg-yellow-500 text-black px-2 py-0.5 rounded-full font-bold">CONNECTED</span>
                    )}
                  </div>
                  <div className="font-mono text-xs opacity-50">Hz6Mqk...DvCd</div>
                </button>
              </div>

              <div className="space-y-3">
                {walletAddress && (
                  <button
                    onClick={handleDisconnect}
                    className="w-full p-4 bg-red-600/10 hover:bg-red-600/20 border-2 border-red-600/20 hover:border-red-600/40 rounded-xl text-red-500 font-bold flex items-center justify-center gap-2 transition-all"
                  >
                    <LogOut className="w-5 h-5" />
                    DISCONNECT
                  </button>
                )}

                <button
                  onClick={() => setShowWalletModal(false)}
                  className="w-full p-3 text-gray-500 hover:text-gray-300 font-bold text-sm transition-colors uppercase tracking-widest"
                >
                  CLOSE
                </button>
              </div>
            </motion.div>
          </div>,
          document.body
        )}
      </AnimatePresence>
    </nav>
  );
}
