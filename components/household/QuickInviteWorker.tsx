"use client";

import { useState } from "react";

import { useErrorMessage } from "@/components/ui/Primitives";
import { createInvitationAction } from "@/lib/household/actions";
import { useLocale } from "@/lib/i18n/LocaleProvider";

/**
 * One-tap "add a helper" shortcut, surfaced on the dashboard itself
 * rather than only inside Settings → Invitations
 * (components/household/InvitationsManager.tsx) — the fastest path from
 * "just created a household" to "a helper can start shopping" is the
 * point, so this skips the full invitations screen: one tap creates a
 * `worker`-role invitation and hands the join link straight to the
 * share sheet (or the clipboard, same fallback InvitationsManager
 * uses). Managing/revoking existing invitations still lives on
 * `/home/invitations`; this is only ever a shortcut to create one.
 */
export function QuickInviteWorker({ householdId }: { householdId: string }) {
  const { t } = useLocale();
  const errorMessage = useErrorMessage();

  const [status, setStatus] = useState<"idle" | "creating" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  function joinLink(code: string): string {
    if (typeof window === "undefined") return `/join/${code}`;
    return `${window.location.origin}/join/${code}`;
  }

  async function handleClick() {
    setStatus("creating");
    setError(null);

    const result = await createInvitationAction(householdId, "worker");
    if (!result.ok) {
      setStatus("idle");
      setError(errorMessage(result.code));
      return;
    }

    const message = t("invitations.shareMessage", { link: joinLink(result.value.code) });

    // Same Web Share API → clipboard fallback as handleShare in
    // InvitationsManager.tsx: opens WhatsApp/SMS directly where
    // available, copies the message everywhere else.
    if (navigator.share) {
      try {
        await navigator.share({ text: message });
        setStatus("done");
        window.setTimeout(() => setStatus("idle"), 2500);
        return;
      } catch {
        // Share sheet dismissed — fall through to copying.
      }
    }

    try {
      await navigator.clipboard.writeText(message);
      setStatus("done");
      window.setTimeout(() => setStatus("idle"), 2500);
    } catch {
      setStatus("idle");
      setError(t("errors.generic"));
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={handleClick}
        disabled={status === "creating"}
        className="flex min-h-16 items-center gap-3 rounded-lg border border-dashed border-primary bg-primary-tint px-4 text-start shadow-sm transition-transform duration-150 ease-hl active:scale-[0.98] disabled:opacity-60"
      >
        <span
          aria-hidden
          className="flex size-10 shrink-0 items-center justify-center rounded-pill bg-primary text-lg text-on-primary"
        >
          🧑‍🍳
        </span>
        <span className="min-w-0 flex-1">
          <span className="hl-label block text-ink">{t("invitations.quickInviteWorker")}</span>
          <span className="hl-caption block text-ink-muted">
            {status === "creating"
              ? t("invitations.creating")
              : status === "done"
                ? t("invitations.quickInviteDone")
                : t("invitations.quickInviteWorkerHint")}
          </span>
        </span>
      </button>
      {error ? <p className="hl-caption text-danger">{error}</p> : null}
    </div>
  );
}
