import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  output: "standalone",
  basePath: isProd ? "/eureka" : "",
  assetPrefix: isProd ? "/eureka" : "",
  trailingSlash: true,
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts"],
  },
  env: {
    NEXT_PUBLIC_BASE_PATH: isProd ? "/eureka" : "",
  },
};

export default nextConfig;

