import type { NextConfig } from "next";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3001";

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
    ];
  },

  async headers() {
    return [
      {
        source: "/:all(favicon\\.ico|favicon-:size(16|32)x:size(16|32)\\.png|apple-touch-icon\\.png|android-chrome-:size(192|512)x:size(192|512)\\.png)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, must-revalidate",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
