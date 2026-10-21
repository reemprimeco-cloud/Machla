---
name: Machla
description: Soft Glass — a glassmorphism design system for a Kuwait/Gulf Arabic-first grocery shopping-list PWA
colors:
  primary: "#b80c6c"
  primary-hover: "#a20b5f"
  primary-press: "#8a0951"
  brand-pink: "#e00f84"
  brand-coral: "#ff4f72"
  brand-orange: "#ff7e45"
  brand-amber: "#ff9a3d"
  bg: "#f5f2f8"
  surface: "#ffffff"
  surface-2: "#f1f4f7"
  ink: "#0b1f3f"
  ink-muted: "#55617a"
  ink-faint: "#6b8095"
  success: "#007a4d"
  warning: "#8a5a00"
  danger: "#c2183c"
  info: "#00838c"
typography:
  display:
    fontFamily: "IBM Plex Sans Arabic, Geeza Pro, sans-serif"
    fontSize: "32px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "IBM Plex Sans Arabic, Geeza Pro, sans-serif"
    fontSize: "24px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  title:
    fontFamily: "IBM Plex Sans Arabic, Geeza Pro, sans-serif"
    fontSize: "19px"
    fontWeight: 600
    lineHeight: 1.35
  body:
    fontFamily: "IBM Plex Sans Arabic, Geeza Pro, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.7
  label:
    fontFamily: "IBM Plex Sans Arabic, Geeza Pro, sans-serif"
    fontSize: "14px"
    fontWeight: 500
  caption:
    fontFamily: "IBM Plex Sans Arabic, Geeza Pro, sans-serif"
    fontSize: "13px"
    fontWeight: 400
rounded:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "22px"
  xl: "28px"
  pill: "999px"
  hero: "28px"
  card: "24px"
  card-sm: "22px"
  icon: "15px"
  well: "18px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.pill}"
    height: "48px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    height: "48px"
  glass-surface:
    backgroundColor: "rgba(255,255,255,0.62)"
    rounded: "{rounded.card}"
  glass-icon-button:
    backgroundColor: "rgba(255,255,255,0.65)"
    rounded: "{rounded.pill}"
    width: "44px"
    height: "44px"
---

# Design System: Machla

## Overview

**Creative North Star: "Soft Glass"**

Soft Glass is a frosted, light-filled surface language built for one specific condition: a phone held in one hand, in a supermarket aisle, by someone who may not read the screen's language well. Every surface is a translucent, blurred panel floating a few millimeters above a pale lavender-tinted canvas — never a flat, opaque card — so the interface reads as light and layered rather than boxy. Color is rationed deliberately: a single magenta-to-orange gradient is the system's one loud gesture, reserved for exactly one call-to-action per screen, while everything a person must read or press lives on a separate, deliberately darkened "interactive ramp" that passes WCAG AA on its own. The two ramps are never allowed to swap places — the raw gradient hues never sit behind body text, and the AA-safe ramp never gets used as a decorative wash.

Dark mode is not a second design — it's the same glass system lit from the inside instead of from outside, following the OS setting only. There is no manual toggle, and none of the three brand gradients change between modes: the gradient is the one constant the system is built around.

**Key Characteristics:**
- Frosted glass surfaces (`backdrop-filter: blur(20px)`) over a pale, never-pure-white background
- Exactly one gradient CTA per screen — a hard, enforced rule, not a guideline
- A strict two-layer color split: vivid decorative hues vs. darkened AA-safe interactive hues, never mixed
- Generous radii (22–28px) and large (44–48px) touch targets throughout, justified by real one-handed, gloved, in-aisle use
- Script-aware typography: line-height and optical size shift per active script (Arabic, Devanagari, Nastaliq, etc.), not just per locale string

## Colors

The palette is a warm magenta-to-amber brand gradient paired with a cool, ink-navy neutral system — the gradient is reserved for decoration, the neutrals and a separately-darkened interactive ramp carry every readable pixel.

### Primary
- **Interactive Magenta** (`#b80c6c`): the one color every button, link, active state, and focus ring uses. Deliberately darker than the brand gradient's own pink — chosen specifically to clear 4.5:1 against both white and the glass surfaces.
- **Interactive Magenta — hover** (`#a20b5f`) / **— press** (`#8a0951`): darken further on interaction, never lighten.

### Decorative brand ramp (never behind readable text)
- **Brand Pink** (`#e00f84`), **Brand Coral** (`#ff4f72`), **Brand Orange** (`#ff7e45`), **Brand Amber** (`#ff9a3d`): the four stops that make up the system's three gradients (`gradient-primary`, `gradient-hero`, `gradient-progress`, all at a 225° angle). Used only as backgrounds — the single CTA button/pill per screen, the home hero panel, and progress-bar fills. Measured against white, none of these four individually reach 4.5:1, which is exactly why they're fenced off from text use.

