import type { NextConfig } from "next";
import { LIVE_REDIRECTS } from "./src/lib/v2/redirect-map";

const nextConfig: NextConfig = {
  // A stray lockfile in the user folder made Turbopack pick the wrong root.
  turbopack: { root: __dirname },
  async redirects() {
    // ia-audit 5.6 rows whose targets exist on this branch (src/lib/v2/redirect-map.ts). 301 so
    // external links and SEO equity carry over. Rows still waiting on their target are listed in
    // PENDING_REDIRECTS; the old URL is gated by src/proxy.ts until then.
    return LIVE_REDIRECTS.map((r) => ({ source: r.source, destination: r.destination, statusCode: 301 }));
  },
};

export default nextConfig;
