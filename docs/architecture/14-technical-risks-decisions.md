# 14 — Technical Risks & Decisions Requiring Approval

Per the task rule "do not make assumptions when an architectural decision
affects security, data ownership, authentication, or future scalability —
clearly document the decision and rationale," every item below is a place
Phase 0 had to choose a default because the master plan left it
underspecified or ambiguous. **Nothing here blocks reading the rest of the
architecture, but Phase 1–4 implementation should not begin until you've
either confirmed these defaults or told me to change them.**

## 1. `users.role` vs. `household_members.role` — two fields, two purposes

**Decision:** `users.role` is a UI-only "primary persona" hint (which
onboarding flow was taken, which language set to offer); all
authorization reads `household_members.role`, scoped per household. Full
rationale in `04-roles-permission-matrix.md` §1.
**Why it needs your sign-off:** it's a security-relevant modeling choice
(the master plan lists `role` on both tables without saying which one
authorizes). Alternative: collapse to a single global role — simpler, but
forecloses a user ever being, e.g., an Owner of their own household and a
Worker in someone else's.

## 2. Can a Member create and send shopping lists, same as a Worker?

**Decision (recommended):** Yes. Master plan Section 10 says Member
permissions "can include... Create lists," which reads as
optional/configurable rather than excluded. Confirm this is desired for
V1, or say Members should be view/complete-only.

## 3. Can a Member operate the purchase checklist and mark lists completed, same as Owner?

**Decision (recommended):** Yes — Owner and Member have identical rights
over shopping lists and the purchase checklist; only household management
(invite/remove members, edit settings) is Owner-exclusive. Confirm, or
say Members should be read-only on lists.

## 4. Invitation code entropy and defaults

**Decision (recommended):** 8-character Crockford base32 code (~40 bits),
single-use, 7-day default expiry, rate-limited redemption endpoint.
Confirm these defaults (especially the 7-day expiry window) match what
you want in practice.

## 5. Can one user belong to more than one household?

**Decision:** the schema does not prevent it (no uniqueness constraint
beyond `(household_id, user_id)`); V1 UI is not required to build a
household-switcher for this edge case, but `08-route-map.md` reserves
`/switch-household` for it. Low risk either way — flagging for awareness,
not urgent approval, since it doesn't block Phase 1–4.

## 6. Catalog population approach: human-curated import vs. automated scraping

**Decision (recommended):** Phase 5 populates the catalog via a
human-curated CSV/JSON reference pass (a person manually notes product
name/brand/size/category from Sharq Coop / Deliveroo Kuwait and other
sources — never prices), not an automated scraper, given anti-bot and ToS
uncertainty. **This materially affects Phase 5 effort/timeline** (manual
curation of 300–500 products takes real person-hours) — confirm this
tradeoff is acceptable, or indicate if a specific licensed data source /
partnership should be pursued instead.

## 7. Owner/Member display language restricted to Arabic/English only

**Decision:** enforced at the application layer (not a DB constraint,
to stay flexible) that Owner/Member accounts may only pick Arabic or
English as `preferred_language`, even though the column supports all 9
codes. This matches master plan Section 21 explicitly, but is worth a
double-check: should an Owner/Member who happens to prefer, say, Filipino
be allowed to view lists in that language too?

## 8. `unit` field: fixed value set vs. free text

**Decision (recommended):** `pcs | kg | g | l | ml | pack | box | bottle
| bag | other`, application-validated. Confirm this list covers Kuwait
grocery shopping adequately, or propose changes before Phase 5 seeds
products against it.

## 9. Can a Member invite Workers, or is inviting Owner-exclusive?

**Decision (recommended):** Owner-exclusive in V1 (simplest, most
conservative default, matches master plan Section 10's permission list for
Owner explicitly including "Invite users" and not listing it for Member).
Confirm, or say Members should also be able to invite Workers.

## 10. SMS/OTP delivery sub-provider for Kuwait numbers

