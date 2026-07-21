import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@meavo/navigation"],
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
      },
    ],
  },
  webpack: (config, { isServer }) => {
    // The server-only Prisma client (src/lib/prisma.ts) transitively imports
    // async_hooks via the audit-log request context. Client components that
    // pull in prisma-coupled modules tree-shake it out at runtime, but webpack
    // still resolves the import graph — stub async_hooks in the browser build.
    if (!isServer) {
      config.resolve = config.resolve ?? {};
      config.resolve.fallback = { ...(config.resolve.fallback ?? {}), async_hooks: false };
    }
    return config;
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
