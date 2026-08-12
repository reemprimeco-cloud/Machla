import "server-only";

import { cache } from "react";

import { getServerUserProfile } from "@/lib/auth/session";
import type { Database, NotificationPreferences } from "@/lib/supabase/database.types";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";
import { createClient } from "@/lib/supabase/server";

export type Notification = Database["public"]["Tables"]["notifications"]["Row"];

/**
 * Reading notifications needs no RPC.
 *
 * `actor_name` is snapshotted onto the row when the trigger creates it,
 * so rendering "Ana sent a list" needs no join to `users` — which is
 * scoped by RLS to the caller's own row and would otherwise have forced a
 * SECURITY DEFINER function just to read your own inbox
 * (supabase/migrations/*_phase8_notifications.sql).
 */
export async function getNotifications(limit = 30): Promise<Notification[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return [];
  return data ?? [];
}

/** Unread count for the badge. cache()'d because both the shell and the
 * page that renders inside it want it in the same request. */
export const getUnreadCount = cache(async (): Promise<number> => {
  if (!isSupabaseConfigured()) return 0;

  const supabase = await createClient();
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);

  if (error) return 0;
  return count ?? 0;
});

/** The caller's own notification switches. Absent keys mean enabled. */
export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  const profile = await getServerUserProfile();
  return profile?.notification_preferences ?? {};
}
