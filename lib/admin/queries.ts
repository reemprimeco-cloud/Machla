import "server-only";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";

export type AdminStats = {
  households: number;
  workers: number;
  ownersAndMembers: number;
  totalUsers: number;
  listsDraft: number;
  listsSent: number;
  listsViewed: number;
  listsCompleted: number;
  listsArchived: number;
  newUsers7d: number;
};

/** Calls admin_get_stats() — see that migration for why this can see
 * past the caller's own household despite RLS, and for who's allowed
 * to call it at all. Returns null if not configured or not authorized,
 * rather than throwing: requireAdminAccess() already redirected anyone
 * who shouldn't be here, so a null result at this point means Supabase
 * itself isn't set up (dev/preview without env vars). */
export async function getAdminStats(): Promise<AdminStats | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_get_stats");
  if (error || !data?.[0]) return null;

  const row = data[0];
  return {
    households: row.households,
    workers: row.workers,
    ownersAndMembers: row.owners_and_members,
    totalUsers: row.total_users,
    listsDraft: row.lists_draft,
    listsSent: row.lists_sent,
    listsViewed: row.lists_viewed,
    listsCompleted: row.lists_completed,
    listsArchived: row.lists_archived,
    newUsers7d: row.new_users_7d,
  };
}
