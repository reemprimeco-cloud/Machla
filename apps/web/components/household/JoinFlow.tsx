"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  Card,
  ErrorText,
  PrimaryButton,
  Screen,
  SecondaryButton,
  TextField,
  useErrorMessage,
  useRoleLabel,
} from "@/components/ui/Primitives";
import { acceptInvitationAction, previewInvitationAction } from "@/lib/household/actions";
import { useLocale } from "@/lib/i18n/LocaleProvider";

interface Preview {
  householdName: string;
  role: "member" | "worker";
}

/**
 * Invitation redemption. Two entry points converge here: a shared deep
 * link (/join/<code>, which arrives with initialCode set) and manual
 * entry (/join). Both run the same two-step preview-then-confirm flow the
 * master plan specifies (§12) — the invitee sees which home and which
 * role before anything is committed
 * (docs/architecture/07-invitation-flow.md §4).
 */
export function JoinFlow({
  initialCode = "",
  defaultDisplayName = "",
}: {
  initialCode?: string;
  defaultDisplayName?: string;
}) {
  const router = useRouter();
  const { t } = useLocale();
  const errorMessage = useErrorMessage();
  const roleLabel = useRoleLabel();

  const [code, setCode] = useState(initialCode);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [displayName, setDisplayName] = useState(defaultDisplayName);
  const [status, setStatus] = useState<"idle" | "checking" | "joining">("idle");
  const [error, setError] = useState<string | null>(null);

  const lookup = useCallback(
    async (rawCode: string) => {
      setStatus("checking");
      setError(null);

      const result = await previewInvitationAction(rawCode);
      setStatus("idle");

      if (!result.ok) {
        setError(errorMessage(result.code));
        return;
      }
      // A null value means the code is invalid, expired, revoked, or
      // already used — the RPC deliberately doesn't say which.
      if (!result.value) {
        setError(t("errors.invalidCode"));
        return;
      }

      setPreview(result.value);
    },
    [errorMessage, t],
  );

  // A code that arrived via deep link is checked once, automatically, so
  // the invitee lands straight on the confirmation.
  const autoChecked = useRef(false);
  useEffect(() => {
    if (autoChecked.current || !initialCode) return;
    autoChecked.current = true;
    void lookup(initialCode);
  }, [initialCode, lookup]);

  async function handleLookup(event: React.FormEvent) {
    event.preventDefault();
    if (!code.trim()) return;
    await lookup(code);
  }

  async function handleConfirm() {
    setStatus("joining");
    setError(null);

    const result = await acceptInvitationAction(code, displayName);

    if (!result.ok) {
      setStatus("idle");
      setError(errorMessage(result.code));
      // The invitation may have been revoked or used between preview and
      // confirm — drop back to code entry rather than leaving a stale
      // confirmation on screen.
      setPreview(null);
      return;
    }

    router.push("/");
    router.refresh();
  }

  if (preview) {
    return (
      <Screen title={t("join.confirmTitle")}>
        <Card>
          <p className="hl-heading text-ink">{preview.householdName}</p>
          <p className="hl-caption mt-1">
            {t("join.roleLabel")}: {roleLabel(preview.role)}
          </p>
        </Card>

        <TextField
          label={t("join.yourNameLabel")}
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          maxLength={80}
          autoComplete="name"
        />

        <ErrorText>{error}</ErrorText>

        <div className="flex flex-col gap-3">
          <PrimaryButton type="button" onClick={handleConfirm} disabled={status === "joining"}>
            {status === "joining" ? t("join.joining") : t("join.confirm")}
          </PrimaryButton>
          <SecondaryButton
            type="button"
            onClick={() => {
              setPreview(null);
              setError(null);
            }}
            disabled={status === "joining"}
          >
            {t("common.back")}
          </SecondaryButton>
        </div>
      </Screen>
    );
  }

  return (
    <Screen title={t("join.title")} description={t("join.codeHint")}>
      <form onSubmit={handleLookup} className="flex flex-col gap-4">
        <TextField
          label={t("join.codeLabel")}
          value={code}
          onChange={(event) => setCode(event.target.value)}
          // Codes are Crockford base32 and the server normalizes case,
          // hyphens, and O/0 I/1 confusion — so the field stays forgiving
          // rather than rejecting what the user typed.
          dir="ltr"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          maxLength={12}
          className="text-center tracking-[0.25em]"
          autoFocus
        />

        <ErrorText>{error}</ErrorText>

        <PrimaryButton type="submit" disabled={status === "checking" || !code.trim()}>
          {status === "checking" ? t("join.checking") : t("join.continue")}
        </PrimaryButton>
      </form>
    </Screen>
  );
}
