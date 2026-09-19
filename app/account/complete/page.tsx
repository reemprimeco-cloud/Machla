import { redirect } from "next/navigation";

import { CompleteAccountScreen } from "@/components/auth/CompleteAccountScreen";
import { getServerUserProfile } from "@/lib/auth/session";
import { getActiveMemberships } from "@/lib/household/queries";

/**
 * Phase 1 of removing OTP (20260919120000_email_password_identity.sql):
 * lets an already-signed-in account add an email/username + password.
 * Not nested under /home or /worker's layouts — those gate on
 * subscription/membership concerns this screen has nothing to do with —
 * so it does its own minimal auth check instead.
 */
export default async function CompleteAccountPage() {
  const profile = await getServerUserProfile();
  if (!profile) redirect("/login");

  // Same "does this account have an owner/member household" check
  // requireHouseholdAccess/requireWorkerAccess use, just to decide where
  // "done" sends them back to.
  const memberships = await getActiveMemberships();
  const hasHome = memberships.some((membership) => membership.role !== "worker");
  const homePath = hasHome ? "/home/dashboard" : "/worker";

  return (
    <CompleteAccountScreen
      currentEmail={profile.email}
      currentUsername={profile.username}
      isSynthetic={profile.is_synthetic_email}
      homePath={homePath}
    />
  );
}
