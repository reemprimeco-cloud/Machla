"use client";

import Link from "next/link";

import { Card, PrimaryButton, Screen } from "@/components/ui/Primitives";
import { useLocale } from "@/lib/i18n/LocaleProvider";

/**
 * The four states every screen can be in besides "loaded with content":
 * loading, error, not-found, and offline.
 *
 * All four are icon-led with one short sentence, for the same reason the
 * product grid is: the person reading them may have limited literacy in
 * all nine languages on offer. A wall of apologetic prose is worse than a
 * big glyph and a button.
 */

/** Grey blocks in the shape of the content that is coming, rather than a
 * spinner: the page does not appear to jump when it resolves, and a
 * shifting layout is the thing that makes a slow connection feel broken. */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-surface-2 ${className}`}
      // Decorative — the live region is on the Screen below, so a screen
      // reader hears "Loading" once rather than once per block.
      aria-hidden
    />
  );
}

export function LoadingScreen({ tiles = 6 }: { tiles?: number }) {
  const { t } = useLocale();

  return (
    <Screen>
      <span className="sr-only" role="status">
        {t("state.loading")}
      </span>
      <Skeleton className="h-12 w-full" />
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: tiles }, (_, index) => (
          <Skeleton key={index} className="h-40" />
        ))}
      </div>
    </Screen>
  );
}

export function LoadingRows({ rows = 5 }: { rows?: number }) {
  const { t } = useLocale();

  return (
    <Screen>
      <span className="sr-only" role="status">
        {t("state.loading")}
      </span>
      <Skeleton className="h-8 w-40" />
      <div className="flex flex-col gap-2">
        {Array.from({ length: rows }, (_, index) => (
          <Skeleton key={index} className="h-16" />
        ))}
      </div>
    </Screen>
  );
}

/** Shared shell for the three "something is wrong" screens. */
export function MessageScreen({
  glyph,
  title,
  hint,
  action,
}: {
  glyph: string;
  title: string;
  hint: string;
  action?: React.ReactNode;
}) {
  return (
    <Screen>
      <Card className="text-center">
        <p aria-hidden className="text-6xl leading-none">
          {glyph}
        </p>
        <h1 className="hl-title mt-4 text-ink">{title}</h1>
        <p className="hl-body mt-2 text-ink-muted">{hint}</p>
      </Card>
      {action}
    </Screen>
  );
}

export function ErrorScreen({ retry }: { retry?: () => void }) {
  const { t } = useLocale();

  return (
    <MessageScreen
      glyph="⚠️"
      title={t("state.errorTitle")}
      hint={t("state.errorHint")}
      action={
        retry ? (
          <PrimaryButton onClick={retry}>{t("state.retry")}</PrimaryButton>
        ) : (
          <HomeLink />
        )
      }
    />
  );
}

export function HomeLink() {
  const { t } = useLocale();

  return (
    <Link
      href="/"
      className="hl-label min-h-12 content-center rounded-lg bg-primary px-4 text-center text-on-primary shadow-sm"
    >
      {t("state.goHome")}
    </Link>
  );
}
