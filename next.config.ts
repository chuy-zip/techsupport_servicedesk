import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // No generar AGENTS.md con instrucciones para agentes de IA
  agentRules: false,
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
