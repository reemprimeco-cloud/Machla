"use client";

import Link from "next/link";
import { useState } from "react";

import { CheckCircleIcon } from "@/components/ui/Icons";
import { Card, ErrorText, PrimaryButton, Screen } from "@/components/ui/Primitives";
import { submitFeedbackAction, type FeedbackErrorCode } from "@/lib/feedback/actions";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import type { MessageKey } from "@/lib/i18n/messages";

const ERROR_KEYS: Record<FeedbackErrorCode, MessageKey> = {
  NOT_CONFIGURED: "errors.generic",
  EMPTY: "feedback.empty",
  TOO_LONG: "feedback.tooLong",
  UNKNOWN: "errors.generic",
};

/**
 * Reached from both experiences (app/feedback/page.tsx — no household or
 * worker role required, only a signed-in session, same as
 * NotificationsScreen), so this component takes no household-specific
 * props: submitFeedbackAction reads auth.uid() itself
 * (20260923120000_admin_country_and_feedback.sql).
 *
 * One box, one button — not a structured form (rating, category, …).
 * The admin reads every submission directly (admin_list_feedback), so
 * there is nowhere a category would even route to yet; adding one now
 * would be a control with no destination.
 */
export function FeedbackScreen({ backHref }: { backHref: string }) {
  const { t } = useLocale();
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setStatus("sending");
    setError(null);

    const result = await submitFeedbackAction(message);
    if (!result.ok) {
      setStatus("error");
      setError(t(ERROR_KEYS[result.code]));
      return;
    }

    setStatus("sent");
    setMessage("");
  }

  return (
    <Screen title={t("feedback.title")} description={t("feedback.hint")}>
      {status === "sent" ? (
        <Card className="text-center">
          <p aria-hidden className="flex justify-center text-success">
            <CheckCircleIcon className="size-10" />
          </p>
          <p className="hl-heading mt-3 text-ink">{t("feedback.thanks")}</p>
          <button
            type="button"
            onClick={() => setStatus("idle")}
            className="hl-caption mt-3 text-primary underline underline-offset-4"
          >
            {t("feedback.sendAnother")}
          </button>
        </Card>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder={t("feedback.placeholder")}
            rows={6}
            maxLength={4000}
            className="hl-body w-full rounded-lg border border-line bg-surface px-4 py-3 text-ink outline-none focus-visible:border-primary"
            aria-invalid={status === "error"}
          />
          <ErrorText>{error}</ErrorText>
          <PrimaryButton type="submit" disabled={status === "sending" || !message.trim()}>
            {status === "sending" ? t("feedback.sending") : t("feedback.submit")}
          </PrimaryButton>
        </form>
      )}

      <Link href={backHref} className="hl-label text-center text-primary underline">
        {t("common.back")}
      </Link>
    </Screen>
  );
}
