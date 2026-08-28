/**
 * Hand-authored Supabase database types matching
 * docs/architecture/03-database-schema.md and
 * supabase/migrations/0001_phase1_foundation.sql.
 *
 * Once a live Supabase project exists, regenerate this file from the
 * real schema instead of maintaining it by hand:
 *
 *   npx supabase gen types typescript --project-id <project-ref> > lib/supabase/database.types.ts
 *
 * Until then, keep this file in sync with the migration by hand.
 */

export type HouseholdRole = "owner" | "member" | "worker";
export type MembershipStatus = "active" | "removed";
export type InvitationStatus = "pending" | "accepted" | "revoked" | "expired";
export type ShoppingListStatus = "draft" | "sent" | "viewed" | "completed" | "archived";
export type PurchaseStatus = "pending" | "purchased" | "unavailable";
export type NotificationType = "list_sent" | "list_viewed" | "list_completed";
/** Which push transport a push_subscriptions row addresses — a browser
 * (including an installed PWA) over Web Push, or an App Store build over
 * APNs. Not a Postgres enum: it is a text column with a CHECK, like the
 * rest of this schema's small closed sets. */
export type PushPlatform = "web" | "ios";

/** Per-type in-app notification switches. A missing key means enabled, so
 * adding a new type does not silently mute it for existing users. */
