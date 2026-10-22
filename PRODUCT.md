# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two roles sharing one household's grocery list — **corrected 2026-10-22**: an earlier version of this document had the two roles' actual jobs backwards (see the git history on this file for the original wording). The direction below is the one the code enforces (`assert_can_work_list` in `supabase/migrations/20260809190000_phase7_household_lists.sql` explicitly refuses a worker caller trying to mark purchase status), confirmed deliberate rather than a bug: in this market, a domestic worker often has no independent transport and the household member is the one who physically goes to the store.

- **Worker** — a domestic helper/household worker who knows day-to-day what the home is running low on and builds the request from inside the home. Often has limited literacy in Arabic and/or English; the worker-facing locale set (Hindi, Telugu, Urdu, Filipino, Nepali, Indonesian, Sinhala, Amharic, French, Fon, alongside Arabic and English — 12 locales total) reflects the real languages of Gulf domestic-worker households, not a generic "top world languages" list.
- **Owner/member** — the head of a household (or another adult family member) who does the actual grocery shopping, checking items off against the worker's request.

A single person can also build and send a list to themselves ("my own list") without a worker, using the identical flow.

## Product Purpose

Machla (ماچلة) closes the trust gap in grocery delegation: a worker builds a request for exactly what the home needs, and the household member doing the shopping sees the same list in the same order, with no room for "that's not what I asked for" to arise from a UI or translation mismatch. It exists so a worker who may not read or speak the household's language can still ask for exactly what's needed, and the person shopping can execute with confidence.

## Positioning

The trusted bridge between the household and the one person who shops for them — not a general grocery-list or multi-household coordination app. The mechanism a competitor could not casually copy: both sides' screens (the worker's pre-send review and the household's post-send checklist) are generated from the same snapshotted category grouping, so what was asked for and what's being shopped from cannot drift apart from the two UIs disagreeing — it's enforced at the data layer, not promised by the interface.

## Operating Context

- Primary language is Arabic (RTL), with the 12-locale worker-language set above; the UI auto-switches script/line-height/font per active locale.
- Used one-handed, often in a physical grocery aisle, by whoever is actually shopping — the household owner/member, checking items off on `/home/lists/[id]`. Large tap targets apply there for that reason.
- The worker's own screens (building the request, from home, before any shopping happens) carry the same large-touch-target, icon-led language for a different reason: low literacy, not aisle conditions — plus a photo-capture escape hatch for an item not in the catalogue.
- Two parallel but separate app tracks (`/home/*` owner/member, `/worker/*` worker) share nearly all UI components via a `basePath` prop, so a change to one track's screen usually needs to be checked against the other.
- Live on both the App Store and Google Play, under the native-shell/PWA pattern (iOS WKWebView shell wraps the same web app).
- Currently active across the Gulf (not Kuwait-only), though the product catalogue content itself is curated from Kuwait retailers (Sharq Coop, Deliveroo Kuwait) and some backend logic (e.g. admin "signed up today" boundary) is hardcoded to the Asia/Kuwait timezone — this is a known, currently-accepted asymmetry between user base and catalogue/ops scope, not something to silently "fix" by assuming Kuwait-only in future work.

## Capabilities and Constraints

- Once a list is sent, the requested product and quantity are frozen — the household (whoever is shopping) can mark items purchased/unavailable; the worker cannot (`assert_can_work_list` refuses a worker caller at the database level, not just in the UI). Either side can add new items to an already-sent list ("forgot something" without waiting for the next one), but neither can edit or remove what the worker originally asked for. This is a deliberate trust-preserving constraint, not a missing feature.
- No third-party product photography is ever rehosted; products without licensed photos fall back to a category/type icon, which is treated as a real design choice for low-literacy recognition, not a placeholder.
- Admin tooling (`/admin/*`) is explicitly held to a lower design bar than the rest of the app — it's a single-operator internal tool, not a user-facing surface.
- No manual dark-mode toggle exists; dark mode follows the OS setting only (`prefers-color-scheme`).

## Brand Commitments

- Name: **Machla**, Arabic wordmark **ماچلة** — the Arabic name must render in a font containing چ (U+0686); not every Arabic web font does.
- Tagline: "Your Home. Your List." / "One home. Every language."
- No third-party/stock photography; no AI-generated "lifestyle" imagery standing in for the product's real catalogue or UI.

## Evidence on Hand

- Live on the App Store and Google Play under the Machla name.
- Live production web deployment at machla.reemora.app.
- No user-count, revenue, or press figures confirmed for this record — do not state or imply any specific number in future copy or decks without asking first.

## Product Principles

1. **One source of truth between two people.** The household and the worker must never be able to see conflicting versions of the same list — enforce this at the data layer, not just in the UI.
2. **The worker is the harder design problem.** When a tradeoff exists between convenience for the owner and clarity for a possibly-low-literacy worker on her own phone, resolve it toward the worker.
3. **A frozen request is a feature.** Once sent, what was asked for does not silently change — correct this by adding, never by editing history.
4. **No borrowed credibility.** No stock photography, no fabricated testimonials or numbers, no third-party product images reused without rights.
5. **Design restraint is a brand signal, not decoration.** One gradient CTA per screen, deliberate catalogue emoji kept for recognition, line icons for chrome — these rules exist to keep the interface legible under real-world, one-handed, possibly non-native-reading use, and should be preserved rather than loosened for visual novelty.

## Accessibility & Inclusion

- WCAG AA text contrast (4.5:1 normal text, 3:1 large text) is a hard requirement, not an aspiration — the design system's own token file documents a deliberate split between decorative (gradient/brand) colors and an AA-safe "interactive ramp," and any new color usage must land on the correct side of that split.
- Minimum 48px tap targets are required everywhere, for two distinct reasons depending on the track: one-handed/gloved use in a physical shopping context on the household side (`/home/lists/[id]`), and low literacy on the worker side (`/worker/*`) — neither is generic mobile-UX guidance.
- Low-literacy users are a primary, not edge-case, audience: icon-led navigation, photo-based items, and script-aware typography exist because of this, not despite it.
