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
  ownerPhone: string | null;
  ownerName: string | null;
  status: SubscriptionStatus;
  appleLinked: boolean;
  periodEnd: string | null;
  updatedAt: string;
};

export type AdminUserRow = {
  id: string;
  displayName: string | null;
  phoneNumber: string | null;
  email: string | null;
  createdAt: string;
};

export type AdminLapsedTrialRow = {
  householdId: string;
  householdName: string;
  ownerName: string | null;
  ownerPhone: string | null;
  ownerEmail: string | null;
  trialEndedAt: string;
};

export type AdminCountryRow = {
  /** null groups every account with no country on file — created before
   * 20260923120000_admin_country_and_feedback.sql, or completed via
   * completeAccountAction rather than signed up fresh. */
  countryCode: string | null;
  signups: number;
};

export type AdminFeedbackRow = {
  id: string;
  message: string;
  createdAt: string;
  displayName: string | null;
  phoneNumber: string | null;
  email: string | null;
  countryCode: string | null;
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

/** Registered users grouped by the country they picked at sign-up,
 * busiest first. */
export async function getAdminCountryStats(): Promise<AdminCountryRow[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_get_country_stats");
  if (error || !data) return [];

  return data.map((row) => ({
    countryCode: row.country_code,
    signups: row.signups,
  }));
}

/** Every suggestion submitted from the in-app Feedback screen, newest
 * first. */
export async function getAdminFeedback(): Promise<AdminFeedbackRow[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_feedback", { p_limit: 100 });
  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    message: row.message,
    createdAt: row.created_at,
    displayName: row.display_name,
    phoneNumber: row.phone_number,
    email: row.email,
    countryCode: row.country_code,
  }));
}

/** Which of the given product-images paths already have a file uploaded
 * — /admin/photos uses this to show each pending item as done or not,
 * since storage.objects has no per-object read RPC of its own. */
export async function getUploadedImagePaths(paths: string[]): Promise<Set<string>> {
  if (!isSupabaseConfigured() || paths.length === 0) return new Set();

  const supabase = await createClient();
  const { data, error } = await supabase.storage.from("product-images").list("", {
    limit: 1000,
    search: "",
  });
  if (error || !data) return new Set();

  const existing = new Set(data.map((f) => f.name));
  return new Set(paths.filter((p) => existing.has(p)));
}

export type AdminProductRow = {
  id: string;
  categoryId: string;
  nameAr: string;
  nameEn: string;
  brand: string | null;
  icon: string | null;
  imageUrl: string | null;
  isActive: boolean;
  categoryNameAr?: string;
};

export type AdminCategoryRow = {
  id: string;
  key: string;
  nameAr: string;
  icon: string | null;
};

/** Every category and every product in the catalog — /admin/photos'
 * search-and-upload list and its by-category browser (add/deactivate a
 * product) both read from this one fetch. ~600 products today; cheap
 * enough to send whole and filter/group client-side rather than a
 * round-trip per category the owner clicks into. */
export async function getCatalogForAdmin(): Promise<{
  categories: AdminCategoryRow[];
  products: AdminProductRow[];
}> {
  if (!isSupabaseConfigured()) return { categories: [], products: [] };

  const supabase = await createClient();
  const [{ data: products, error }, { data: categories }] = await Promise.all([
    supabase
      .from("products")
      .select("id, name_ar, name_en, brand, icon, image_url, category_id, is_active")
      .order("name_ar"),
    supabase.from("categories").select("id, key, name_ar, icon").order("sort_order"),
  ]);
  if (error || !products) return { categories: [], products: [] };

  const categoryNameById = new Map((categories ?? []).map((c) => [c.id, c.name_ar]));

  return {
    categories: (categories ?? []).map((c) => ({
      id: c.id,
      key: c.key,
      nameAr: c.name_ar,
      icon: c.icon,
    })),
    products: products.map((row) => ({
      id: row.id,
      categoryId: row.category_id,
      nameAr: row.name_ar,
      nameEn: row.name_en,
      brand: row.brand,
      icon: row.icon,
      imageUrl: row.image_url,
      isActive: row.is_active,
      categoryNameAr: categoryNameById.get(row.category_id),
    })),
  };
}
