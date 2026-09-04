"use server";

import { revalidatePath } from "next/cache";

import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";
import { createClient } from "@/lib/supabase/server";

import { fetchAppleSubscriptionState } from "./apple";

/**
 * Called right after StoreKit reports a successful purchase or restore
 * (components/native/NativeBridge.tsx, via the iap:purchased and
 * iap:restored messages the shell sends — see lib/native/bridge.ts).
 *
 * Looks the transaction up with Apple directly rather than trusting
 * whatever the device just said: StoreKit already verified the purchase
 * cryptographically on-device (that is what
 * `VerificationResult.verified` means), but "this JWS is genuinely from
 * Apple" is a different question from "is this subscription currently
 * active", and the household's row should only ever reflect what Apple's
 * own servers say right now.
 */
export async function syncAppleSubscriptionAction(
  householdId: string,
  originalTransactionId: string,
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const state = await fetchAppleSubscriptionState(originalTransactionId);
  if (!state) return false;

  const supabase = await createClient();
  const { error } = await supabase.rpc("link_apple_subscription", {
    p_household_id: householdId,
    p_original_transaction_id: state.originalTransactionId,
    p_status: state.status,
    p_period_end: state.periodEnd,
  });

  if (error) {
    console.error("[subscription] link_apple_subscription error:", error.message);
    return false;
  }

  revalidatePath("/home", "layout");
  return true;
}
