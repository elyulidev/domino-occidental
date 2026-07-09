import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  allowedDevOrigins: ["127.0.0.1"],

  // Allow avatar uploads up to 3 MB (server-side check enforces 1 MB limit)
  serverActions: {
    bodySizeLimit: "3mb",
  },
};

export default nextConfig;
