# 15 — Localization Architecture (Phase 2)

Phase 1 (`09-folder-structure.md`) established the locale-file
infrastructure. Phase 2 implements the actual language-selection UI,
persistence, and dynamic RTL/LTR document direction on top of it — this
document records those decisions.

## 1. Components

```text
lib/i18n/
  config.ts           LocaleCode, LocaleMeta (native/English name, dir,
                       optional flag), LOCALES, DEFAULT_LOCALE,
                       HOUSEHOLD_DISPLAY_LOCALES  [Phase 1]
  messages.ts          getMessages(locale), getMessage(messages, key),
                        typed MessageKey dot-path, per-key fallback merge
                        over English                              [Phase 2]
  cookie.ts             LOCALE_COOKIE_NAME + read/write helpers    [Phase 2]
  LocaleProvider.tsx     React context: locale, direction, messages,
                         setLocale(), t()                          [Phase 2]

locales/*.json           9 UI-string files, one per supported language

app/layout.tsx            reads the cookie server-side, renders the
                           correct <html lang dir> on first paint, wraps
                           children in <LocaleProvider>              [Phase 2]
app/welcome/page.tsx       language-selection screen                 [Phase 2]
components/HomeShell.tsx   first localized consumer (useLocale())     [Phase 2]
scripts/check-locales.mjs  asserts key parity across all locale files [Phase 2]
```

## 2. Persistence: a cookie, not localStorage

**Decision:** the selected locale is stored in a plain (non-httpOnly)
cookie, `homelist_locale`, 1-year expiry, `path=/`, `SameSite=Lax`.

**Why not localStorage:** localStorage is client-only. A server component
(the root layout) needs to know the locale *before* the first byte is
sent, so it can render `<html lang dir>` correctly on the very first
response. If persistence were localStorage-only, the server would always
render a default (`en`/`ltr`) shell, and the client would then flip
`dir` after hydration — a visible RTL/LTR flash for every Arabic/Urdu user
on every load, and a real risk of hydration mismatch if any server-only
markup depended on direction. A cookie is readable in both places (Next's
`cookies()` on the server, `document.cookie` on the client), so both
renders start from the same value.

**Why not a signed/httpOnly cookie:** the value isn't sensitive — it's a
UI preference, not an auth token — and the client needs to *write* it
directly (via `document.cookie`) the instant a user taps a language card,
without a network round-trip.

**Forward compatibility (explicitly designed for, not built now):** once
Phase 3 auth exists, `users.preferred_language` (see
`03-database-schema.md`) becomes the authoritative value for a signed-in
user. The plan is: on login, if `users.preferred_language` is set, it
overwrites the cookie; on `setLocale()` after login, the same call that
writes the cookie also writes `users.preferred_language` (a simple
`UPDATE ... WHERE id = auth.uid()`, already covered by the `users_update_own`
RLS policy from the Phase 1 migration — no new policy needed). The cookie
remains the single client-side source of truth in both the pre-auth and
post-auth cases; Phase 3 only adds a sync step, not a second store.

## 3. Why a cookie key/value and not `NEXT_LOCALE`

Next.js's built-in i18n routing convention uses a `NEXT_LOCALE` cookie
tied to URL-prefixed locales (`/en/...`, `/ar/...`). HomeList deliberately
does **not** use URL-based locale routing (`08-route-map.md` §1) — a
custom cookie name (`homelist_locale`) avoids implying a connection to
that unused Next.js feature and avoids any accidental interaction with
framework-level locale-routing behavior HomeList isn't opting into.

## 4. Fallback behavior

Two layers, per master plan Section 4 ("translation fallback logic"):

1. **Unsupported/garbage locale code** (e.g. a stale or hand-edited
   cookie value): `getMessages()` and `directionFor()` both fall back to
   `DEFAULT_LOCALE` (`en`) entirely, via `isSupportedLocale()`.
2. **Missing individual key** in a real locale file (e.g. a key added to
   `en.json` but not yet translated everywhere): `getMessages()`
   deep-merges every non-English locale object over the English object at
   module-load time, so any absent key silently resolves to its English
   value rather than rendering blank/`undefined` or throwing. This is a
   defense-in-depth safety net — `scripts/check-locales.mjs` (see §6) is
   what actually keeps the files in parity in normal operation, so this
   fallback should rarely trigger in practice.

