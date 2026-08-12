import { redirect } from "next/navigation";

import { CreateHouseholdForm } from "@/components/household/CreateHouseholdForm";
import { getServerUserProfile } from "@/lib/auth/session";

/**
 * Reachable both by a first-time user (via /onboarding) and by an
 * existing owner/member adding another household (My Office alongside My
 * Home) — see the comment on app/onboarding/page.tsx. Nothing here
 * assumes a first household: `create_household` has no such constraint
 * either (supabase/migrations/20260809140000_phase4_households.sql).
 */
export default async function NewHouseholdPage() {
  const profile = await getServerUserProfile();
  if (!profile) redirect("/login");

  return <CreateHouseholdForm defaultDisplayName={profile.display_name ?? ""} />;
}
