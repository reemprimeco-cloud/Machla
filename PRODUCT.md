# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two roles sharing one household's grocery list:

- **Owner/member** — the head of a household (or another adult family member) who needs groceries but may not have time to shop, or wants to delegate the errand.
- **Worker** — a domestic helper/household worker who does the physical shopping on the owner's behalf. Often has limited literacy in Arabic and/or English; the worker-facing locale set (Hindi, Telugu, Urdu, Filipino, Nepali, Indonesian, Sinhala, Amharic, French, Fon, alongside Arabic and English — 12 locales total) reflects the real languages of Gulf domestic-worker households, not a generic "top world languages" list.

A single person can also build and send a list to themselves ("my own list") without a worker, using the identical flow.

## Product Purpose

Machla (ماچلة) closes the trust gap in grocery delegation: a household asks for specific items, a worker shops for exactly those items, and both sides see the same list in the same order, with no room for "that's not what I asked for" to arise from a UI or translation mismatch. It exists so a household can delegate shopping with confidence and a worker can execute it without needing to read or speak the household's language.

## Positioning

The trusted bridge between the household and the one person who shops for them — not a general grocery-list or multi-household coordination app. The mechanism a competitor could not casually copy: both sides' screens (the worker's pre-send review and the household's post-send checklist) are generated from the same snapshotted category grouping, so what was asked for and what's being shopped from cannot drift apart from the two UIs disagreeing — it's enforced at the data layer, not promised by the interface.

## Operating Context

- Primary language is Arabic (RTL), with the 12-locale worker-language set above; the UI auto-switches script/line-height/font per active locale.
- Used one-handed, often in a physical grocery aisle, by the worker role — hence large tap targets, icon-led navigation, and a photo-capture escape hatch for items not in the catalogue.
- Two parallel but separate app tracks (`/home/*` owner/member, `/worker/*` worker) share nearly all UI components via a `basePath` prop, so a change to one track's screen usually needs to be checked against the other.
- Live on both the App Store and Google Play, under the native-shell/PWA pattern (iOS WKWebView shell wraps the same web app).
- Currently active across the Gulf (not Kuwait-only), though the product catalogue content itself is curated from Kuwait retailers (Sharq Coop, Deliveroo Kuwait) and some backend logic (e.g. admin "signed up today" boundary) is hardcoded to the Asia/Kuwait timezone — this is a known, currently-accepted asymmetry between user base and catalogue/ops scope, not something to silently "fix" by assuming Kuwait-only in future work.

## Capabilities and Constraints

- Once a list is sent, the requested product and quantity are frozen — the worker can mark items purchased/unavailable and add new items, but cannot edit or remove what was originally asked for. This is a deliberate trust-preserving constraint, not a missing feature.
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
- Minimum 48px tap targets are required, justified specifically by one-handed/gloved use in a shopping context, not generic mobile-UX guidance.
- Low-literacy users are a primary, not edge-case, audience: icon-led navigation, photo-based items, and script-aware typography exist because of this, not despite it.
