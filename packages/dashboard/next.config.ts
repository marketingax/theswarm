import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  productionBrowserSourceMaps: false,
  experimental: {
    optimizePackageImports: ["lucide-react"]
  },
  turbopack: {
    root: path.resolve(__dirname, "../../")
  }
};

export default nextConfig;
