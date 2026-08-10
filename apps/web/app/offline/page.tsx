import { OfflineScreen } from "@/components/ui/OfflineScreen";

/**
 * Served by the service worker when a navigation fails with no network.
 *
 * Deliberately a real route rather than an inline HTML string in sw.js:
 * it gets the app's fonts, theme and localized copy for free, and stays in
 * step with them without anyone remembering to update two places.
 */
export default function OfflinePage() {
  return <OfflineScreen />;
}