export type NotificationPreferences = Partial<Record<NotificationType, boolean>>;

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          phone_number: string;
          role: HouseholdRole;
          preferred_language: string | null;
          display_name: string | null;
          notification_preferences: NotificationPreferences;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["users"]["Row"]> & {
          id: string;
          phone_number: string;
        };
        Update: Partial<Database["public"]["Tables"]["users"]["Row"]>;
        Relationships: [];
      };
      households: {
        Row: {
          id: string;
          name: string;
          owner_user_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["households"]["Row"]> & {
          name: string;
          owner_user_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["households"]["Row"]>;
        Relationships: [];
      };
      household_members: {
        Row: {
          id: string;
          household_id: string;
          user_id: string;
          role: HouseholdRole;
          status: MembershipStatus;
          invited_by_user_id: string | null;
          joined_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["household_members"]["Row"]> & {
          household_id: string;
          user_id: string;
          role: HouseholdRole;
        };
        Update: Partial<Database["public"]["Tables"]["household_members"]["Row"]>;
        Relationships: [];
      };
      household_invitations: {
        Row: {
          id: string;
          household_id: string;
          code: string;
          role: Extract<HouseholdRole, "member" | "worker">;
          status: InvitationStatus;
          max_uses: number;
          created_by_user_id: string;
          used_by_user_id: string | null;
          used_at: string | null;
          expires_at: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["household_invitations"]["Row"]> & {
          household_id: string;
          code: string;
          role: Extract<HouseholdRole, "member" | "worker">;
          created_by_user_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["household_invitations"]["Row"]>;
        Relationships: [];
      };
      categories: {
        Row: {
          id: string;
          key: string;
          icon: string | null;
          sort_order: number;
          is_active: boolean;
          /** The capture pseudo-category: the worker's browse grid opens
           * a camera on this tile instead of a product list. */
          is_capture: boolean;
          name_en: string;
          name_ar: string;
          name_hi: string;
          name_te: string;
          name_ur: string;
          name_fil: string;
          name_ne: string;
          name_id: string;
          name_si: string;
          // 20260812180000_catalog_12_languages.sql — nullable, unlike the
          // nine above: the catalogue is translated into these
          // incrementally, and a null falls back to name_en.
          name_am: string | null;
          name_fr: string | null;
          name_fon: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["categories"]["Row"]> & {
          key: string;
          sort_order: number;
          name_en: string;
          name_ar: string;
          name_hi: string;
          name_te: string;
          name_ur: string;
          name_fil: string;
          name_ne: string;
          name_id: string;
          name_si: string;
        };
        Update: Partial<Database["public"]["Tables"]["categories"]["Row"]>;
        Relationships: [];
      };
      products: {
        Row: {
          id: string;
          category_id: string;
          subcategory_id: string | null;
          brand: string | null;
          name_en: string;
          name_ar: string;
          name_hi: string;
          name_te: string;
          name_ur: string;
          name_fil: string;
          name_ne: string;
          name_id: string;
          name_si: string;
          // 20260812180000_catalog_12_languages.sql — nullable, see categories.
          name_am: string | null;
          name_fr: string | null;
          name_fon: string | null;
          size: string | null;
          unit: string;
          icon: string | null;
          image_url: string | null;
          image_source_url: string | null;
          source_name: string | null;
          barcode: string | null;
          sku: string | null;
          search_keywords: string[] | null;
          is_active: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["products"]["Row"]> & {
          category_id: string;
          name_en: string;
          name_ar: string;
          name_hi: string;
          name_te: string;
          name_ur: string;
          name_fil: string;
          name_ne: string;
          name_id: string;
          name_si: string;
          unit: string;
        };
        Update: Partial<Database["public"]["Tables"]["products"]["Row"]>;
        Relationships: [];
      };
      product_usage_stats: {
        Row: {
          id: string;
          user_id: string;
          product_id: string;
          selection_count: number;
          last_selected_at: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["product_usage_stats"]["Row"]> & {
          user_id: string;
          product_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["product_usage_stats"]["Row"]>;
        Relationships: [];
      };
      shopping_lists: {
        Row: {
          id: string;
          household_id: string;
          created_by_user_id: string;
          status: ShoppingListStatus;
          language: string;
          created_at: string;
          sent_at: string | null;
          viewed_at: string | null;
          completed_at: string | null;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["shopping_lists"]["Row"]> & {
          household_id: string;
          created_by_user_id: string;
          language: string;
        };
        Update: Partial<Database["public"]["Tables"]["shopping_lists"]["Row"]>;
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          household_id: string;
          list_id: string | null;
          type: NotificationType;
          actor_user_id: string | null;
          actor_name: string | null;
          created_at: string;
          read_at: string | null;
          // 20260812140000_push_notifications.sql — when a push was
          // dispatched for this row, set by mark_pushes_sent.
          pushed_at: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["notifications"]["Row"]> & {
          user_id: string;
          household_id: string;
          type: NotificationType;
        };
        Update: Partial<Database["public"]["Tables"]["notifications"]["Row"]>;
        Relationships: [];
      };
      // 20260812140000_push_notifications.sql. One row per (browser,
      // device) — RLS-scoped to the caller's own rows, no RPC needed for
      // the ordinary subscribe/unsubscribe path.
      push_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          /** The push service URL for a web row; `apns://<device token>`
           * for an ios one. Either way it identifies one installation,
           * which is why it stays the unique key across both transports
           * (20260814100000_apns_push.sql). */
          endpoint: string;
          /** Web Push only. Null on an APNs row, which is authenticated
           * by a signed provider token rather than per-subscription
           * ECDH — enforced by push_subscriptions_web_keys. */
          p256dh: string | null;
          auth_key: string | null;
          platform: PushPlatform;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["push_subscriptions"]["Row"]> & {
          user_id: string;
          endpoint: string;
        };
        Update: Partial<Database["public"]["Tables"]["push_subscriptions"]["Row"]>;
        Relationships: [];
      };
      shopping_list_items: {
        Row: {
          id: string;
          list_id: string;
          // Nullable since 20260810140000_photo_items.sql: an item is a
          // catalogue product XOR a photograph, enforced by
          // shopping_list_items_product_xor_photo.
          product_id: string | null;
          photo_path: string | null;
          /** Set when the photograph behind photo_path has been purged —
           * on purchase, or on list completion. The row survives; the
           * image does not. */
          photo_deleted_at: string | null;
          category_id: string;
          quantity: number;
          unit: string;
          note: string | null;
          sort_order: number;
          purchase_status: PurchaseStatus;
          purchased_at: string | null;
          purchased_by_user_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["shopping_list_items"]["Row"]> & {
          list_id: string;
          category_id: string;
          unit: string;
          sort_order: number;
        };
        Update: Partial<Database["public"]["Tables"]["shopping_list_items"]["Row"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      // Phase 4 RPCs — supabase/migrations/*_phase4_households.sql.
      // These are the only write paths into households /
      // household_members / household_invitations
      // (docs/architecture/10-security-model.md §1).
      create_household: {
        Args: { p_name: string };
        Returns: string;
      };
      create_invitation: {
        Args: { p_household_id: string; p_role: "member" | "worker"; p_expires_in_days?: number };
        Returns: {
          id: string;
          code: string;
          role: "member" | "worker";
          expires_at: string;
        }[];
      };
      revoke_invitation: {
        Args: { p_invitation_id: string };
        Returns: undefined;
      };
      preview_invitation: {
        Args: { p_code: string };
        Returns: { household_name: string; role: "member" | "worker" }[];
      };
      accept_invitation: {
        Args: { p_code: string };
        Returns: string;
      };
      remove_household_member: {
        Args: { p_household_id: string; p_user_id: string };
        Returns: undefined;
      };
      get_household_members: {
        Args: { p_household_id: string };
        Returns: {
          user_id: string;
          display_name: string | null;
          role: HouseholdRole;
          joined_at: string;
        }[];
      };
      expire_stale_invitations: {
        Args: Record<string, never>;
        Returns: number;
      };
      is_active_member: {
        Args: { p_household_id: string; p_roles?: string[] };
        Returns: boolean;
      };

      // Phase 5 — supabase/migrations/*_phase5_catalog.sql.
      search_products: {
        Args: { p_query: string; p_limit?: number };
        Returns: Database["public"]["Tables"]["products"]["Row"][];
      };

      // Phase 6 RPCs — supabase/migrations/*_phase6_worker_lists.sql.
      // The only write paths into shopping_lists / shopping_list_items /
      // product_usage_stats. None of them accepts or writes
      // purchase_status, purchased_at or purchased_by_user_id — that is a
      // worker-side guarantee enforced in Postgres, not in this file
      // (approved Phase 0 decision 6).
      get_or_create_draft_list: {
        Args: { p_household_id: string; p_language?: string };
        Returns: string;
      };
      // p_update_note added by 20260812120000_list_item_note_preserved.sql:
      // false (the default) preserves whatever note is already on the row,
      // which is what the quantity stepper's calls need — they never pass
      // a note at all and must not wipe out one set from the review screen.
      set_list_item: {
        Args: {
          p_list_id: string;
          p_product_id: string;
          p_quantity?: number;
          p_note?: string | null;
          p_update_note?: boolean;
        };
        Returns: string;
      };
      remove_list_item: {
        Args: { p_list_id: string; p_product_id: string };
        Returns: boolean;
      };
      send_list: {
        Args: { p_list_id: string };
        Returns: string;
      };
      mark_notifications_read: {
        Args: { p_ids?: string[] | null };
        Returns: number;
      };
      set_notification_preference: {
        Args: { p_type: NotificationType; p_enabled: boolean };
        Returns: NotificationPreferences;
      };
      get_frequent_products: {
        Args: { p_limit?: number };
        Returns: Database["public"]["Tables"]["products"]["Row"][];
      };

      // Photographed items — supabase/migrations/*_photo_items.sql.
      // add_photo_item re-checks that the object path sits under this
      // household AND this list; the storage policy can only see the
      // household segment.
      add_photo_item: {
        Args: {
          p_list_id: string;
          p_photo_path: string;
          p_quantity?: number;
          p_note?: string | null;
        };
        Returns: string;
      };
      remove_photo_item: {
        Args: { p_item_id: string };
        Returns: boolean;
      };
      mark_photo_purged: {
        Args: { p_item_id: string };
        Returns: boolean;
      };

      // Phase 7 RPCs — supabase/migrations/*_phase7_household_lists.sql.
      // The household side of the checklist. set_purchase_status is the
      // only write path into purchase_status / purchased_at /
      // purchased_by_user_id anywhere in the system, and it refuses a
      // Worker caller (docs/architecture/10-security-model.md §4).
      mark_list_viewed: {
        Args: { p_list_id: string };
        Returns: string | null;
      };
      set_purchase_status: {
        Args: { p_item_id: string; p_status: PurchaseStatus };
        Returns: Database["public"]["Tables"]["shopping_list_items"]["Row"];
      };
      set_list_completed: {
        Args: { p_list_id: string; p_completed?: boolean };
        Returns: Database["public"]["Tables"]["shopping_lists"]["Row"];
      };
      get_household_lists: {
        Args: { p_household_id: string; p_list_id?: string | null; p_limit?: number };
        Returns: {
          id: string;
          status: ShoppingListStatus;
          language: string;
          created_at: string;
          sent_at: string | null;
          viewed_at: string | null;
          completed_at: string | null;
          created_by_user_id: string;
          created_by_name: string | null;
          total_items: number;
          purchased_items: number;
          unavailable_items: number;
        }[];
      };

      // Push notifications — supabase/migrations/*_push_notifications.sql.
      // Both scoped to `actor_user_id = auth.uid()`: the caller can only
      // ever read back recipients of an action THEY just performed.
      // is_household_side added by
      // 20260812150000_push_notification_target_role.sql: whether the
      // recipient can reach /home/lists/{id} (owner/member) or only
      // /worker/lists (worker) — list_sent recipients are always the
      // former, but list_viewed/list_completed go back to whoever
      // authored the list, which can be either.
      get_pending_pushes: {
        Args: { p_list_id: string; p_type: NotificationType };
        Returns: {
          notification_id: string;
          user_id: string;
          endpoint: string;
          p256dh: string | null;
          auth_key: string | null;
          actor_name: string | null;
          preferred_language: string | null;
          is_household_side: boolean;
          push_platform: PushPlatform;
        }[];
      };
      mark_pushes_sent: {
        Args: { p_notification_ids: string[] };
        Returns: number;
      };
      delete_own_account: {
        Args: Record<string, never>;
        /** One row per photograph that was on a now-deleted owned
         * household's lists — the caller purges these Storage objects
         * itself (see lib/auth/deleteAccount.ts for why). */
        Returns: { photo_path: string }[];
      };
      admin_get_stats: {
        Args: Record<string, never>;
        /** Raises FORBIDDEN for anyone but the hardcoded admin phone
         * number (lib/admin/guard.ts checks the same thing app-side, but
         * the RPC is the real gate — see the migration's own comment). */
        Returns: {
          households: number;
          workers: number;
          owners_and_members: number;
          total_users: number;
          lists_draft: number;
          lists_sent: number;
          lists_viewed: number;
          lists_completed: number;
          lists_archived: number;
          new_users_7d: number;
        }[];
      };
    };
    Enums: Record<string, never>;
  };
}
