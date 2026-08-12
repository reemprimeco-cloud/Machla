"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  Card,
  ErrorText,
  PrimaryButton,
  Screen,
  SecondaryButton,
  useErrorMessage,
  useRoleLabel,
} from "@/components/ui/Primitives";
import { createInvitationAction, revokeInvitationAction } from "@/lib/household/actions";
import type { Invitation } from "@/lib/household/queries";
import { useLocale } from "@/lib/i18n/LocaleProvider";

/** Display form of a code: "K7P4M2QX" -> "K7P4-M2QX". Cosmetic only —
 * the server normalizes hyphens away on lookup
 * (docs/architecture/07-invitation-flow.md §2). */
function formatCode(code: string): string {
  return code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}

export function InvitationsManager({
  householdId,
  invitations,
}: {
  householdId: string;
  invitations: Invitation[];
}) {
  const router = useRouter();
  const { t, locale } = useLocale();
  const roleLabel = useRoleLabel();
  const errorMessage = useErrorMessage();

  const [creating, setCreating] = useState<"member" | "worker" | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function joinLink(code: string): string {
    // Built at render time so it works on whatever origin the app is
    // actually served from (local, preview, or production domain).
    if (typeof window === "undefined") return `/join/${code}`;
    return `${window.location.origin}/join/${code}`;
  }

  async function handleCreate(role: "member" | "worker") {
    setCreating(role);
    setError(null);

    const result = await createInvitationAction(householdId, role);
    setCreating(null);

    if (!result.ok) {
      setError(errorMessage(result.code));
      return;
    }
    router.refresh();
  }

  async function handleRevoke(invitationId: string) {
    setRevokingId(invitationId);
    setError(null);

    const result = await revokeInvitationAction(invitationId);
    setRevokingId(null);

    if (!result.ok) {
      setError(errorMessage(result.code));
      return;
    }
    router.refresh();
  }

  async function handleShare(invitation: Invitation) {
    const link = joinLink(invitation.code);
    const message = t("invitations.shareMessage", { link });

    // Web Share API opens WhatsApp/SMS directly where available (master
    // plan §13); clipboard is the fallback everywhere else.
    if (navigator.share) {
      try {
        await navigator.share({ text: message });
        return;
      } catch {
        // Share sheet dismissed — fall through to copying.
      }
    }

    try {
      await navigator.clipboard.writeText(message);
      setCopiedId(invitation.id);
      window.setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setError(t("errors.generic"));
    }
  }

  return (
    <Screen title={t("invitations.title")}>
      <div className="flex flex-col gap-3">
        <PrimaryButton
          type="button"
          onClick={() => handleCreate("worker")}
          disabled={creating !== null}
        >
          {creating === "worker" ? t("invitations.creating") : t("invitations.inviteWorker")}
        </PrimaryButton>
        <SecondaryButton
          type="button"
          onClick={() => handleCreate("member")}
          disabled={creating !== null}
        >
          {creating === "member" ? t("invitations.creating") : t("invitations.inviteMember")}
        </SecondaryButton>
      </div>

      <ErrorText>{error}</ErrorText>

      <h2 className="hl-heading text-ink">{t("invitations.active")}</h2>

      {invitations.length === 0 ? (
        <Card>
          <p className="hl-caption">{t("invitations.empty")}</p>
        </Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {invitations.map((invitation) => (
            <li key={invitation.id}>
              <Card className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 flex-col">
                    {/* The code is Latin/numeric regardless of UI
                        language, so it stays LTR inside RTL layouts
                        (docs/design/UI_KIT_NOTES.md). */}
                    <bdi dir="ltr" className="hl-title tracking-[0.15em] text-ink">
                      {formatCode(invitation.code)}
                    </bdi>
                    <span className="hl-caption">{roleLabel(invitation.role)}</span>
                  </div>
                  <span className="hl-caption shrink-0 text-end">
                    {t("invitations.expires", {
                      date: new Date(invitation.expires_at).toLocaleDateString(locale),
                    })}
                  </span>
                </div>

                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => handleShare(invitation)}
                    className="hl-label text-green-700 underline underline-offset-4"
                  >
                    {copiedId === invitation.id ? t("invitations.copied") : t("invitations.share")}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRevoke(invitation.id)}
                    disabled={revokingId === invitation.id}
                    className="hl-label text-danger underline underline-offset-4 disabled:opacity-60"
                  >
                    {revokingId === invitation.id
                      ? t("invitations.revoking")
                      : t("invitations.revoke")}
                  </button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Link href="/home" className="hl-label mt-2 text-green-700 underline underline-offset-4">
        {t("common.back")}
      </Link>
    </Screen>
  );
}
