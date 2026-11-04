import { LoadingScreen } from "@/components/ui/States";

/** Covers /admin and /admin/photos — the dashboard is a grid of stat
 * tiles/cards, not rows, unlike the rest of the app (2026-11-04
 * performance audit: this page's 7 parallel queries had no loading
 * state at all before this). */
export default function Loading() {
  return <LoadingScreen tiles={8} />;
}
