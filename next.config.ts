import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Photos are uploaded through server actions; allow phone-sized images.
  experimental: {
    serverActions: {
      bodySizeLimit: "6mb",
      // Forms work when testing through a Cloudflare tunnel link.
      allowedOrigins: ["*.trycloudflare.com"],
    },
  },
  // Let a phone load the dev site through a Cloudflare tunnel link.
  allowedDevOrigins: ["*.trycloudflare.com"],
  // `pg` is a Node-only package; keep it out of the bundle.
  serverExternalPackages: ["pg"],
  // There is a stray package-lock.json in the home folder; pin the root here.
  turbopack: { root: process.cwd() },
};

export default nextConfig;
