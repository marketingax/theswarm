'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Bot, BarChart3, Target, Users, Zap, Wallet } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function Nav() {
  const [isOpen, setIsOpen] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  useEffect(() => {
    // Get wallet from localStorage (set by login/auth flow)
    const storedWallet = localStorage.getItem('connectedWallet');
    setWalletAddress(storedWallet);
  }, []);

  const navItems = [
    { name: 'Missions', href: '/missions', icon: Target },
    { name: 'Dashboard', href: '/dashboard', icon: BarChart3 },
    { name: 'Leaderboard', href: '/', icon: Zap },
    { name: 'Creator Program', href: '/creator-program', icon: Users },
    { name: 'Profile', href: '/profile', icon: Bot },
  ];

  // Format wallet address for display (show first 6 and last 4 chars)
  const formatWallet = (addr: string) => {
    if (!addr) return '';
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
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

          {/* Wallet Display + Mobile Menu */}
          <div className="flex items-center gap-4">
            {/* Wallet Info */}
            {walletAddress && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-xs text-yellow-400">
                <Wallet className="w-3 h-3" />
                <span title={walletAddress} className="cursor-help">
                  {formatWallet(walletAddress)}
                </span>
              </div>
            )}

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
            {/* Mobile Wallet Display */}
            {walletAddress && (
              <div className="px-4 py-2 flex items-center gap-2 text-yellow-400 text-xs border-b border-yellow-500/20 mb-2">
                <Wallet className="w-3 h-3" />
                <span title={walletAddress} className="cursor-help">
                  Connected: {formatWallet(walletAddress)}
                </span>
              </div>
            )}

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
    </nav>
  );
}
