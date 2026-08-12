import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { isSupabaseConfigured } from "./isConfigured";

/**
 * Refreshes the Supabase auth session cookie on every request. Called
 * from proxy.ts (Next.js 16's renamed middleware.ts — see
 * node_modules/next/dist/docs/.../file-conventions/proxy.md).
 *
 * This is the standard @supabase/ssr session-refresh pattern: without
 * it, a browser session can go stale between requests because only the
 * client SDK would otherwise renew the token, not the server. It does
 * NOT do route protection — each protected page/layout still checks
 * auth itself server-side (docs/architecture/08-route-map.md §3,
 * defense in depth, not the only control).
 */
export async function updateSession(request: NextRequest) {
  // No live Supabase project yet (docs/architecture/14-technical-risks-decisions.md
  // item 10) — pass every request through unchanged rather than
  // crashing on every page load.
  if (!isSupabaseConfigured()) return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  // Required: this call is what actually triggers the refresh (getUser,
  // not getSession — getUser revalidates against Supabase Auth itself
  // rather than trusting a possibly-stale local JWT).
  await supabase.auth.getUser();

  return response;
}