## 5. RTL/LTR implementation

- `LocaleMeta.direction` (`ltr | rtl`) is the single source of truth;
  Arabic and Urdu are `rtl`, the other 7 are `ltr` (master plan Section 4,
  requirements 6–8).
- **Initial paint:** `app/layout.tsx` is a Server Component. It reads the
  `homelist_locale` cookie via `next/headers` `cookies()` and renders
  `<html lang={locale} dir={directionFor(locale)}>` directly — the
  direction is correct in the very first HTML sent to the browser, before
  any JavaScript runs.
- **Dynamic change:** `LocaleProvider` (Client Component) holds `locale`
  in React state, seeded from the same server-computed value via an
  `initialLocale` prop — so client hydration matches the server output
  exactly (no mismatch). When `setLocale()` is called (from the `/welcome`
  screen), it updates React state *and* imperatively sets
  `document.documentElement.lang`/`.dir` in a `useEffect`. Mutating the
  live `<html>` element's attributes after hydration is a normal DOM
  operation, not a React-tree change, so it does not produce a hydration
  warning — hydration errors only occur when the *initial* client render
  disagrees with server-rendered HTML, and this mutation happens strictly
  after that initial reconciliation, in response to a user action.
- **Per-element script correctness independent of page direction:** each
  language card on `/welcome` sets its own `dir`/`lang` attributes
  (`locale.direction`, `locale.code`) regardless of the page's current
  overall direction, so e.g. the Arabic and Urdu card labels always shape
  and align correctly even while the picker page itself is still `ltr`
  (first visit, no locale chosen yet).
- **Icons/mirroring:** nothing in the Phase 2 UI has directional icons
  (chevrons, back arrows) that would need `[dir=rtl]`-aware mirroring —
  layouts used so far (centered stacks, a symmetric card grid) are
  direction-agnostic by construction. This becomes a real concern from
  Phase 6/7 onward (list rows, nav chrome with leading icons) — flagged
  here so it isn't missed later, not solved now since there's no such UI
  yet.

## 6. Locale key parity

`scripts/check-locales.mjs` (`npm run check:locales`) flattens
every `locales/*.json` file to its full set of dot-path keys and asserts
every non-English file has exactly the same key set as `en.json` — no
missing keys, no stray/typo'd keys. Plain Node, zero dependencies,
intended to be run before every build (and wired into CI once CI exists).
This is what keeps the runtime fallback in §4 a safety net rather than the
normal path.

## 7. Language-selection screen design (revised — see §9)

