import "server-only";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";
import type { SubscriptionStatus } from "@/lib/supabase/database.types";

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
  newUsersToday: number;
  iosDeviceCount: number;
  subscriptionsPaid: number;
  subscriptionsComped: number;
  subscriptionsTrialing: number;
  subscriptionsLapsed: number;
  subscriptionsExpiredOrRevoked: number;
};

export type AdminSubscriptionRow = {
  householdId: string;
  householdName: string;
  ownerPhone: string;
  ownerName: string | null;
  status: SubscriptionStatus;
  appleLinked: boolean;
  periodEnd: string | null;
  updatedAt: string;
};

export type AdminUserRow = {
  id: string;
  displayName: string | null;
  phoneNumber: string;
  email: string | null;
  createdAt: string;
};

export type AdminLapsedTrialRow = {
  householdId: string;
  householdName: string;
  ownerName: string | null;
  ownerPhone: string;
  ownerEmail: string | null;
  trialEndedAt: string;
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
    newUsersToday: row.new_users_today,
    iosDeviceCount: row.ios_device_count,
    subscriptionsPaid: row.subscriptions_paid,
    subscriptionsComped: row.subscriptions_comped,
    subscriptionsTrialing: row.subscriptions_trialing,
    subscriptionsLapsed: row.subscriptions_lapsed,
    subscriptionsExpiredOrRevoked: row.subscriptions_expired_or_revoked,
  };
}

/** Every household that has ever left the free trial — subscribed,
 * lapsed, expired, revoked, or was manually comped — newest change
 * first. There is no per-transaction amount on file (Apple's status
 * callback never carries one), so `appleLinked` is what the admin page
 * uses to show the nominal listed price versus "comped". */
export async function getAdminRecentSubscriptions(): Promise<AdminSubscriptionRow[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_recent_subscriptions", {
    p_limit: 20,
  });
  if (error || !data) return [];

  return data.map((row) => ({
    householdId: row.household_id,
    householdName: row.household_name,
    ownerPhone: row.owner_phone,
    ownerName: row.owner_name,
    status: row.subscription_status,
    appleLinked: row.apple_linked,
    periodEnd: row.period_end,
    updatedAt: row.updated_at,
  }));
}

/** Most recently created accounts, newest first. */
export async function getAdminRecentUsers(): Promise<AdminUserRow[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_recent_users", { p_limit: 20 });
  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    displayName: row.display_name,
    phoneNumber: row.phone_number,
    email: row.email,
    createdAt: row.created_at,
  }));
}

/** Everyone who signed up today (Asia/Kuwait calendar day — see
 * admin_list_today_signups, 20260919130000_admin_today_signups_and_broadcast.sql),
 * newest first. A dedicated query rather than filtering
 * getAdminRecentUsers()'s 20-row page client-side, which would silently
 * under-count past 20 sign-ups in a single day. */
export async function getAdminTodaySignups(): Promise<AdminUserRow[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_today_signups");
  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    displayName: row.display_name,
    phoneNumber: row.phone_number,
    email: row.email,
    createdAt: row.created_at,
  }));
}

/** Every household whose free trial ended without ever subscribing —
 * the actual names/phones behind AdminStats.subscriptionsLapsed, oldest
 * lapse first (see admin_list_lapsed_trials,
 * 20260920100000_admin_contact_and_lapsed_trials.sql). This is who the
 * admin page's WhatsApp/email contact icons exist for. */
export async function getAdminLapsedTrials(): Promise<AdminLapsedTrialRow[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_lapsed_trials");
  if (error || !data) return [];

  return data.map((row) => ({
    householdId: row.household_id,
    householdName: row.household_name,
    ownerName: row.owner_name,
    ownerPhone: row.owner_phone,
    ownerEmail: row.owner_email,
    trialEndedAt: row.trial_ended_at,
  }));
}
