"use server";

import { revalidatePath } from "next/cache";

import type { NotificationType } from "@/lib/supabase/database.types";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";
import { createClient } from "@/lib/supabase/server";

/**
 * Notifications are created by a database trigger, never by the client,
 * and `notifications` has no write policy at all. So these two actions
 * are the entire mutation surface: mark mine read, and change my own
 * switches. Both are scoped to auth.uid() inside the RPC — passing
 * someone else's notification id simply matches nothing.
 */

/** Marks the caller's notifications read. No argument = all of them,
 * which is what opening the notifications screen does. */
export async function markNotificationsReadAction(ids?: string[]): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const supabase = await createClient();
  await supabase.rpc("mark_notifications_read", { p_ids: ids ?? null });

  revalidatePath("/", "layout");
}

export async function setNotificationPreferenceAction(
  type: NotificationType,
  enabled: boolean,
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_notification_preference", {
    p_type: type,
    p_enabled: enabled,
  });

  if (error) return false;

  revalidatePath("/", "layout");
  return true;
}
