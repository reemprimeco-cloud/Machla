import "server-only";

import type { Product } from "@/lib/catalog/queries";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";
import { createClient } from "@/lib/supabase/server";

/** Every product id the caller has favorited — RLS scopes
 * favorite_items to `user_id = auth.uid()` directly, so this needs no
 * explicit filter. Used to mark the heart filled/outline on every
 * product card without an extra round trip per card. */
export async function getFavoriteProductIds(): Promise<Set<string>> {
  if (!isSupabaseConfigured()) return new Set();

  const supabase = await createClient();
  const { data, error } = await supabase.from("favorite_items").select("product_id");
  if (error || !data) return new Set();

  return new Set(data.map((row) => row.product_id));
}

/** The caller's favorited products, newest first — the "المفضلة" screen. */
export async function getFavoriteProducts(): Promise<Product[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data: favorites, error } = await supabase
    .from("favorite_items")
    .select("product_id, created_at")
    .order("created_at", { ascending: false });
  if (error || !favorites || favorites.length === 0) return [];

  const { data: products } = await supabase
    .from("products")
    .select("*")
    .in(
      "id",
      favorites.map((f) => f.product_id),
    );
  const productById = new Map((products ?? []).map((p) => [p.id, p]));

  return favorites
    .map((f) => productById.get(f.product_id))
    .filter((product): product is Product => product !== undefined);
}
