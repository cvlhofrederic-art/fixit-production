// next.config.mobile.ts
// Used for building the static export for Capacitor (mobile app)
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',           // Static HTML export for Capacitor
  trailingSlash: true,        // Required for static export routing
  images: {
    unoptimized: true,        // No Next.js image optimization in static mode
  },
  // Override the entry so only the mobile app routes are built
  // The mobile app starts at /pro/mobile
};

export default nextConfig;
