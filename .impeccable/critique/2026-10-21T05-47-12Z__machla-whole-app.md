---
target: whole app
total_score: 28
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:/home/user/Machla (whole app)"
timestamp: 2026-10-21T05-47-12Z
slug: machla-whole-app
closed: true
---
# Design Critique: Machla (whole app)

**Method: dual-agent (Assessment A: independent design-director subagent · Assessment B: detector/browser-evidence subagent)**

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Optimistic UI is solid everywhere, but window.confirm() — already proven to silently fail on this app's iOS shell — still guards account deletion |
| 2 | Match System / Real World | 4 | Gulf colloquial Arabic, aisle-order grouping, photo-as-name for unknown items |
| 3 | User Control and Freedom | 3 | A worker who notices a quantity mistake after sending has no way to correct it, only add to it |
| 4 | Consistency and Standards | 2 | Soft Glass redesign skipped ProductCard and ListReview — the two busiest worker screens |
| 5 | Error Prevention | 3 | Good instincts, undermined by window.confirm() on the highest-stakes action |
| 6 | Recognition Rather Than Recall | 4 | Strongest heuristic — icon-led tiles, native-script-first rows, persistent basket count |
| 7 | Flexibility and Efficiency | 2 | No quick-add from favorites, no repeat-last-list for a daily worker |
| 8 | Aesthetic and Minimalist Design | 3 | One-gradient-per-screen rule holds disciplined; undercut by #4 |
| 9 | Error Recovery | 2 | Generic "something went wrong" with no next step |
| 10 | Help and Documentation | 2 | /tips is the only help surface, and isn't written for the worker |
| **Total** | | **28/40** | **Good** |

## Design Specificity Verdict

LLM assessment: authored for the Kuwait/Gulf owner-worker trust problem specifically — basePath-shared components, aisle-order parity guarantee enforced at the data layer, photo-capture escape hatch, Gulf-domestic-worker-specific locale set (incl. Fon), documented Arabic design decision with a reasoned low-literacy exception. Generic only where genericness is correct (auth, settings, admin).

Deterministic scan: CLI regex scan clean across 117 app/+components files. Live-browser scan on /welcome, /login, /tips (desktop+mobile) caught two real WCAG AA contrast failures the design-level read missed:
- /welcome: selected-language caption 3.7:1 (#eab6d3 on #b80c6c), need 4.5:1.
- .hl-gradient-cta button label (seen on /tips, also present on /login primary buttons) 3.8:1 (#ffffff on #f1327a), need 4.5:1.
Both source-verified as real, non-decorative text nodes, not false positives. Zero findings on /login.

Visual overlays: not applicable — no human-visible browser tab in this sandboxed run; findings are direct detector JSON against locally-rendered pages.

## Overall Impression
Considered, persona-driven product with real engineering discipline (aisle-order data integrity, icon-led worker navigation). The gap to excellent is concentrated in two places: a redesign that stalled before reaching the worker's two busiest screens, and a first-run/onboarding sequence built beautifully for the owner but bypassed or alienating for the worker.

## What's Working
1. Category grid's icon-led, 2-column, literacy-aware navigation with a robust image/icon fallback chain.
2. Aisle-order parity guarantee between ListReview and ListChecklist, enforced as a data invariant, not a UI promise.
3. One-gradient-per-screen discipline held across every screen read in both assessments.

## Priority Issues

[P1] Design-language regression on the worker's two busiest screens
Why it matters: QuantityStepper.tsx's ProductCard and ListReview.tsx's rows are still pre-redesign flat style, sandwiched between CategoryGrid.tsx and SentConfirmation.tsx which both got the glass treatment.
Fix: Port both to the existing glass tokens (rounded-card, border-glass-border, bg-glass-bg, shadow-card, backdrop-blur-[20px]).
Suggested command: /impeccable polish

[P1] A worker entering via invitation link completes signup entirely in English, with no language picker ever offered
Why it matters: app/join/[code]/page.tsx bypasses the root gate that normally forces /welcome first. DEFAULT_LOCALE is English. The realistic first-touch path for this persona skips the most persona-aware screen in the codebase.
Fix: Have /join/[code] and /login check the locale cookie, redirecting to /welcome?next=/join/<code> first when missing.
Suggested command: /impeccable harden

[P2] Two measured WCAG AA contrast failures on live-rendered text
Why it matters: /welcome's selected-language caption (3.7:1) and the shared .hl-gradient-cta button label (3.8:1, on /tips and /login) both fall under 4.5:1, both on the decorative side of the design system's own documented AA-contrast split.
Fix: Darken the caption color on the selected row; darken the gradient's lightest stop or switch the CTA label to the AA-safe ink-on-primary token.
Suggested command: /impeccable audit

[P2] The first-run tutorial is written only in the owner's voice
Why it matters: /tips's copy ("Add your help... They shop, you relax") is gated purely on a first-visit cookie, not role — a worker signing up directly reads instructions about herself in the third person.
Fix: Branch /tips's copy on whether the visitor arrived with an invitation code already in hand.
Suggested command: /impeccable clarify

[P2] Sub-48px tap targets survive in exactly the contexts the app's own token comment calls out
Why it matters: --hl-tap-min: 48px is justified as "gloved / one-handed use" — FavoriteButton.tsx's heart (28px) and ListChecklist.tsx's unavailable-toggle (32px) both fall under it, on screens likely used one-handed in a cold aisle.
Fix: Expand hit area via padding to 44-48px on both, keeping the visual icon size.
Suggested command: /impeccable audit

[P3] window.confirm() still guards account deletion, on the platform already proven to drop it silently
Why it matters: ListsInbox.tsx's own comment documents window.confirm() silently failing on this app's iOS shell and being migrated everywhere else — except the single most destructive action in the app.
Fix: Migrate to the same inline Cancel/Delete pattern already used in DeletableRow and ClearNotificationsButton.
Suggested command: /impeccable harden

## Persona Red Flags

Jordan (first-timer) and Sam (accessibility-dependent) are directly implicated by the P1/P2 issues above.

Lira (project-specific) — a Nepali-speaking domestic worker, moderate Nepali literacy, weak English/Arabic, new to this household, on her own budget Android phone:
- Signs up via WhatsApp invite link -> hits the P1 deep-link bypass directly, joining entirely in English.
- Reaches the category grid -> strongest part of the app for her: native-script label, tuned Devanagari line-height, image-first tiles.
- Tries to favorite a staple item one-handed -> hits the 28px tap target in the exact cold-aisle scenario the app's own tokens anticipate.
- Sends the list, notices a mistake -> no way back, only additive "add more."
- Sees "List sent" -> a static checkmark, no distinct reassurance for someone new and unsure she got it right.

## Minor Observations
- NotificationBell in WorkerChrome.tsx has zero remaining call sites (dead code).
- lib/branding.ts's supportEmail marked "not rendered anywhere" — confirm nothing dead-references it.
- JoinFlow.tsx's 12-character invitation code field has no format hint for someone typing a code read aloud.
- ChoiceCard in Primitives.tsx (used on /onboarding) is another small Soft Glass gap, lower stakes.

## Questions to Consider
- If a quantity mistake is un-fixable once sent, is that restraint or a gap nobody's gotten to yet?
- The language picker is some of the most careful work in this codebase — why does the most likely worker entry path route around it entirely?
- Every emotional peak resolves to the same flat register as every empty state — considered restraint, or an unfinished redesign?
