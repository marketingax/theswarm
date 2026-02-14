/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    monorepoRoot: true,
    optimizePackageImports: [
      '@supabase/supabase-js',
      'lucide-react',
      'framer-motion'
    ]
  },
  turbopack: {
    root: '../../'
  }
};

module.exports = nextConfig;

