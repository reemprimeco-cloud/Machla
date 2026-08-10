import type { NextConfig } from "next";

/**
 * Headers that are identical for every request live here. The
 * Content-Security-Policy does NOT: it carries a per-request nonce and is
 * set in proxy.ts. Defining it in both places would make the browser
 * enforce the intersection of the two, which is a confusing way to break
 * things.
 */
const securityHeaders = [
  // Two years, subdomains included. Only meaningful over HTTPS, which
  // Vercel terminates; harmless locally because browsers ignore HSTS on
  // http://localhost.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },

  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },

  // Nothing in this app needs any of these. Denying them by default means
  // a future dependency cannot quietly start using one.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },

  // Redundant next to frame-ancestors for modern browsers, kept for older
  // ones that never implemented CSP Level 2.
  { key: "X-Frame-Options", value: "DENY" },
];

const nextConfig: NextConfig = {
  // Vercel sets this header itself; removing it drops one small piece of
  // stack fingerprinting.
  poweredByHeader: false,

  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },

      // The service worker must never be cached by an intermediary, or a
      // stale one keeps serving an old strategy long after a deploy.
      {
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "public, max-age=0, must-revalidate" }],
      },
    ];
  },
};

export default nextConfig;
