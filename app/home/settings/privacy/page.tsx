import { PrivacyScreen } from "@/components/legal/PrivacyScreen";

/**
 * The signed-in path to the same policy served publicly at `/privacy`
 * (see that route for why a public copy exists at all). Both render
 * `PrivacyScreen`; only `backHref` differs, so "back" returns here to
 * Settings rather than to the root route's auth-redirect logic.
 */
export default function SettingsPrivacyPage() {
  return <PrivacyScreen backHref="/home/settings" />;
}
