"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  ErrorText,
  PrimaryButton,
  Screen,
  TextField,
  useErrorMessage,
} from "@/components/ui/Primitives";
import { createHouseholdAction } from "@/lib/household/actions";
import { useLocale } from "@/lib/i18n/LocaleProvider";

/**
 * Creating a household makes the caller its owner — the only way an
 * `owner` membership row is ever produced
 * (docs/architecture/05-household-model.md §3).
 *
 * "Your name" is collected here rather than as a separate onboarding
 * step: the roster and (from Phase 7) every shopping list identify people
 * by display name, and adding one field to a form the user is already
 * filling in beats an extra screen for a low-literacy audience.
 */
export function CreateHouseholdForm({ defaultDisplayName }: { defaultDisplayName: string }) {
  const router = useRouter();
  const { t } = useLocale();
  const errorMessage = useErrorMessage();

  const [householdName, setHouseholdName] = useState("");
  const [displayName, setDisplayName] = useState(defaultDisplayName);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!householdName.trim()) {
      setError(t("household.nameRequired"));
      return;
    }

    setSubmitting(true);
    setError(null);

    const result = await createHouseholdAction(householdName, displayName);

    if (!result.ok) {
      setSubmitting(false);
      setError(errorMessage(result.code));
      return;
    }

    router.push("/home");
    router.refresh();
  }

  return (
    <Screen title={t("household.createTitle")}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <TextField
          label={t("household.nameLabel")}
          value={householdName}
          onChange={(event) => setHouseholdName(event.target.value)}
          maxLength={80}
          autoFocus
        />
        <TextField
          label={t("household.yourNameLabel")}
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          maxLength={80}
          autoComplete="name"
        />

        <ErrorText>{error}</ErrorText>

        <PrimaryButton type="submit" disabled={submitting}>
          {submitting ? t("household.creating") : t("household.create")}
        </PrimaryButton>
      </form>
    </Screen>
  );
}
