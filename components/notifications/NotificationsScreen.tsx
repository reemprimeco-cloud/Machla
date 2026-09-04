"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { HomeTabBar } from "@/components/household/HomeTabBar";
import { Card, Screen } from "@/components/ui/Primitives";
import {
  clearNotificationsAction,
  setNotificationPreferenceAction,
} from "@/lib/notifications/actions";
import type { Notification } from "@/lib/notifications/queries";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import type { MessageKey } from "@/lib/i18n/messages";
import type {
  NotificationPreferences,
  NotificationType,
} from "@/lib/supabase/database.types";

const MESSAGE_KEYS: Record<NotificationType, MessageKey> = {
  list_sent: "notif.listSent",
  list_viewed: "notif.listViewed",
  list_completed: "notif.listCompleted",
};

const ICONS: Record<NotificationType, string> = {
  list_sent: "🧺",
  list_viewed: "👀",
  list_completed: "✅",
};

const PREF_KEYS: Record<NotificationType, MessageKey> = {
  list_sent: "notif.prefListSent",
  list_viewed: "notif.prefListViewed",
  list_completed: "notif.prefListCompleted",
};

/**
 * The inbox.
 *
 * Everything is already marked read by the page that renders this — the
 * act of opening the screen is the acknowledgement, which is one fewer
 * thing to tap. Rows still show their type and actor so the list reads as
 * history afterwards, not just as an alert queue.
 */
export function NotificationsScreen({
  notifications,
  preferences,
  variant,
}: {
  notifications: Notification[];
  preferences: NotificationPreferences;
  /** A worker has no tab bar of their own (WorkerBar's back arrow is the
   * only way here), so that variant keeps the explicit "Back" link. An
   * owner/member already has the household tab bar's own Notifications
   * tab as "you are here" — this variant renders that bar instead,
   * rather than a redundant link back to a page also reachable by tab. */
  variant: "household" | "worker";
}) {
  const { t, locale } = useLocale();

  return (
    <Screen title={t("notif.title")}>
      {notifications.length === 0 ? (
        <Card>
          <p className="hl-heading text-ink">{t("notif.none")}</p>
          <p className="hl-caption mt-1">{t("notif.noneHint")}</p>
        </Card>
      ) : (
        <>
          <ClearNotificationsButton />
          <ul className="overflow-hidden rounded-lg border border-line bg-surface shadow-sm">
            {notifications.map((notification) => (
              <li
                key={notification.id}
                className={`flex items-start gap-3 border-b border-line px-4 py-3 last:border-b-0 ${
                  notification.read_at ? "" : "bg-primary-tint"
                }`}
              >
                <span aria-hidden className="text-2xl leading-none">
                  {ICONS[notification.type]}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="hl-body text-ink">
                    {t(MESSAGE_KEYS[notification.type], {
                      // actor_name is snapshotted on the row; a notification
                      // still reads correctly after the actor leaves.
                      name: notification.actor_name ?? t("hlists.someone"),
                    })}
                  </p>
                  <p className="hl-caption">
                    {new Date(notification.created_at).toLocaleString(locale, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                </div>
                {notification.list_id ? (
                  <Link
                    // A worker has no /home/lists/{id} route to reach — send
                    // them to their own list history instead. The household
                    // variant is the only one that can open a specific list.
                    href={
                      variant === "household"
                        ? `/home/lists/${notification.list_id}`
                        : "/worker/lists"
                    }
                    className="hl-caption shrink-0 self-center text-primary underline"
                  >
                    {t("hlists.openList")}
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      )}

      <section className="space-y-2">
        <h2 className="hl-label text-ink-muted">{t("notif.settings")}</h2>
        <Card className="flex flex-col gap-3">
          {(Object.keys(PREF_KEYS) as NotificationType[]).map((type) => (
            <PreferenceToggle
              key={type}
              type={type}
              label={t(PREF_KEYS[type])}
              // A missing key means enabled, so a type added later is not
              // silently muted for existing users.
              enabled={preferences[type] ?? true}
            />
          ))}
        </Card>
      </section>

      {variant === "worker" ? (
        <Link
          href="/worker"
          className="hl-label text-center text-primary underline"
        >
          {t("common.back")}
        </Link>
      ) : (
        // Reserves the same space a fixed HomeTabBar needs everywhere
        // else under /home — this page sits outside that layout (see the
        // prop comment above), so it has to add the padding itself.
        <div className="pb-16" aria-hidden />
      )}
      {variant === "household" ? <HomeTabBar /> : null}
    </Screen>
  );
}

/**
 * Manual "Clear all" for the notifications list. Notifications otherwise
 * only ever disappear as a side effect of their own list being archived
 * — this lets someone empty their inbox directly.
 *
 * The confirm step is plain React state, not window.confirm: that native
 * dialog turned out to be unreliable in this app's iOS shell (see
 * ListsInbox.tsx's DeletableRow, which hit the same thing for list
 * delete), so nothing here depends on it working.
 */
function ClearNotificationsButton() {
  const { t } = useLocale();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (confirming) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-3">
        <p className="hl-caption text-ink-muted">{t("notif.clearConfirm")}</p>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await clearNotificationsAction();
                setConfirming(false);
                router.refresh();
              })
            }
            className="hl-caption flex-1 rounded-lg bg-danger px-3 py-2 text-on-primary disabled:opacity-60"
          >
            {t("notif.clear")}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setConfirming(false)}
            className="hl-caption flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-ink-muted disabled:opacity-60"
          >
            {t("common.cancel")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="hl-caption self-end text-primary underline"
    >
      {t("notif.clear")}
    </button>
  );
}

function PreferenceToggle({
  type,
  label,
  enabled,
}: {
  type: NotificationType;
  label: string;
  enabled: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <label className="flex min-h-12 items-center justify-between gap-4">
      <span className="hl-body text-ink">{label}</span>
      <input
        type="checkbox"
        checked={enabled}
        disabled={pending}
        onChange={(event) => {
          const next = event.target.checked;
          startTransition(async () => {
            await setNotificationPreferenceAction(type, next);
          });
        }}
        className="size-7 shrink-0 accent-[var(--hl-primary)]"
      />
    </label>
  );
}
