import "server-only";

import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";

type UserRow = Database["public"]["Tables"]["users"]["Row"];

/**
 * Server-side auth check for Server Components/pages
 * (docs/architecture/06-auth-otp-flow.md §2). Uses `getUser()`, not
 * `getSession()` — `getUser()` revalidates the token against Supabase
 * Auth itself rather than trusting a possibly-stale local JWT, which
 * matters for a value used to decide what to render/redirect.
 *
 * Returns `null` when there is no session — callers redirect as needed;
 * this helper never redirects itself, so it stays usable from contexts
 * (like layouts) where the right redirect target differs by caller.
 *
 * Wrapped in React's `cache()` so calling it from both the root layout
 * (to reconcile the locale — see app/layout.tsx) and a page (to render
 * the profile) costs one query per request, not two.
 */
export const getServerUserProfile = cache(async (): Promise<UserRow | null> => {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase.from("users").select("*").eq("id", user.id).maybeSingle();
  return data;
});
