import { redirect } from "next/navigation";

import { NotificationsScreen } from "@/components/notifications/NotificationsScreen";
import { getServerUserProfile } from "@/lib/auth/session";
import { getPrimaryMembership } from "@/lib/household/queries";
import { markNotificationsReadAction } from "@/lib/notifications/actions";
import { getNotificationPreferences, getNotifications } from "@/lib/notifications/queries";

/**
 * Shared by both experiences — a worker and an owner have the same inbox,
 * just different things in it. RLS scopes the rows to the caller, so no
 * role check is needed to keep them apart.
 *
 * Opening the screen marks everything read: the act of looking is the
 * acknowledgement, which is one fewer thing to tap for a user who may not
 * read the label on a "mark as read" button.
 */
export default async function NotificationsPage() {
  const profile = await getServerUserProfile();
  if (!profile) redirect("/login");

  const [notifications, preferences, membership] = await Promise.all([
    getNotifications(),
    getNotificationPreferences(),
    getPrimaryMembership(),
  ]);

  await markNotificationsReadAction();

  return (
    <NotificationsScreen
      notifications={notifications}
      preferences={preferences}
      backHref={membership?.role === "worker" ? "/worker" : "/home"}
    />
  );
}
