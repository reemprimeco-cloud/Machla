"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { branding } from "@/lib/branding";
import { MachlaIcon } from "@/components/brand/MachlaIcon";
import { PrimaryButton } from "@/components/ui/Primitives";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import type { MessageKey } from "@/lib/i18n/messages";
import { writeTipsSeenCookieClient } from "@/lib/onboarding/tipsCookie";

/**
 * "How it works" tutorial (master plan route map: /tips), shown once right
 * after the language is chosen and before sign-in/up — app/page.tsx's root
 * gate sends anyone without the TIPS_SEEN_COOKIE_NAME cookie here, ahead of
 * the sign-in check, since there's no user yet at this point in the flow.
 * Three steps: sign up, add a worker/family member, and how a sent list +
 * favorites work — the app's actual golden path, not marketing copy.
 */
const SLIDES: { titleKey: MessageKey; bodyKey: MessageKey }[] = [
  { titleKey: "tips.step1Title", bodyKey: "tips.step1Body" },
  { titleKey: "tips.step2Title", bodyKey: "tips.step2Body" },
  { titleKey: "tips.step3Title", bodyKey: "tips.step3Body" },
];

export default function TipsPage() {
  const router = useRouter();
  const { t } = useLocale();
  const [index, setIndex] = useState(0);
  const isLast = index === SLIDES.length - 1;

  function finish() {
    writeTipsSeenCookieClient();
    // Re-enters the root gate rather than a fixed destination — it decides
    // /login vs /onboarding vs /home/worker from the real session state.
    router.push("/");
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[var(--hl-content-max)] flex-col bg-bg px-6 py-8">
      <button
        type="button"
        onClick={finish}
        className="hl-label self-end text-primary underline underline-offset-4"
      >
        {t("tips.skip")}
      </button>

      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <MachlaIcon size={56} variant="flat" title={branding.name} />
        <span className="hl-ltr-num hl-label rounded-pill bg-primary-tint px-3 py-1 text-primary">
          {index + 1} / {SLIDES.length}
        </span>
        <h1 className="text-[24px] font-bold leading-snug text-ink">
          {t(SLIDES[index].titleKey)}
        </h1>
        <p className="hl-body text-ink-muted">{t(SLIDES[index].bodyKey)}</p>
      </div>

      <div className="flex items-center justify-center gap-2 pb-6" aria-hidden>
        {SLIDES.map((_, slideIndex) => (
          <span
            key={slideIndex}
            className={`h-2 rounded-pill transition-all duration-150 ease-hl ${
              slideIndex === index ? "w-6 bg-primary" : "w-2 bg-line"
            }`}
          />
        ))}
      </div>

      <PrimaryButton
        type="button"
        onClick={() => (isLast ? finish() : setIndex((current) => current + 1))}
      >
        {isLast ? t("tips.start") : t("tips.next")}
      </PrimaryButton>
    </div>
  );
}
