import type { NextConfig } from "next";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3001";
const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL ?? "http://localhost:8787";

const nextConfig: NextConfig = {
  reactCompiler: true,
  allowedDevOrigins: ["127.0.0.1"],

  experimental: {
    // Allow avatar uploads up to 3 MB (server-side check enforces 1 MB limit)
    serverActions: {
      bodySizeLimit: "3mb",
    },
  },

  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${BACKEND_URL}/api/:path*`,
      },
      // Migration shim: PR4 frontend calls /matchmaking/* but Elysia serves /api/v1/matchmaking/*
      {
        source: "/matchmaking/:path*",
        destination: `${WORKER_URL}/matchmaking/:path*`,
      },
    ];
  },
};

export default nextConfig;
