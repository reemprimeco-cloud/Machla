import { redirect } from "next/navigation";

import { FeedbackScreen } from "@/components/feedback/FeedbackScreen";
import { getServerUserProfile } from "@/lib/auth/session";
import { getPrimaryMembership } from "@/lib/household/queries";

/**
 * Shared by both experiences (app/notifications/page.tsx is the model —
 * only a signed-in session is required, no household/worker role check),
 * reached from SettingsScreen.tsx and AccountActions.tsx alike.
 */
export default async function FeedbackPage() {
  const profile = await getServerUserProfile();
  if (!profile) redirect("/login");

  const membership = await getPrimaryMembership();
  const backHref = membership?.role === "worker" ? "/worker" : "/home/settings";

  return <FeedbackScreen backHref={backHref} />;
}
