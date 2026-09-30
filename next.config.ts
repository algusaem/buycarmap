import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";
import { env } from "@/lib/env";

// The policy header that blocks inline-script injection now lives in
// proxy.ts, with a fresh per-request nonce (PLAT-21/PLAT-24,
// docs/specs/core-platform.md). It used to be sent here as a static header
// whose script-src allowed 'unsafe-inline'.
//
// Host allowances trace to real browser-side dependencies:
//   - cartocdn: Leaflet map tiles, loaded as <img> (components/map/ListingsMap.tsx)
//   - nominatim: geocoding autocomplete, fetched from the client (lib/geo/nominatim.ts)
// Listing photos are not listed because next/image proxies them through
// /_next/image on this origin. See proxy.ts for the actual directives.
const securityHeaders = [
  // Redundant with frame-ancestors for modern browsers, kept for older ones.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // The map asks for the user's position, so geolocation must stay enabled for
  // this origin; everything else is switched off.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), payment=(), geolocation=(self)",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "**.wallapop.com",
      },
      {
        protocol: "https",
        hostname: "**.ccdn.es",
      },
      {
        protocol: "https",
        hostname: "**.milanuncios.com",
      },
    ],
  },
  // Pino ships native code paths pino-pretty's worker-thread transport needs;
  // bundling either into the server build breaks at runtime (PLAT-16).
  serverExternalPackages: ["pino", "pino-pretty"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  org: env.SENTRY_ORG,
  project: env.SENTRY_PROJECT,
  authToken: env.SENTRY_AUTH_TOKEN,
  // Browser events go through this route instead of straight to Sentry, so an
  // ad blocker cannot silently drop them and the CSP needs no Sentry host
  // (PLAT-18, docs/specs/core-platform.md).
  tunnelRoute: "/monitoring",
  silent: true,
  sourcemaps: { disable: !env.SENTRY_AUTH_TOKEN },
  telemetry: false,
});
