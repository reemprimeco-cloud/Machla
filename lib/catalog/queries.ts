import "server-only";

import { cache } from "react";

import type { Database } from "@/lib/supabase/database.types";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";
import { createClient } from "@/lib/supabase/server";

/**
 * Read paths into the catalogue.
 *
 * `categories` and `products` are world-readable reference data
 * (`using (true)`) and have no client write path at all, so these are
 * plain selects with no authorization of their own to do — the interesting
 * access control in Phase 6 is on the *list*, not the catalogue
 * (docs/architecture/11-product-catalog-architecture.md §7.8).
 */

export type Category = Database["public"]["Tables"]["categories"]["Row"];
export type Product = Database["public"]["Tables"]["products"]["Row"];

/** All active categories in aisle order. cache()'d because the worker
 * home, the category screen, and the list review all need it in one
 * request. */
export const getCategories = cache(async (): Promise<Category[]> => {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) return [];
  return data ?? [];
});

export const getCategoryByKey = cache(async (key: string): Promise<Category | null> => {
  const categories = await getCategories();
  return categories.find((category) => category.key === key) ?? null;
});

/** Products in one category, in the order the importer assigned. */
export async function getProductsInCategory(categoryId: string): Promise<Product[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("category_id", categoryId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) return [];
  return data ?? [];
}

/**
 * Cross-language product search.
 *
 * Goes through the `search_products` RPC rather than building a filter
 * here, because the interesting part — searching all nine languages plus
 * brand and transliteration at once, so "gatas" and "doodh" both find
 * milk — lives in the function's `search_text` haystack, which no
 * client-side query can reproduce (master plan Section 20).
 */
export async function searchProducts(query: string, limit = 40): Promise<Product[]> {
  const trimmed = query.trim();
  if (!trimmed || !isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_products", {
    p_query: trimmed,
    p_limit: limit,
  });

  if (error) return [];
  return data ?? [];
}

/** The caller's most-chosen products. `product_usage_stats` is scoped to
 * `user_id = auth.uid()` by RLS, so this returns one worker's own habits
 * and never another's. */
export async function getFrequentProducts(limit = 12): Promise<Product[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_frequent_products", { p_limit: limit });

  if (error) return [];
  return data ?? [];
}
