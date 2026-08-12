import { HomeTabBar } from "@/components/household/HomeTabBar";
import { requireHouseholdAccess } from "@/lib/household/guard";

/**
 * Shared chrome for the whole owner/member experience: every /home/*
 * route (the Homes switcher, a household's dashboard, its lists, its
 * people, its invitations, and account settings) gets the same
 * persistent bottom tab bar, iOS-style, instead of each screen inventing
 * its own way back.
 *
 * Calls `requireHouseholdAccess()` itself — not to authorize anything a
 * page doesn't already re-check (each one still calls it independently,
 * `getServerUserProfile`/`getActiveMemberships` are `cache()`'d so the
 * second call is free), but so this layout is `async` and blocks on the
 * result BEFORE it renders anything. A layout with no awaited work of its
 * own resolves and starts streaming its shell to the client immediately,
 * which turns a page-level `redirect()` deeper in the tree into a 200
 * response carrying a client-side refresh instruction instead of a real
 * HTTP 307 — confirmed by curling an unauthenticated `/home/lists`
 * before this fix. Awaiting the same guard up here restores the real
 * status code for every route under this layout.
 *
 * The `pb-20` wrapper reserves space for the fixed-position bar so the
 * last card in a list is never hidden behind it; `HomeTabBar` itself adds
 * `env(safe-area-inset-bottom)` on top of that for the iOS home
 * indicator.
 */
export default async function HomeLayout({ children }: { children: React.ReactNode }) {
  await requireHouseholdAccess();

  return (
    <div className="flex min-h-full flex-col pb-20">
      {children}
      <HomeTabBar />
    </div>
  );
}
