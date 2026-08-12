"use client";

import Link from "next/link";

import { useLocale } from "@/lib/i18n/LocaleProvider";
import type { HouseholdErrorCode } from "@/lib/household/errors";
import type { MessageKey } from "@/lib/i18n/messages";

/**
 * Small shared building blocks for the Phase 4 screens, using the UI Kit
 * tokens (docs/design/BRAND.md). Everything here is direction-agnostic
 * or uses logical properties, so it mirrors correctly in Arabic/Urdu
 * without per-component RTL handling (docs/design/UI_KIT_NOTES.md).
 */

export function Screen({
  title,
  description,
  children,
}: {
  title?: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex w-full max-w-[var(--hl-content-max)] flex-1 flex-col gap-6 px-5 py-8">
      {title ? (
        <header className="space-y-1">
          <h1 className="hl-title text-ink">{title}</h1>
          {description ? <p className="hl-caption">{description}</p> : null}
        </header>
      ) : null}
      {children}
    </main>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-lg border border-line bg-surface p-4 shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

/** The single hero action on a screen — reviews, sends, confirms. Carries
 * the brand gradient (`.hl-gradient-cta`, app/globals.css): reserved for
 * exactly one per screen by convention (Machla UI Kit), which every
 * screen already followed before this existed, since a Server Action
 * flow only ever has one thing that moves it forward. */
export function PrimaryButton({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`hl-gradient-cta hl-label min-h-12 w-full rounded-lg px-4 transition-transform duration-150 ease-hl active:scale-[0.98] disabled:opacity-60 disabled:active:scale-100 ${props.className ?? ""}`}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`hl-label min-h-12 rounded-lg border border-line bg-surface px-4 text-ink transition-colors duration-150 ease-hl disabled:opacity-60 ${props.className ?? ""}`}
    >
      {children}
    </button>
  );
}

export function TextField({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-2">
      <span className="hl-label text-ink">{label}</span>
      <input
        {...props}
        className={`hl-body min-h-12 rounded-lg border border-line bg-surface px-4 text-ink outline-none focus-visible:border-primary ${props.className ?? ""}`}
      />
    </label>
  );
}

export function ErrorText({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="hl-caption text-danger">
      {children}
    </p>
  );
}

/** A large, image-free choice card — used on /onboarding, where the two
 * paths (join vs create) must be distinguishable at a glance. */
export function ChoiceCard({
  href,
  title,
  hint,
}: {
  href: string;
  title: string;
  hint: string;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-20 flex-col justify-center gap-1 rounded-lg border border-line bg-surface px-5 py-4 shadow-sm transition-colors duration-150 ease-hl active:bg-surface-2"
    >
      <span className="hl-heading text-ink">{title}</span>
      <span className="hl-caption">{hint}</span>
    </Link>
  );
}

const ERROR_MESSAGE_KEYS: Partial<Record<HouseholdErrorCode, MessageKey>> = {
  NOT_OWNER: "errors.notOwner",
  FORBIDDEN: "errors.notOwner",
  INVALID_CODE: "errors.invalidCode",
  INVITATION_NOT_FOUND: "errors.invalidCode",
  INVITATION_NOT_PENDING: "errors.codeUsed",
  INVITATION_EXPIRED: "errors.codeExpired",
  CANNOT_REMOVE_OWNER: "errors.cannotRemoveOwner",
};

/** Maps an RPC error code to a translated, user-facing sentence. Unknown
 * and infrastructure-level codes deliberately collapse to the generic
 * message rather than surfacing database detail. */
export function useErrorMessage() {
  const { t } = useLocale();
  return (code: HouseholdErrorCode) =>
    t(ERROR_MESSAGE_KEYS[code] ?? "errors.generic");
}

/** Role label, translated. Roles come back from the database as stable
 * identifiers; only the display string is localized. */
export function useRoleLabel() {
  const { t } = useLocale();
  return (role: string) => {
    if (role === "owner") return t("roles.owner");
    if (role === "member") return t("roles.member");
    return t("roles.worker");
  };
}