### Neutral
- **Canvas Lavender** (`#f5f2f8`): the page background — intentionally not pure white or grey, so glass panels have something to visibly float above.
- **Surface White** (`#ffffff`) / **Surface Tint** (`#f1f4f7`): solid-surface fallbacks for contexts that predate or sit outside the glass treatment.
- **Navy Ink** (`#0b1f3f`): primary text color, taken from the wordmark.
- **Muted Slate** (`#55617a`) / **Faint Slate** (`#6b8095`): secondary and tertiary text/placeholder.

### Semantic
- **Confirm Green** (`#007a4d`), **Warning Amber** (`#8a5a00`), **Danger Red** (`#c2183c`), **Info Teal** (`#00838c`): all hand-darkened for AA text use, the same discipline as the interactive ramp.

### Named Rules
**The Two-Layer Rule.** The brand gradient ramp is decoration; the interactive ramp is for anything a user must read or press. Reaching for a raw brand hue (or its light tint) as a text color is the single most common way to violate this system — there is a code comment in `app/globals.css` that exists specifically to warn against it.

**The One Gradient Rule.** Exactly one `.hl-gradient-cta` element is allowed per screen. Using the gradient twice on one screen destroys the hierarchy it exists to create.

## Typography

**Body/Display Font (Arabic, primary):** IBM Plex Sans Arabic, with Geeza Pro as fallback.
**Body/Display Font (Latin):** Poppins, with system-ui fallback.
**Other scripts:** Noto Nastaliq Urdu, Noto Sans Devanagari/Telugu/Sinhala/Ethiopic, each with its own tuned line-height — the active script is read from a `data-script` attribute on `<html>` and swaps both the font stack and the line-height token together, not just the font.

**Character:** Plain, warm, and legible over stylish — the type scale exists to carry a message clearly to someone who may be reading in their second or third language, not to impress.

### Hierarchy
- **Display** (700, 32px, 1.2, -0.02em): the single biggest number or headline on a screen (e.g. a progress percentage, a greeting).
- **Headline** (600, 24px, 1.3, -0.01em): screen titles.
- **Title** (600, 19px, 1.35): card and section headings.
- **Body** (400, 16px): default reading text.
- **Label** (500, 14px): buttons, form labels, UI chrome text.
- **Caption** (400, 13px, color `ink-muted`): secondary/meta text.

### Named Rules
**The Script-Bump Rule.** Any script other than Latin gets a 1px bump on caption (13→14px) and label (14→15px) — non-Latin scripts carry less optical size at the same pixel value, and this keeps them equally legible without a visible "different app" feeling between locales.

## Layout

Mobile-first, single-column, capped at a 480px content width (`--hl-content-max`) even on wider viewports — this is a phone-held app, not a responsive marketing site. Standard screen padding is 20px horizontal; grid gaps run 12px; section spacing runs 18–22px. The floating bottom tab bar insets 20px from the screen edges and 24px (plus the iOS safe-area inset) from the bottom, rather than running edge-to-edge — it's meant to look like it's hovering over the content, not docked to the chrome.

## Elevation & Depth

Hybrid: flat glass panels at rest, with navy-tinted (never neutral-grey) shadows doing the lifting, plus an actual `backdrop-filter: blur(20px)` on every glass surface for real depth, not just a drop shadow standing in for it.

### Shadow Vocabulary
- **sm** (`0 1px 2px rgba(0,35,61,.06), 0 2px 6px rgba(0,35,61,.05)`): minimal lift, legacy flat surfaces.
- **card** (`0 10px 30px rgba(11,31,63,.08)`): the standard glass-surface shadow.
- **chip** (`0 6px 18px rgba(11,31,63,.08)`): small glass controls (icon buttons, back pill).
- **nav** (`0 14px 34px rgba(11,31,63,.14)`): the floating tab bar.
- **accent** (`0 8px 18px rgba(224,15,132,.3)`; becomes a `0 0 20px` glow in dark mode): anything using the interactive magenta as a filled background — primary pills, checked checkboxes.
- **hero** (`0 20px 44px rgba(224,15,132,.32)`): the one hero gradient panel per screen.
- **primary** (`0 6px 18px rgba(224,27,106,.28)`): under the gradient CTA specifically.

### Named Rules
**The Tinted Shadow Rule.** Every shadow in this system carries a hue (navy for neutral surfaces, magenta for accent/gradient surfaces) — a pure black/grey shadow does not appear anywhere in the token set.

## Shapes

