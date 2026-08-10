# HomeList

Multilingual household shopping-list app for Kuwait. A mobile-first PWA that
connects household owners with the domestic workers who shop for them, in
nine languages, with pictures instead of prose.

**Status: all 12 phases implemented.** One Next.js app serves both
experiences; one Supabase project holds the data and every authorization
rule.

> **Phone authentication is live** (Supabase + Twilio), but no account
> has ever been created through it and the database has zero users —
> signing in end to end is the next thing to prove. See
> [Before it can launch](#before-it-can-launch).

## What it does

A worker opens the app, browses a picture catalogue of 295 products across
15 categories, taps what the house needs, and sends the list. The household
owner receives it grouped by aisle, ticks items off while shopping, and
marks it complete. Both sides get notified when the other acts.

No prices anywhere — deliberately. The catalogue is reference data for
*naming* products, not a store.

**Languages:** Arabic, English, Hindi, Telugu, Urdu, Filipino, Nepali,
Indonesian, Sinhala. Arabic and Urdu render RTL, using CSS logical
properties throughout rather than mirrored stylesheets.

## Repository layout

```text
apps/web/            the Next.js application (both experiences)
supabase/migrations/ the schema, RLS policies and every write RPC
supabase/tests/      267 SQL assertions, run as `authenticated`
catalog-import/      catalogue source data + importer (run from a laptop)
docs/architecture/   19 documents; start at 00-index.md
```

## Where the rules live

**Authorization is in Postgres, not in the UI.** Every table has RLS. Every
mutation except a user editing their own row goes through a
`SECURITY DEFINER` function that checks `auth.uid()` itself. Route guards
exist, but only as defence in depth — a client that skips a screen or calls
an RPC directly gets exactly the same refusals.

That is the property the SQL test suite exists to protect, and it is tested
by setting `role authenticated` rather than running as superuser (which
bypasses RLS and makes isolation tests pass while measuring nothing).

Read [`docs/architecture/10-security-model.md`](docs/architecture/10-security-model.md)
before changing anything under `supabase/`, and
[`docs/architecture/18-backend-contract.md`](docs/architecture/18-backend-contract.md)
before writing any second client.

## Running the checks

```bash
cd apps/web
npm install
npm run preflight              # locales (148 keys × 9), env, tsc, lint, build

./../../supabase/tests/run-tests.sh   # 267 assertions against a local Postgres
```

`npm run dev` needs `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_ANON_KEY` in `apps/web/.env.local`. The service role
key belongs to `catalog-import/` alone and must never appear in a
`NEXT_PUBLIC_` variable — `check:env` fails the preflight if it does.

## Before it can launch

These need dashboard access and cannot be done from this repository.
[`docs/architecture/17-deployment.md`](docs/architecture/17-deployment.md)
has the detail.

1. **Finish the auth configuration.** Phone + Twilio are enabled; still
   to do: disable the Email provider (on by default, and ruled out by
   design), confirm SMS OTP length is 6, raise the OTP expiry from 60s,
   and set a send rate limit. `docs/architecture/06-auth-otp-flow.md` §5A
   explains each. Then sign in with a real phone, which is the one path
   never exercised.
2. **A backup plan for the database.** The free tier has none, and this
   project holds the only copy of every household's data. The catalogue is
   reproducible from `catalog-import/`; households, lists and memberships
   are not.
3. **Vercel project**, root directory `apps/web`, with the two public
   environment variables above.
4. **Product photography.** The import pipeline is ready and the schema has
   the column; the images themselves are not in the repository.
5. **Native-speaker review of the translations**, particularly Telugu,
   Sinhala and Nepali.

## Stack

Next.js 16 (App Router), React 19, TypeScript, Tailwind v4, Supabase
(Auth + Postgres + Storage), deployed on Vercel. No Netlify — the V1
infrastructure is locked to that list, and nothing else has been added
without a reason written down in
[`docs/architecture/14-technical-risks-decisions.md`](docs/architecture/14-technical-risks-decisions.md).

The original brief is
[`HomeList_Claude_Code_Master_Plan.md`](HomeList_Claude_Code_Master_Plan.md).
