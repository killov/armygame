import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  // Staré stránky (auth)/login a register nahradila úvodní stránka s taby.
  async redirects() {
    return [
      { source: "/login", destination: "/", permanent: false },
      { source: "/register", destination: "/?tab=register", permanent: false },
    ];
  },
};

export default nextConfig;
