"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Card, ErrorText, Screen, useErrorMessage, useRoleLabel } from "@/components/ui/Primitives";
import { removeMemberAction } from "@/lib/household/actions";
import type { HouseholdMember } from "@/lib/household/queries";
import { useLocale } from "@/lib/i18n/LocaleProvider";

export function MembersList({
  householdId,
  members,
  currentUserId,
  canRemove,
}: {
  householdId: string;
  members: HouseholdMember[];
  currentUserId: string;
  canRemove: boolean;
}) {
  const router = useRouter();
  const { t } = useLocale();
  const roleLabel = useRoleLabel();
  const errorMessage = useErrorMessage();

  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRemove(userId: string) {
    if (!window.confirm(t("members.removeConfirm"))) return;

    setRemovingId(userId);
    setError(null);

    const result = await removeMemberAction(householdId, userId);
    setRemovingId(null);

    if (!result.ok) {
      setError(errorMessage(result.code));
      return;
    }
    router.refresh();
  }

  return (
    <Screen title={t("members.title")}>
      <ErrorText>{error}</ErrorText>

      {members.length === 0 ? (
        <Card>
          <p className="hl-caption">{t("members.empty")}</p>
        </Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {members.map((member) => {
            const isSelf = member.user_id === currentUserId;
            return (
              <li key={member.user_id}>
                <Card className="flex items-center gap-3">
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="hl-heading truncate text-ink">
                      {member.display_name?.trim() || t("members.unnamed")}
                      {isSelf ? ` · ${t("members.you")}` : ""}
                    </span>
                    <span className="hl-caption">{roleLabel(member.role)}</span>
                  </div>

                  {/* The owner row has no remove control: the household
                      must always keep its owner, and the RPC rejects the
                      attempt even if this were bypassed. */}
                  {canRemove && !isSelf && member.role !== "owner" ? (
                    <button
                      type="button"
                      onClick={() => handleRemove(member.user_id)}
                      disabled={removingId === member.user_id}
                      className="hl-label shrink-0 text-danger underline underline-offset-4 disabled:opacity-60"
                    >
                      {removingId === member.user_id ? t("members.removing") : t("members.remove")}
                    </button>
                  ) : null}
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <Link href="/home" className="hl-label mt-2 text-green-700 underline underline-offset-4">
        {t("common.back")}
      </Link>
    </Screen>
  );
}
