import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Pin the workspace root — a stray package-lock.json in the parent folder
  // makes Turbopack infer ~/Desktop/retilo as root (breaks routing + watchers)
  turbopack: {
    root: path.join(__dirname),
  },
  allowedDevOrigins: ["breeze-reorder-disallow.ngrok-free.dev"],
  async rewrites() {
    return [
      {
        source: "/go/:code",
        destination: "https://api.retilo.io/go/:code",
      },
      // Local demo: proxy API through the page origin so one ngrok tunnel
      // serves both the page and the backend (phones can't reach localhost)
      ...(process.env.LOCAL_API_PROXY
        ? [{ source: "/v1/:path*", destination: `${process.env.LOCAL_API_PROXY}/v1/:path*` }]
        : []),
    ];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || "https://api.retilo.io",
  },
};

export default nextConfig;
