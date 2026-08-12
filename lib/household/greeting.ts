import "server-only";

import type { MessageKey } from "@/lib/i18n/messages";

/**
 * Which of the three greeting strings (home.greetingMorning/Afternoon/
 * Evening) fits right now, by the hour in Kuwait local time — not the
 * server's own timezone, which on Vercel is whatever region it happens
 * to run in. This app has one real audience (Kuwait), so a fixed IANA
 * zone is simpler and more correct than plumbing the visitor's own
 * timezone through for a greeting that nobody will notice is wrong by
 * an hour or two, but would look broken if it said "good evening" at
 * 9am because the server was in UTC.
 */
export function greetingKeyForNow(): MessageKey {
  // en-US's 24-hour formatting quirk: midnight comes back as "24", not
  // "0" — normalize before comparing, or midnight would read as evening.
  const raw = Number(
    new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hour12: false,
      timeZone: "Asia/Kuwait",
    }).format(new Date()),
  );
  const hour = raw === 24 ? 0 : raw;

  if (hour < 12) return "home.greetingMorning";
  if (hour < 18) return "home.greetingAfternoon";
  return "home.greetingEvening";
}
