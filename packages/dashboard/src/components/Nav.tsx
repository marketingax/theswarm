'use client';

import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, BarChart3, Target, Users, Zap, Wallet, LogOut, Shield, Star, DollarSign, Layers } from 'lucide-react';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import bs58 from 'bs58';

export default function Nav() {
  const [isOpen, setIsOpen] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const storedWallet = localStorage.getItem('connectedWallet');
    setWalletAddress(storedWallet);
    // Admin status is decided by the server (signature-authed session +
    // ADMIN_WALLETS env allowlist) — never by a client-side constant.
    fetch('/api/auth/session')
      .then((res) => res.json())
      .then((data) => {
        if (data.authenticated && data.wallet) {
          setWalletAddress(data.wallet);
        }
        setIsAdmin(data.isAdmin === true);
      })
      .catch(() => setIsAdmin(false));
  }, []);

  const navItems = [
    { name: 'Missions', href: '/missions', icon: Target },
    { name: 'Crews', href: '/crews', icon: Layers },
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

      // Prove wallet ownership with a signature, then let the SERVER decide
      // whether this wallet is an admin.
      const message = `Sign in to The Swarm\n\nWallet: ${address}\nTimestamp: ${Date.now()}`;
      const encodedMessage = new TextEncoder().encode(message);
      const { signature } = await window.solana.signMessage(encodedMessage, 'utf8');

      const res = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet_address: address,
          signature: bs58.encode(signature),
          message,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Wallet authentication failed');
      }

      localStorage.setItem('connectedWallet', address);
      setWalletAddress(address);
      setIsAdmin(data.isAdmin === true);
      setShowWalletModal(false);

      window.location.href = data.isAdmin === true ? '/admin' : '/dashboard';
    } catch (err) {
      console.error('Phantom connection failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await fetch('/api/auth/session', { method: 'DELETE' });
    } catch {
      // best-effort sign-out
    }
    localStorage.removeItem('connectedWallet');
    setWalletAddress(null);
    setIsAdmin(false);
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

      {/* Wallet Connection Modal - Moved to Portal */}
      {mounted && showWalletModal && createPortal(
        <AnimatePresence mode="wait">
          <div
            className="fixed inset-0 flex items-start justify-center p-4"
            style={{ zIndex: 9999 }}
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
              initial={{ scale: 0.9, opacity: 0, y: 150 }}
              animate={{ scale: 1, opacity: 1, y: 190 }}
              exit={{ scale: 0.9, opacity: 0, y: 210 }}
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
        </AnimatePresence>,
        document.body
      )}
    </nav>
  );
}
