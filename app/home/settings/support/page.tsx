import { SupportScreen } from "@/components/legal/SupportScreen";

/**
 * The signed-in path to the same page served publicly at `/support`
 * (see that route for why a public copy exists at all). Both render
 * `SupportScreen`; only `backHref` differs, so "back" returns here to
 * Settings rather than to the root route's auth-redirect logic.
 */
export default function SettingsSupportPage() {
  return <SupportScreen backHref="/home/settings" />;
}
