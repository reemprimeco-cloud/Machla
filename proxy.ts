import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/updateSession";

// Next.js 16 renamed middleware.ts -> proxy.ts (same mechanism, new name
// and export). Two jobs: refresh the Supabase session cookie, and mint a
// per-request CSP nonce. Per-route auth gating lives in each page/layout,
// not here (docs/architecture/08-route-map.md §3).

/**
 * Supabase's origin, needed in connect-src: every query, RPC and auth call
 * goes there directly from the browser.
 */
function supabaseOrigin(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return "";
  try {
    const { origin, host } = new URL(url);
    return `${origin} wss://${host}`;
  } catch {
    return "";
  }
}

/**
 * The CSP is built here rather than in next.config.ts because it carries a
 * nonce, and a nonce must be unique per request.
 *
 * This was NOT the first attempt. A static `script-src 'self'` in
 * next.config.ts looked right and shipped a completely broken app: Next.js
 * inlines its bootstrap and RSC payload as inline <script> tags, so every
 * page failed to hydrate with React error #412. The browser check caught
 * it; reasoning about it did not.
 *
 * - script-src: nonce + 'strict-dynamic'. Next.js stamps the nonce onto
 *   its own inline scripts when it sees this header on the REQUEST, and
 *   'strict-dynamic' then covers the chunks those scripts load.
 * - style-src keeps 'unsafe-inline': a nonce does not cover inline style
 *   *attributes*, and React sets those (the progress bar's width). The
 *   alternative is 'unsafe-hashes' plus a hash per value, which is not
 *   maintainable for a computed percentage.
 * - frame-ancestors 'none': nothing may embed this app. A household's
 *   checklist in a hidden iframe makes "mark completed" a clickjacking
 *   target.
 */
function contentSecurityPolicy(nonce: string): string {
  const supabase = supabaseOrigin();
  const isDev = process.env.NODE_ENV === "development";

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${supabase}`.trim(),
    "font-src 'self'",
    `connect-src 'self' ${supabase}`.trim(),
    "manifest-src 'self'",
    "worker-src 'self'",
    "upgrade-insecure-requests",
  ].join("; ");
}

export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = contentSecurityPolicy(nonce);

  // Next.js reads the nonce off the REQUEST header to stamp its own inline
  // scripts, so this has to be set before the response is produced.
  request.headers.set("x-nonce", nonce);
  request.headers.set("Content-Security-Policy", csp);

  const response = await updateSession(request);
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    /*
     * Run on everything except static assets, image optimization,
     * and the PWA manifest/icons — none of those need a fresh session,
     * and none of them can execute a script.
     */
    "/((?!_next/static|_next/image|favicon|icons|flags|manifest.webmanifest|.*\\.(?:svg|png|ico)$).*)",
  ],
};
