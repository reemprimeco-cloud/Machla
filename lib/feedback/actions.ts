"use server";

import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";
import { createClient } from "@/lib/supabase/server";

export type FeedbackErrorCode = "NOT_CONFIGURED" | "EMPTY" | "TOO_LONG" | "UNKNOWN";

export type FeedbackResult = { ok: true } | { ok: false; code: FeedbackErrorCode };

/**
 * The Feedback screen's only write path
 * (20260923120000_admin_country_and_feedback.sql) — `submit_feedback`
 * checks auth.uid() itself, so this action authorizes nothing beyond
 * what the RPC already refuses on its own; it only translates the
 * Postgres error into something the screen can show.
 */
export async function submitFeedbackAction(message: string): Promise<FeedbackResult> {
  if (!isSupabaseConfigured()) return { ok: false, code: "NOT_CONFIGURED" };

  const trimmed = message.trim();
  if (!trimmed) return { ok: false, code: "EMPTY" };
  if (trimmed.length > 4000) return { ok: false, code: "TOO_LONG" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_feedback", { p_message: trimmed });
  if (error) return { ok: false, code: "UNKNOWN" };

  return { ok: true };
}
