import path from "node:path";
import { config as loadDotenv } from "dotenv";
import type { NextConfig } from "next";

// The single `.env` lives in the repository root; `next` runs from apps/web.
loadDotenv({ path: path.resolve(process.cwd(), "../../.env") });

const nextConfig: NextConfig = {
  transpilePackages: ["@ojo/shared", "@ojo/db", "@ojo/core", "@ojo/ui"],
  serverExternalPackages: ["pg"],
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
