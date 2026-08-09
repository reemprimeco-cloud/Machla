import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/updateSession";

// Next.js 16 renamed middleware.ts -> proxy.ts (same mechanism, new name
// and export). This is the ONLY thing this file does — refresh the
// Supabase session cookie on every request. Per-route auth gating lives
// in each page/layout, not here (docs/architecture/08-route-map.md §3).
export function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Run on everything except static assets, image optimization,
     * and the PWA manifest/icons — none of those need a fresh session.
     */
    "/((?!_next/static|_next/image|favicon|icons|flags|manifest.webmanifest|.*\\.(?:svg|png|ico)$).*)",
  ],
};
