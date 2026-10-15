import type { NextConfig } from "next";
import { appSecurityHeaders } from "./lib/security-headers";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // App-owned baseline: covers every app route including error
        // responses (e.g. the branded 404). The edge layer must not
        // duplicate or strip these — see lib/security-headers.ts.
        source: "/:path*",
        headers: appSecurityHeaders(),
      },
    ];
  },
};

export default nextConfig;