Generous, soft radii throughout — nothing in the active design language is sharp-cornered. A dedicated radius scale exists for glass-era surfaces (`card` 24px, `card-sm` 22px, `hero` 28px, `well` 18px for image wells, `icon` 15px for small icon squares/thumbnails) layered on top of an older, smaller legacy scale (`xs` 8px through `xl` 28px) still used by a handful of pre-refresh surfaces. `pill` (999px) is used for every button, chip, badge, and the floating tab bar itself.

## Components

### Buttons
- **GlassSurface (Card):** `rounded-card` (24px), `border` 1px `rgba(255,255,255,.9)`, `background: rgba(255,255,255,.62)`, `backdrop-filter: blur(20px)`, `shadow-card`. The base container every card in the app renders through.
- **GlassIconButton:** 44×44px circle, `rounded-pill`, `background: rgba(255,255,255,.65)`, 1px border `rgba(255,255,255,.95)`, `shadow-chip`, icon 21–22px, scales to 95% on press.
- **PrimaryButton / PrimaryPill:** the one gradient surface per screen. `background: var(--gradient-primary)` (225°, pink→coral), white label text, `shadow-primary`/`shadow-accent`. Carries a permanent 12%-black veil over the gradient (not just a hover state) so white label text clears 4.5:1 against the gradient's lightest blend — confirmed by measurement, not assumption.
- **BackLink:** a glass pill, chevron + label, the chevron mirrored by default and un-mirrored in RTL (not the other way around) so it always points "back" regardless of reading direction.
- **SecondaryButton:** solid white/`surface`, 1px `line` border, `rounded-md` — the plain, non-gradient action.

### Cards / Containers
- **Corner Style:** 24px (`rounded-card`), 22px for the smaller progress/household-strip variant.
- **Background:** `rgba(255,255,255,.62)` translucent, blurred.
- **Shadow Strategy:** `shadow-card`.
- **Border:** 1px `rgba(255,255,255,.9)`, brightens to `rgba(255,255,255,.95)` on "strong" variants (header chips, buttons).

### Inputs / Fields
- **Style:** solid `surface` background, 1px `line` border, `rounded-md` (not glass — form fields stay opaque for legibility while typing).
- **Focus:** border shifts to the interactive magenta; a 2px magenta focus ring with 2px offset on every focusable element, with no exceptions — this is a hard accessibility invariant, not a style choice.

### Navigation (floating tab bar)
- 68px tall, `rounded-pill`, floating 20px from the sides and 24px (+ safe-area) from the bottom rather than docked flush to the screen edge. `background: rgba(255,255,255,.72)` + `blur(24px)`, `shadow-nav`. The active tab renders as a full gradient PrimaryPill with icon + visible label; inactive tabs are icon-only with a 48px touch target and the label moved to `aria-label` instead of visible text.

### Checkbox
36×36px circle. Checked: the same gradient + 12%-veil treatment as PrimaryButton, with `shadow-accent`. Unchecked: transparent with a 2px `checkbox-empty-border` ring. Purely presentational — the surrounding row keeps whatever toggle handler it already had.

## Do's and Don'ts

### Do:
- **Do** keep the brand gradient (`#e00f84` → `#ff4f72`, 225°) to one CTA element per screen.
- **Do** use the interactive magenta (`#b80c6c`) and its hover/press darkenings for every readable, clickable, or focusable element.
- **Do** keep every glass surface's `backdrop-filter: blur(20px))` paired with an opaque fallback (`rgba(255,255,255,.92)` light / `rgba(20,30,64,.92)` dark) for browsers without `backdrop-filter` support.
- **Do** keep touch targets at 44–48px minimum everywhere — this is justified by real one-handed, in-aisle, possibly-gloved use, not generic mobile guidance.
- **Do** let dark mode follow `prefers-color-scheme` only; there is no manual toggle anywhere in the app, and none should be added without a product decision to build one.
- **Do** keep the three brand gradients (`primary`, `hero`, `progress`) identical between light and dark mode.

### Don't:
- **Don't** use any of the four raw brand-ramp hues (`brand-pink`, `brand-coral`, `brand-orange`, `brand-amber`) or their light tints as text color. None individually clear 4.5:1 against white.
- **Don't** use `.hl-gradient-cta` more than once per screen.
- **Don't** replace the icon fallback chain (photo → per-item icon → category icon → 📦) for a product or category tile with a plain broken-image state — the fallback is a deliberate low-literacy-recognition design, not a placeholder for missing work.
- **Don't** add a manual light/dark toggle without a product decision — the current design intentionally has none.
- **Don't** reach for a flat, opaque card style for a new screen without a reason; the glass treatment is the default, not an optional flourish.
