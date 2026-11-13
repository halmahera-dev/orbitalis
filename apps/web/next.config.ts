import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import type { NextConfig } from "next";

initOpenNextCloudflareForDev();

const config: NextConfig = {
  transpilePackages: [
    "@repo/ui",
    "@repo/auth",
    "@repo/env",
    "@repo/db",
  ],
  images: {
    // Serve local assets directly because the Vercel service image endpoint returns 404.
    unoptimized: true,
    qualities: [75, 90],
  },
  devIndicators: {
    position: "bottom-right",
  },
};

export default config;
