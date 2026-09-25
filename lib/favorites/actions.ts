"use server";

import { revalidatePath } from "next/cache";

import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";
import { createClient } from "@/lib/supabase/server";

export type ToggleFavoriteResult = { ok: true; isFavorite: boolean } | { ok: false };

/** Adds or removes a product from the caller's own favorites —
 * toggle_favorite_item() does both in one round trip and returns which
 * one happened, so the client doesn't need to track prior state itself. */
export async function toggleFavoriteAction(productId: string): Promise<ToggleFavoriteResult> {
  if (!isSupabaseConfigured()) return { ok: false };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("toggle_favorite_item", {
    p_product_id: productId,
  });
  if (error || data === null) return { ok: false };

  // Only the favorites list screens need a fresh read after this — every
  // product-browsing screen already updates its own heart optimistically.
  revalidatePath("/worker/favorites");
  revalidatePath("/home/shop/favorites");

  return { ok: true, isFavorite: data };
}
