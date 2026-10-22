"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { branding } from "@/lib/branding";
import { MachlaIcon } from "@/components/brand/MachlaIcon";
import { PrimaryButton } from "@/components/ui/Primitives";
import { safeNextPath } from "@/lib/auth/nextPath";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import type { MessageKey } from "@/lib/i18n/messages";
import { writeTipsSeenCookieClient } from "@/lib/onboarding/tipsCookie";

/**
 * "How it works" tutorial (master plan route map: /tips), shown once right
 * after the language is chosen and before sign-in/up — app/page.tsx's root
 * gate sends anyone without the TIPS_SEEN_COOKIE_NAME cookie here, ahead of
 * the sign-in check, since there's no user yet at this point in the flow.
 * app/welcome/page.tsx routes here too when the deep-link join flow
 * (app/join/[code]/page.tsx) needs the tutorial before it's been seen.
 *
 * Slides 1-2 branch on whether a `next=` destination is itself a
 * /join/<code> path — someone arriving with an invitation already in
 * hand is joining an existing household, not setting one up, so "add a
 * worker" copy written for the household owner would be describing a
 * third person to the exact person it's talking about (2026-10-21
 * critique). Slide 3 (favorites) is genuinely the same for both.
 */
const OWNER_SLIDES: { titleKey: MessageKey; bodyKey: MessageKey }[] = [
  { titleKey: "tips.step1Title", bodyKey: "tips.step1Body" },
  { titleKey: "tips.step2Title", bodyKey: "tips.step2Body" },
  { titleKey: "tips.step3Title", bodyKey: "tips.step3Body" },
];

const JOINING_SLIDES: { titleKey: MessageKey; bodyKey: MessageKey }[] = [
  { titleKey: "tips.joinStep1Title", bodyKey: "tips.joinStep1Body" },
  { titleKey: "tips.joinStep2Title", bodyKey: "tips.joinStep2Body" },
  { titleKey: "tips.step3Title", bodyKey: "tips.step3Body" },
];

function TipsForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useLocale();
  const [index, setIndex] = useState(0);

  const nextPath = safeNextPath(searchParams.get("next"));
  const slides = nextPath.startsWith("/join/") ? JOINING_SLIDES : OWNER_SLIDES;
  const isLast = index === slides.length - 1;

  function finish() {
    writeTipsSeenCookieClient();
    router.push(nextPath);
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
          {index + 1} / {slides.length}
        </span>
        {/* Keyed on index so each replays the same fade/slide timing as
            the pagination dot below, instead of jump-cutting against it
            (2026-10-22 critique). Two separate keyed elements, not a
            wrapping div, so the original gap-6 rhythm between them and
            the badge above is unchanged. */}
        <h1 key={`title-${index}`} className="hl-fade-slide-in text-[24px] font-bold leading-snug text-ink">
          {t(slides[index].titleKey)}
        </h1>
        <p key={`body-${index}`} className="hl-fade-slide-in hl-body text-ink-muted">
          {t(slides[index].bodyKey)}
        </p>
      </div>

      <div className="flex items-center justify-center gap-2 pb-6" aria-hidden>
        {slides.map((_, slideIndex) => (
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

// useSearchParams requires a Suspense boundary in the App Router.
export default function TipsPage() {
  return (
    <Suspense fallback={null}>
      <TipsForm />
    </Suspense>
  );
}