Original Phase 2 version of this section said `/welcome` should carry
**no instruction text**, reasoning that before a locale is picked there's
no single correct language to render it in. The HomeList UI Kit
(§9) revised this: the screen now keeps a short English heading
("Choose your language") and caption ("You can change this any time in
Settings."), because in practice a supervisor or household owner is often
the one handing the phone to a worker during initial setup and benefits
from recognizing the screen — while the language rows themselves remain
what a non-English-reading worker actually relies on. Documenting the
reversal here rather than silently editing history, per the "document
every major architectural decision" rule.

Current design (`app/welcome/page.tsx`), each row:

- shows the language's own **native name as the primary, 20px label**;
- **always** shows the English name too, as a small (13px) LTR subtitle
  below it — the kit's picker doesn't conditionally hide it even when the
  strings are identical (e.g. Filipino/Filipino), for a consistent
  two-line row height across all nine;
- shows a **real flag SVG** (`public/flags/<iso>.svg`, 32x22) where one
  language maps unambiguously to one flag, or a script-glyph badge
  otherwise — see the `flagIso` doc comment in `lib/i18n/config.ts` for
  the per-language reasoning (notably Arabic uses Kuwait's flag, not
  Saudi Arabia's, and Telugu/Sinhala show a script glyph rather than
  India's/Sri Lanka's flag);
- is a single full-width row (not a 2-column grid — "Bahasa Indonesia"
  wrapped awkwardly in a half-width card while "Urdu" left a hole), each
  a large tap target (`min-h-12`, 48px), with a selected/active state
  (green fill + checkmark) so revisiting `/welcome` to change language
  shows the current choice.

## 8. Compatibility with future Worker/Household native apps

Every piece here is either framework-agnostic data (the `locales/*.json`
files, `LOCALES`/`getMessages`/`getMessage` in `lib/i18n`) or a thin
Next.js-specific binding (`LocaleProvider`'s cookie read via
`next/headers`, the `<html>` attribute mutation). Per
`12-future-apps-architecture.md` §2, when `packages/i18n` is extracted at
Phase 12, the `locales/*.json` + `lib/i18n/{config,messages}.ts` files
move essentially unchanged; a native client would replace
`LocaleProvider`'s cookie/DOM binding with the React Native equivalent
(e.g. `expo-localization` + `AsyncStorage` and `I18nManager.forceRTL()`)
while reusing the exact same message files and lookup logic. Nothing in
`config.ts`/`messages.ts` references the DOM, cookies, or Next.js APIs.

## 9. HomeList UI Kit integration

A standalone design package (brand mark, colour/type tokens, real flag
SVGs, a full icon ladder, and reference components) was supplied and
integrated on top of the architecture in §1-8. Full mapping of what
moved where, and exactly what was adapted vs. kept as-is, is in
`docs/design/UI_KIT_NOTES.md`; `docs/design/BRAND.md` is the source brand
sheet. Summary of what changed in this document's terms:

- **Persistence (§2) is unchanged** — still the cookie, not the kit's
  `localStorage`-only approach, specifically to keep the no-flash SSR
  property described in §2 and §5.
- **Fonts**: Poppins (Latin) + IBM Plex Sans Arabic (Arabic) are now the
  UI chrome typefaces (replacing the interim Geist choice from Phase 2's
  first pass), both self-hosted via `next/font` and always loaded. Urdu
  (Nastaliq), Hindi/Nepali (Devanagari), Telugu, and Sinhala are also
  self-hosted via `next/font` but with `preload: false`, so the browser
  only fetches that font's bytes once matching text actually renders —
  in practice on first visiting `/welcome` (which shows all nine native
  names at once) or on switching to that locale. All six are wired in
  `app/layout.tsx`; `app/globals.css` maps each to a `--font-<script>`
  custom property with a system-font fallback chain, and a `data-script`
  attribute on `<html>` (server-rendered from the locale cookie, updated
  by `LocaleProvider` on change, same mechanism as `dir`/`lang`) selects
  which one is the active `--font-ui` for page chrome. A separate
  `data-native-script` attribute, set per-row in the language picker, is
  what makes each language's own name always render in its own script's
  font regardless of the page's currently active one.
- **Design tokens** (`--hl-*` custom properties: the Machla brand ramp and
  interactive palette, radii, shadows, spacing, a dark-mode block, a
  reduced-motion block — `docs/design/BRAND.md`) live in `app/globals.css`
  `:root`, mapped into Tailwind v4 utilities (`bg-primary`,
  `text-ink-muted`, `rounded-lg`, `shadow-md`, etc.) via `@theme inline`.
  Font-family tokens are
  deliberately **not** re-exposed as `@theme` entries — see the comment
  in `globals.css`: giving a `@theme` token the same name as the `:root`
  custom property it reads would risk an invalid self-referential
  declaration if that block ever won the CSS cascade, and no component
  actually needs a `font-*` Tailwind utility class (fonts are applied via
  the `data-script`/`data-native-script` attribute selectors, or inline
  style in `HomeListLockup`).
- **Brand mark**: `components/brand/HomeListIcon.tsx` (flat/tile variants
  + a bilingual `HomeListLockup`) replaces the ad hoc "H" square used in
  Phase 2's first pass, in `HomeShell` and `/welcome`.
- **Icons**: the full `public/icons/icon-{16…1024}.png` ladder and
  `app/icon.svg`/`app/apple-icon.png` (Next's automatic favicon
  convention) replace the single placeholder SVG from Phase 1;
  `app/manifest.ts` now points at `icon-192.png`/`icon-512.png`.
- **§7 above** records the language-picker redesign and the reversed
  "no instruction text" decision.

---

## 10. Phase 9 — the RTL + 9-language surface, measured

Risk item 14 called the testing surface here large: nine languages, two of
them RTL, on small screens. Phase 9 measured it rather than reasoning about
it.

A Playwright pass covered **3 viewports × 9 locales × 5 routes = 135 page
checks**, at 320px (smallest Android in common use), 375px (iPhone SE) and
412px, asserting on each:

- no element overflows the viewport, on **either** edge — in RTL an
  over-wide element overflows to the *left*, so checking only the right
  edge would miss exactly the case this project is most exposed to;
- `<html dir>` matches the locale (`rtl` for ar/ur, `ltr` otherwise) and
  `<html lang>` matches;
- no interactive target is under 44px tall or 24px wide.

Result: no problems. The routes behind authentication cannot be reached in
this environment (phone auth is not yet configured), so the product grid,
category grid and worker bar were audited through a temporary preview route
rendering them with deliberately hostile fixtures — the longest real
product names in all nine languages, a 999 quantity, a very long household
name, and a two-digit unread badge. That route was removed afterwards; it
is not in the repository.

**The audit itself was negative-controlled, and needed it.** The first
version measured overflow with `documentElement.scrollWidth -
clientWidth`, which never moves in this layout — it reported "no problems"
while being structurally incapable of detecting any. Injecting a 900px
element and a 20px button proved it blind. The working version measures
each element's own bounding box and skips those inside a scrollable
ancestor. A layout check that has never been shown to fail is not evidence.

## 11. Expansion to 12 languages, and the Machla rename (2026-08-12)

Owner-approved, same day: three languages added (Amharic, French, Fon),
and the product renamed HomeList → Machla, source in a new UI kit
("Machla UI Kit 2") that also supplied fresh flag SVGs for the added
locales and set the design vocabulary (`LANGUAGES`, `useLocale`,
`MachlaIcon`) this codebase's equivalents are now aligned to in spirit,
though not renamed 1:1 — see the note in `lib/branding.ts` on why the
`--hl-*` CSS custom property prefix was kept rather than swapped to the
kit's `--mc-*`: the values are byte-identical, and renaming every
`className` in the app would have been pure churn for zero visible change.

**Fon required a new script category.** Existing locales cover latin,
arabic, nastaliq, devanagari, telugu, sinhala. Fon (Fɔngbè) needed a
seventh: `latin-ext`. Poppins — the app's tier-1 Latin font — does not
contain ɖ ɛ ɔ ŋ or the combining tone marks (U+0300/U+0301) the language
actually uses; left as plain `latin` it would either render tofu or
silently fall back mid-word and break the line. `Noto_Sans` with the
`latin-ext` subset (confirmed present in `next/font/google`'s font data
before writing the code, not assumed) is loaded for this locale only and
takes priority over Poppins in the font stack — see the `latin-ext` block
in `app/globals.css` and the `notoSansLatinExt` instance in `app/layout.tsx`.

**Benin is French, not French-and-nothing-else.** French is Benin's
official language and was already covered by the `fr` locale — a
separate "Benin" entry would have been a duplicate of it. Fon earns its
own row because it is the country's largest indigenous language and a
materially different reading choice from French for many Beninese
workers, not a duplicate. (My first pass at this, before the kit arrived,
mapped "Benin" to French alone — the kit's authored reasoning for adding
Fon specifically was better than that assumption, and superseded it.)

**Catalogue coverage did not grow with the UI — resolved 2026-08, but
incrementally.** `categories`/`products` originally carried nine `name_*`
columns, and Amharic, French and Fon fell back to the English product
name; `toCatalogLocale()` in `lib/i18n/config.ts` held that mapping.

`20260812180000_catalog_12_languages.sql` adds the three missing columns,
so the split is gone in principle — but they are **nullable**, unlike the
original nine, and that is the design rather than an oversight. A row
translated into French uses its French name; a row not yet reached still
falls back to English, now via `localizedName()`'s own null-check instead
of a locale-level mapping. That makes translating the catalogue a job
that can be done a category at a time, rather than one that has to cover
all 168 product types in three languages before any of it ships.
`build-catalog.mjs` mirrors the same rule: `LANGS` is required,
`OPTIONAL_LANGS` is not.

First tranche: the 24 fruits in Fruits & Vegetables (2026-08). The other
152 types still read English in those three languages.

**Fon's translation is a first draft, not a reviewed one — flagged more
urgently than any other locale in this project.** Telugu, Sinhala and
Nepali (§10's list, README "Before it can launch") already carry a
native-speaker-review flag; Fon's is stronger because the language has
markedly less digital presence than the other eleven, so translation
confidence here is genuinely lower, not just cautious boilerplate. Treat
every Fon string as provisional until a native speaker has read it.
