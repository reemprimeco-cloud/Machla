import { WorkerTabBar } from "@/components/worker/WorkerTabBar";
import { requireWorkerAccess } from "@/lib/household/guard";

/**
 * Shared chrome for the worker track — mirrors app/home/layout.tsx: every
 * /worker/* route gets the same persistent bottom tab bar (Home / My
 * Lists / Notifications) instead of each screen inventing its own way
 * back, and the guard runs here so a redirect deeper in the tree is a
 * real HTTP 307 rather than a 200 carrying a client-side refresh — see
 * that layout's own comment for why an otherwise-synchronous layout
 * needs the `await` at all.
 *
 * `pb-20` reserves space for the fixed bar the same way; WorkerTabBar
 * itself adds `env(safe-area-inset-bottom)` on top for the iOS home
 * indicator.
 */
export default async function WorkerLayout({ children }: { children: React.ReactNode }) {
  await requireWorkerAccess();

  return (
    <div className="flex min-h-full flex-col pb-20">
      {children}
      <WorkerTabBar />
    </div>
  );
}
