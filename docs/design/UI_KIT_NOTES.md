# HomeList UI Kit — integration notes

The HomeList UI Kit (a standalone design package: brand mark, colour/type
tokens, flags, icon ladder, and reference React components) was supplied
during Phase 2 and integrated into `apps/web`. This file records where
each piece landed and the rules that came with it. `docs/design/BRAND.md`
is the original brand sheet (mark, colour, clear space, print CMYK) —
copied verbatim, unchanged. The kit's own `README.md`/`tailwind.config.ts`
were written for a Vite + Tailwind v3 scaffold and are not reproduced
here; this file is their Next.js/Tailwind v4 equivalent.

## Where things landed

| Kit item | HomeList location |
|---|---|
| `public/flags/*.svg` | `apps/web/public/flags/*.svg` (unchanged) |
| `public/icons/icon-*.png` | `apps/web/public/icons/icon-*.png` (unchanged) |
| `public/favicon.svg` | `apps/web/app/icon.svg` (Next's auto-favicon convention) |
| `icon-180.png` | `apps/web/app/apple-icon.png` (Next's auto apple-touch-icon convention) |
| `src/styles/tokens.css` | merged into `apps/web/app/globals.css` `:root` + `@theme inline` |
| `src/styles/fonts.css` (script stacks, type scale) | merged into `apps/web/app/globals.css` |
| `src/styles/base.css` | merged into `apps/web/app/globals.css` `@layer base`/`@layer utilities` |
| `src/i18n/languages.ts` | merged into `apps/web/lib/i18n/config.ts` (`Script`, `flagIso` fields on `LocaleMeta`) |
| `src/hooks/useLocale.ts` | **not used as-is** — see "What changed" below |
| `src/brand/HomeListIcon.tsx` | `apps/web/components/brand/HomeListIcon.tsx` (unchanged) |
| `src/components/LanguagePicker.tsx` | `apps/web/app/welcome/page.tsx` (adapted, see below) |

## What changed, and why

**Persistence stayed cookie-based, not the kit's `localStorage`.** The
kit's `useLocale.ts` reads/writes `localStorage` only. HomeList's own
`LocaleProvider` (`lib/i18n/LocaleProvider.tsx`, Phase 2) instead uses a
cookie readable by both the server and the client, specifically so the
root layout can render the correct `<html lang dir data-script>` on the
very first response — see `15-localization-architecture.md` §2. Swapping
to `localStorage` would reintroduce the RTL/LTR flash that decision was
made to avoid. The kit's font-loading and `data-script`/`data-native-script`
attribute strategy was kept; only the storage mechanism differs.

**Fonts are fully self-hosted via `next/font`, not the kit's runtime
Google Fonts `<link>` injection.** The kit's three-tier strategy
(tier 1 always, tier 2 lazy per locale via a runtime-injected
`<link rel="stylesheet">`, tier 3 minimal glyph subsets for the picker)
is a great fit for a plain Vite app with no build-time font pipeline.
Next.js has one (`next/font/google`), so all six font families are
self-hosted at build time instead — no runtime request to Google's CDN
at all. Tier 2 laziness is preserved by setting `preload: false` on the
four non-chrome fonts (Devanagari, Telugu, Sinhala, Nastaliq): the
browser only fetches a non-preloaded font's bytes once matching text
actually needs to paint, which is the same practical effect as the kit's
lazy `<link>` injection. The one thing **not** replicated is tier 3's
per-glyph subsetting (Google's `&text=` parameter, ~14KB for the picker's
three non-Arabic non-Latin previews) — `next/font` only supports
predefined Unicode-range subsets, not custom glyph lists, so the picker's
Devanagari/Telugu/Sinhala rows use the same full subset as tier 2. This
is a deliberate simplification (one font-loading mechanism instead of
two) accepted for a modest download-size cost, not an oversight.

**The language picker keeps our routing, not the kit's `onDone` callback.**
The kit's `LanguagePicker` takes an `onDone?: () => void` prop and leaves
navigation to the caller. HomeList's `/welcome` calls `setLocale()` then
`router.push("/")` directly, matching how the rest of the app already
routes (see `08-route-map.md`).

## Rules to keep following as new screens get built (from the kit's README/BRAND.md)

- **Logical properties only.** `ms-4` not `ml-4`, `text-start` not
  `text-left`. Tailwind v4 ships these natively; they resolve against
  `<html dir>`, which `LocaleProvider` already sets.
- **Numbers stay LTR inside RTL text.** Wrap KWD amounts, phone numbers,
  and times in `<bdi>` or `dir="ltr"` — use the `.hl-ltr-num` utility
  (`app/globals.css`) or `dir="ltr"` directly. KWD is 3 decimals:
  `12.500 KWD`; phone is `+965 XXXX XXXX`.
- **Directional icons flip in RTL, semantic icons never do.** Chevrons,
  back arrows, progress indicators: wrap in `.hl-flip-rtl`. Home, check,
  trash, avatar icons: never flip.
- **Nastaliq needs `min-height`, never `height`.** Urdu's descenders clip
  in fixed-height elements. `globals.css` already sets
  `--hl-lh-ui: 2.15` when `html[data-script="nastaliq"]`; don't override
  it with a Tailwind `leading-*` class on an element that can hold Urdu.
- **Copy rules:** sentence case, active voice, no filler. A button says
  what happens ("Save changes", not "Submit"). The same action keeps its
  name through a flow. Errors say what broke and how to fix it — no
  apology, never vague. Every English string needs a natural (not
  machine-translated) counterpart in each supported language before a
  screen is considered done.
- **Icon minimums:** the mark alone is legible at 24px on screen / 12mm
  in print; the `tile` variant's bevel turns to mud below 64px — use
  `flat` there. Clear space around the mark = half its corner radius.
