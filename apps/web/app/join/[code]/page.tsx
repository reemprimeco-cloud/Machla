import { redirect } from "next/navigation";

import { JoinFlow } from "@/components/household/JoinFlow";
import { getServerUserProfile } from "@/lib/auth/session";

/**
 * Deep-link entry point (homelist.app/join/K7P4M2). An unauthenticated
 * visitor is sent to sign in first and can return to this same URL —
 * the code is in the path, so nothing is lost.
 */
export default async function JoinWithCodePage({ params }: PageProps<"/join/[code]">) {
  const { code } = await params;

  const profile = await getServerUserProfile();
  if (!profile) redirect(`/login?next=${encodeURIComponent(`/join/${code}`)}`);

  return <JoinFlow initialCode={code} defaultDisplayName={profile.display_name ?? ""} />;
}
