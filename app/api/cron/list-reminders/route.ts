import { NextResponse } from "next/server";

import { sendListSentReminders } from "@/lib/push/send";

/**
 * Scheduled sweep: re-pushes any `list_sent` notification that is still
 * unread a while after its first push (lib/push/send.ts
 * sendListSentReminders — see 20260915000000_list_sent_reminder_push.sql
 * for why this needs its own job rather than another RPC off the
 * existing per-action fan-out).
 *
 * Triggered by .github/workflows/list-reminders.yml on a schedule, the
 * same repo-native-cron pattern keep-warm.yml already uses on this
 * Hobby-tier Vercel project (Vercel Cron only fires once a day there —
 * far too coarse for a minutes-scale reminder). Authorization is a
 * shared secret rather than a Supabase session, because nobody is
 * signed in when this fires: CRON_SECRET must match between this
 * project's Vercel env and the workflow's repo secret.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const delayMinutes = Number(process.env.LIST_REMINDER_DELAY_MINUTES) || 15;
  const result = await sendListSentReminders(delayMinutes);
  return NextResponse.json({ ok: true, ...result });
}
