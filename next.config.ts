import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// Content-Security-Policy.
//
// `'unsafe-inline'` on script-src is a deliberate compromise: the App Router
// injects inline bootstrap scripts, and the alternative (per-request nonces via
// middleware) forces every page to render dynamically, which would cost this
// app its static optimization. The high-value directives — frame-ancestors,
// object-src, base-uri, form-action — are still enforced, and those are what
// block clickjacking, plugin injection, and form exfiltration.
//
// Host allowances trace to real browser-side dependencies:
//   - cartocdn: Leaflet map tiles, loaded as <img> (components/map/ListingsMap.tsx)
//   - nominatim: geocoding autocomplete, fetched from the client (lib/geo/nominatim.ts)
// Listing photos are not listed because next/image proxies them through
// /_next/image on this origin.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.basemaps.cartocdn.com",
  "font-src 'self' data:",
  "connect-src 'self' https://nominatim.openstreetmap.org",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
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
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
