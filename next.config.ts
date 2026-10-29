import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Photos are uploaded through server actions; allow phone-sized images.
  experimental: {
    serverActions: { bodySizeLimit: "6mb" },
  },
  // `pg` is a Node-only package; keep it out of the bundle.
  serverExternalPackages: ["pg"],
};

export default nextConfig;
