# 17 — Deployment (Phase 11)

Launching the first real web version: one Next.js app on Vercel, one
Supabase project, one auth system, serving both the Worker and Household
experiences.

Netlify is deliberately absent — the approved V1 infrastructure is
Next.js, TypeScript, Tailwind, Vercel, Supabase, and nothing else.

## 1. What is done in the repository

| Item | State |
|---|---|
| Security headers | `next.config.ts` (static) + `proxy.ts` (CSP with per-request nonce) |
| HTTPS / HSTS | `Strict-Transport-Security`, 2 years, subdomains |
| Environment preflight | `npm run check:env` — required vars present, no secret key exposed |
| Full preflight | `npm run preflight` — locales, env, types, lint, build |
| Search-engine posture | `app/robots.ts` disallows everything (private app) |
| Service worker caching | `Cache-Control: must-revalidate` on `/sw.js` |
| PWA installability | manifest, 192/512 icons, maskable icon, registered SW |

## 2. What must be done in the Vercel and Supabase dashboards

These need account access and cannot be done from the repository.

### 2.1 Vercel project

- Import `reemprimeco-cloud/Home-list`.
- **Root directory: `apps/web`.** The repo is a monorepo-ready layout;
  without this the build finds no Next.js app.
- Framework preset: Next.js. Build and output settings need no override.

### 2.2 Environment variables (Vercel → Settings → Environment Variables)

| Variable | Value | Scope |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://uwouqetlzwvnlrirrhbh.supabase.co` | Production + Preview |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the project's anon/publishable key | Production + Preview |

**The service role key goes nowhere near this list.** It bypasses every
RLS policy the application's security rests on, and belongs only to
`catalog-import/`, run from a laptop when the catalogue changes.
`check-env.mjs` fails the preflight if any secret-looking variable is
present, and separately if the anon key turns out to carry a role other
than `anon` — the specific accident of pasting the wrong key into a
`NEXT_PUBLIC_` variable, which would ship it to every browser.

### 2.3 Supabase — the launch blocker

**Phone auth is not enabled, so nobody can sign in.** Everything else in
this document is ready; this is not.

1. Authentication → Providers → **Phone**: enable.
2. Choose and configure an SMS provider (Twilio, MessageBird or Vonage).
   This has been the open decision since Phase 0 (item 10) and it costs
   money per message, which is why it is a decision rather than a default.
3. Consider an OTP rate limit per number — the invitation flow is
   protected, but the login flow's cost is per SMS sent.
4. Authentication → URL Configuration → add the production domain to the
   redirect allow-list.

### 2.4 Database backups

Supabase's automatic daily backups depend on the plan. On the free tier
there are none, and this application holds the only copy of every
household's data. Decide the plan before real users exist, not after.

The catalogue itself is reproducible from the repository at any time
(`catalog-import/`), so what a backup protects is households, memberships,
lists and notifications — the part with no other source.

### 2.5 Custom domain

Vercel → Domains. HTTPS and certificate renewal are automatic. The HSTS
header includes `includeSubDomains`, so make sure no subdomain of the
chosen domain needs to serve plain HTTP before pointing it here.

## 3. Analytics and error monitoring — a recommendation, not an install

The phase lists both. Neither is installed, deliberately, and the reason
is the same for each: they are decisions with a privacy dimension in an
application used by domestic workers, and the standing rule is not to add
dependencies that have not been asked for specifically.

**Error monitoring.** Vercel captures runtime logs and build errors with
no dependency. `app/error.tsx` already logs the full error server-side
while showing the user nothing but a translated sentence — a Postgres
message would be meaningless to them and could leak schema detail. If
richer tracing is wanted later, Sentry is the conventional choice; it is
an added dependency and an added data processor, so it should be a
deliberate call.

**Analytics.** `@vercel/analytics` is cookieless and aggregate, which is
the least invasive option available on this stack. Before adding it,
consider what is actually being measured: this app's users are workers
whose employers can see their activity in the product already. Aggregate
page counts are defensible; anything session-level or per-user is not, and
should not be added without deciding what happens to it.

If they are added, `connect-src` in `proxy.ts` must be widened to their
endpoint — the CSP will otherwise block them silently.

## 4. Content Security Policy — a note for whoever changes it

The first version of this CSP used a static `script-src 'self'` in
`next.config.ts`. It looked correct and produced a **completely broken
app**: Next.js inlines its bootstrap and RSC payload as inline scripts, so
every page failed to hydrate with React error #412. Nothing about the
build or the type-check noticed; a browser check did.

The working version mints a nonce per request in `proxy.ts` and uses
`'strict-dynamic'`. Two consequences worth knowing:

- **Every page must be dynamically rendered.** They already are — a nonce
  cannot be embedded in a statically cached page.
- **The CSP lives in exactly one place.** Defining it in `next.config.ts`
  as well would make the browser enforce the intersection of both
  policies, which fails in ways that look nothing like a CSP problem.

`style-src` keeps `'unsafe-inline'` on purpose: a nonce does not cover
inline style *attributes*, and React sets those (the progress bar's
width). The directive that actually stops XSS is `script-src`, and that
one has no `'unsafe-inline'`.

After any change here, re-run the browser check — the failure mode is
silent in every other kind of test.

## 5. Deploy checklist

```bash
cd apps/web
npm run preflight        # locales, env, types, lint, build
./../../supabase/tests/run-tests.sh   # 260 assertions
```

Then, in order:

1. Supabase: phone auth + SMS provider enabled (§2.3).
2. Vercel: project imported with root directory `apps/web`, env vars set.
3. Deploy. Confirm the response carries `Content-Security-Policy` with a
   `nonce-` value that differs between two requests.
4. Sign in with a real phone number end to end — this is the one path that
   has never been exercised, because it cannot be until §2.3 is done.
5. Install the PWA on an Android phone and confirm the home-screen icon is
   the maskable one, not a letterboxed square.
