import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  productionBrowserSourceMaps: false,
  experimental: {
    optimizePackageImports: ["lucide-react"]
  }
};

export default nextConfig;
