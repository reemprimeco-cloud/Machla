import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import type { Database } from "./database.types";

/**
 * Supabase client for use in Server Components, Route Handlers, and
 * Server Actions. Uses only the public anon key — RLS (not this client's
 * privilege level) is what authorizes every read/write
 * (docs/architecture/10-security-model.md).
 *
 * Session refresh via middleware is a Phase 3 concern (added once there
 * is an actual sign-in flow and protected routes to refresh sessions
 * for) — see docs/architecture/06-auth-otp-flow.md.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Called from a Server Component without a surrounding
            // Server Action/Route Handler — safe to ignore once
            // Phase 3 middleware is in place to refresh sessions.
          }
        },
      },
    },
  );
}
