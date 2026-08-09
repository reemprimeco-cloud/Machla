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

`apps/web/scripts/check-locales.mjs` (`npm run check:locales`) flattens
every `locales/*.json` file to its full set of dot-path keys and asserts
every non-English file has exactly the same key set as `en.json` — no
missing keys, no stray/typo'd keys. Plain Node, zero dependencies,
intended to be run before every build (and wired into CI once CI exists).
This is what keeps the runtime fallback in §4 a safety net rather than the
normal path.

## 7. Language-selection screen design

`/welcome` deliberately carries **no instruction text** ("choose your
language" or similar) — before a locale is picked there is no single
correct language to render that instruction in, and for a low-literacy
audience the native-script grid is meant to be self-explanatory without
one (master plan: "extremely simple and visual... do not rely only on
English labels"). Each card:

- shows the language's own **native name as the primary, largest label**;
- shows the **English name only as a small secondary hint** (omitted
  entirely when it's identical to the native name, e.g. Filipino);
- shows an **optional flag emoji** as an additional visual cue, present
  only where one language maps unambiguously to one flag (`ar`, `en`,
  `hi`, `fil`, `id`); intentionally omitted for Telugu, Nepali, Sinhala,
  and Urdu rather than guessing a national flag that doesn't cleanly
  correspond to the language;
- is a large tap target (`min-h-28`, ~112px) in a 2-column mobile grid,
  matching the "large, obvious language buttons/cards" requirement.

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
