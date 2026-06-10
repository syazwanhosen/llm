import type { NextConfig } from "next";

// The UI is frontend-only; every /api/* call is proxied to the existing Hono
// backend (default http://localhost:3000), so there's no CORS and URLs stay
// relative. Override the target with the BACKEND_URL env var.
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3000";

const nextConfig: NextConfig = {
  turbopack: { root: __dirname }, // this folder is the app root (silences multi-lockfile warning)
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${BACKEND_URL}/api/:path*` }];
  },
};

export default nextConfig;
