import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import type { NextConfig } from "next";

initOpenNextCloudflareForDev();

const config: NextConfig = {
  cacheComponents: true,
  partialPrefetching: false,
  transpilePackages: [
    "@repo/ui",
    "@repo/auth",
    "@repo/env",
    "@repo/db",
  ],
  images: {
    // Local and Worker builds serve assets as static files.
    unoptimized: true,
    qualities: [75, 90],
  },
  devIndicators: {
    position: "bottom-right",
  },
};

export default config;