**Decided 2026-08-12, owner-approved: Twilio, delivering the OTP over
WhatsApp, with Kuwait SMS sender-ID registration running in parallel.**

How the decision fell out, because each step was forced by a verified
fact rather than preference:

- The owner's Twilio account is active with an approved Business Profile,
  but its only sender is a WhatsApp Business number — the first real OTP
  send failed because no SMS route to +965 exists on the account.
- Branded SMS to Kuwait is not a configuration change: Twilio requires
  carrier pre-registration of the sender ID (NOCs to Zain and Ooredoo,
  trade licence for domestic entities) — weeks of paperwork, which has
  been started, not skipped.
- WhatsApp is effectively universal among this app's users in Kuwait, and
  the account is already approved for it.

**Relation to the master plan's "no WhatsApp" rule:** that exclusion is
about product features (sharing lists, chat). Using WhatsApp as the OTP
*transport* — invisible to the application, which still calls Supabase
Auth exactly as before — was judged infrastructure, and explicitly put to
the owner rather than assumed, per the standing rule on authentication
decisions. The owner chose it.

Implementation is one constant, `OTP_CHANNEL` in `lib/auth/phone.ts`;
when SMS registration completes, flipping it back (or offering both) is
the entire change. Supabase-side requirements live in
`06-auth-otp-flow.md` §5A.

## 11. Ownership transfer / co-ownership

**Decision:** not built in V1. Exactly one active Owner per household,
enforced by a partial unique index; no "leave household" path exists for
a sole Owner. Flagging because it's a real gap if an Owner needs to hand
off the household (e.g., loses phone access) — acceptable to defer, but
you should know it's deferred, not forgotten.

## 12. Category icon set

**Decision (recommended):** emoji-based icons (🥬🥛🍚🍗🧼 etc., matching
the master plan's own examples) as the V1 default — zero asset
production cost, renders consistently across all 9 languages/scripts
without translation work, and can be swapped for a custom icon set later
without a schema change (`categories.icon` is just a string). Low risk,
flagged for awareness only.

## 13. Risk (not a decision): manual catalog curation volume

300–500 products across 15 categories, each needing up to 9 localized
names, is a meaningful content-authoring effort independent of
engineering — worth planning for as a Phase 5 workstream with its own
timeline, potentially involving native-speaker review for language
quality (especially Telugu, Sinhala, Nepali, where automated translation
quality is more likely to need a human check).

**Phase 5 status — partly mitigated, partly still open.**

*Mitigated:* the type/brand split
(`11-product-catalog-architecture.md` §7.2) cut the translation surface
from ~295 records to 168. Names live on the *type*, so a new brand or size
adds a row with **zero** new translation work, and the nine names stay
consistent across every variant of a type by construction. This bounds the
growth of the problem, which was the sharper half of the risk.

*Still open:* the 168 × 9 translations shipped **without native-speaker
review**, and the product list itself was authored from general knowledge
rather than verified against real Kuwaiti shelves (recorded in the
`_provenance` block of `products.json`, and in §7.1). Telugu, Sinhala and
Nepali remain the most likely to need correction, exactly as flagged here
at Phase 0. This is a content task, not an engineering one: both a
translation fix and a product-list fix are edits to
`catalog-import/data/*.json` followed by a re-run of the importer — no UI
change, no redeploy, no schema change.

## 14. Risk (not a decision): RTL + 9-language UI testing surface

Phase 2/9/10 testing surface is large (9 languages × RTL for 2 of them ×
mobile browsers × low-end devices). No mitigation needed at Phase 0, just
flagging it as a genuine Phase 9/10 time investment, not a one-day task.

## 15. Risk (not a decision): Supabase free/starter tier limits

Not evaluated in Phase 0 (no Supabase project exists yet). Before Phase 1
provisioning, confirm the intended Supabase plan tier can handle expected
Phase 1 usage (storage for product images, auth SMS costs which are
often billed separately/pass-through, RLS-heavy query patterns) — a
five-minute check, not a redesign, but worth doing before, not after,
Phase 5 image uploads begin.
