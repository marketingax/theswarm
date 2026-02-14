import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  productionBrowserSourceMaps: false
  // Turbopack disabled: causes async storage invariant errors during prerendering
  // Next.js 16 SWC is more stable for Vercel builds
};

export default nextConfig;
