import type { NextConfig } from "next";

const backendOrigin = process.env.RIA_BACKEND_ORIGIN?.replace(/\/+$/, "");

if (process.env.VERCEL && !backendOrigin) {
  throw new Error("RIA_BACKEND_ORIGIN must be set for Vercel deployments.");
}

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  async rewrites() {
    return backendOrigin
      ? [
          {
            source: "/api/:path*",
            destination: `${backendOrigin}/api/:path*`,
          },
        ]
      : [];
  },
};

export default nextConfig;
