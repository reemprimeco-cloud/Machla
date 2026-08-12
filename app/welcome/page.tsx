"use client";

import { branding } from "@/lib/branding";
import { useRouter } from "next/navigation";

import { MachlaIcon } from "@/components/brand/MachlaIcon";
import type { LocaleCode, LocaleMeta } from "@/lib/i18n/config";
import { LOCALES, pickerScriptFor } from "@/lib/i18n/config";
import { useLocale } from "@/lib/i18n/LocaleProvider";

/**
 * Language picker (master plan route map: /welcome). Design ported from
 * the HomeList UI Kit (docs/design/BRAND.md), superseding Phase 2's
 * original two-column grid — see
 * docs/architecture/15-localization-architecture.md §9 for the reasoning:
 *
 * - One column, not two: "Bahasa Indonesia" wraps to two lines in a
 *   half-width card while "Urdu" leaves a hole — the grid fights the
 *   content. Nine rows scroll in one gesture.
 * - Native name is the primary label at 20px; the romanised name is
 *   always shown too, as a small subtitle — someone looking for their
 *   language scans for their own script first.
 * - A real flag image (32x22 chip) where one language maps unambiguously
 *   to one flag; otherwise a script-glyph badge — see the flagIso doc
 *   comment in lib/i18n/config.ts for why Telugu/Sinhala/Arabic/Urdu are
 *   handled the way they are.
 * - Unlike Phase 2's original "no instruction text" call, this design
 *   keeps a short English heading/caption — a supervisor or owner is
 *   often the one handing over the phone during initial setup and needs
 *   to recognize the screen; the language rows below remain the part a
 *   non-English-reading worker relies on.
 */

function FlagBadge({ language }: { language: LocaleMeta }) {
  if (language.flagIso) {
    return (
      // Tiny static SVG flag (32x22): next/image's optimization pipeline
      // (resizing, format negotiation, LCP tracking) targets raster
      // photos and adds no benefit here, only an extra loader indirection.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/flags/${language.flagIso}.svg`}
        alt=""
        width={32}
        height={22}
        loading="lazy"
        className="rounded-[3px] object-cover ring-1 ring-black/10"
      />
    );
  }
  return (
    <span
      aria-hidden
      data-native-script={pickerScriptFor(language.code)}
      className="grid h-[22px] w-8 place-items-center rounded-[3px] bg-primary-tint text-[13px] font-semibold text-primary-press"
    >
      {language.nativeName.slice(0, 1)}
    </span>
  );
}

function CheckIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      aria-hidden
      className="shrink-0"
    >
      <path
        d="M5 12.5l4.5 4.5L19 7.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function WelcomePage() {
  const router = useRouter();
  const { locale: active, setLocale } = useLocale();

  function choose(code: LocaleCode) {
    setLocale(code);
    router.push("/");
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[var(--hl-content-max)] flex-col bg-bg">
      <header className="flex flex-col items-center gap-3 px-6 pb-6 pt-10">
        <MachlaIcon size={64} variant="tile" title={branding.name} />
        <h1 className="hl-title text-ink">Choose your language</h1>
        <p className="hl-caption text-center">
          You can change this any time in Settings.
        </p>
      </header>

      <ul className="flex flex-1 flex-col gap-2 px-4 pb-10" role="list">
        {LOCALES.map((language) => {
          const selected = language.code === active;
          return (
            <li key={language.code}>
              <button
                type="button"
                lang={language.code}
                aria-current={selected ? "true" : undefined}
                onClick={() => choose(language.code)}
                className={[
                  "flex min-h-12 w-full items-center gap-4 rounded-lg px-4 py-3 text-start",
                  "transition-colors duration-150 ease-hl",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                  selected
                    ? "bg-primary text-on-primary shadow-md"
                    : "bg-surface text-ink shadow-sm hover:bg-surface-2 active:bg-surface-2",
                ].join(" ")}
              >
                <FlagBadge language={language} />

                <span className="flex min-w-0 flex-1 flex-col">
                  <span
                    dir={language.direction}
                    data-native-script={pickerScriptFor(language.code)}
                    className="truncate text-[20px] font-semibold leading-snug"
                  >
                    {language.nativeName}
                  </span>
                  <span
                    dir="ltr"
                    className={[
                      "truncate text-[13px]",
                      selected ? "text-white/70" : "text-ink-muted",
                    ].join(" ")}
                  >
                    {language.englishName}
                  </span>
                </span>

                {selected && <CheckIcon />}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
