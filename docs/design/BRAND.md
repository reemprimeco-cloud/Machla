# Machla — brand sheet

**MACHLA · GROCERIES APP**

A shopping cart carrying two leaves, with an M in the basket. The gradient runs
magenta at the lower-left to amber at the upper-right; the leaves sit in the
green-to-cyan range.

Supersedes the earlier "HomeList — Roofline" mark (cream roof over a
caregiver and child) as of the 2026-08 visual renovation. The product this
app is — a household's shopping list, built by a helper or by the household
itself, with no prices, no cart total, and no checkout — did not change;
only the mark, palette and component styling did. See
`docs/architecture/14-technical-risks-decisions.md` for that scoping
decision if it's ever unclear from the UI alone why a "cart" mark doesn't
mean this app charges for anything.

**Wordmark:** Machla (Poppins Bold, -1.5% tracking) / ماچلة (IBM Plex Sans
Arabic SemiBold — must be a face containing چ, U+0686; Tajawal does not
have it)

**Tagline:** One home. Every language. / بيت واحد. كل اللغات.

---

## Mark variants — use the right one

| Variant | File | Use |
|---|---|---|
| **gradient** ("tile" in `MachlaIcon`) | `public/mark/machla-gradient.svg` | Splash, app icon, marketing, anything ≥ 64 px |
| **flat** | `public/mark/machla-flat.svg` | UI chrome, headers, list rows, 32–64 px, **all CMYK print** |
| **mono** | `public/mark/machla-mono.svg` | Inherits `currentColor` — engraving, embossing, one-colour stationery, watermarks |
| **micro** | `public/mark/machla-micro.svg` | **≤ 32 px only.** Drops the M and the wheel rings |

`components/brand/MachlaIcon.tsx` inlines the flat and gradient geometry
directly (as `variant="flat"` / `variant="tile"`) rather than importing
these SVG files, so it stays a Server Component with no fetch. The raw
files here exist for print, favicon generation, and anywhere outside the
Next.js app that needs the mark. `app/icon.svg` and `public/icons/*` are
generated from the gradient variant — regenerate them together if the
mark ever changes.

The micro variant is not optional. At 32 px the M fills in solid and the
two wheel rings merge into blobs. Micro keeps the basket-and-leaves
silhouette, which stays readable down to 16 px.

---

## Colour

### Brand ramp — decoration only, never behind readable text

| Token | Hex | CMYK |
|---|---|---|
| magenta | `#FF00CF` | 0 / 100 / 0 / 0 |
| pink | `#F5297F` | 0 / 92 / 32 / 0 |
| rose | `#FA4685` | 0 / 82 / 30 / 0 |
| coral | `#FA6062` | 0 / 71 / 55 / 0 |
| orange | `#FB8A2E` | 0 / 53 / 86 / 0 |
| amber | `#FFC400` | 0 / 24 / 100 / 0 |
| leaf deep | `#00915B` | 88 / 21 / 82 / 5 |
| leaf | `#00C186` | 76 / 0 / 66 / 0 |
| leaf light | `#00F2D8` | 62 / 0 / 33 / 0 |
| navy (wordmark, ink) | `#00233D` | 100 / 72 / 40 / 36 |

### Interactive ramp — anything a user reads or presses (`app/globals.css`)

| Token | CSS var | Hex | White-on contrast |
|---|---|---|---|
| primary | `--hl-primary` | `#E01B6A` | **4.63** ✓ AA |
| primary hover | `--hl-primary-hover` | `#C2185B` | 5.87 ✓ |
| primary press | `--hl-primary-press` | `#A3134C` | 7.62 ✓ AAA |
| go / success | `--hl-success` | `#007A4D` | 5.40 ✓ |
| warn | `--hl-warning` | `#8A5A00` | 5.93 ✓ |
| danger | `--hl-danger` | `#C2183C` | 6.44 ✓ |
| ink | `--hl-ink` | `#00233D` | 16.06 ✓ |

**Why two ramps.** Measured against white, not one brand colour clears the
4.5:1 WCAG AA threshold for text:

```
magenta 3.41   pink 3.81   coral 3.04   orange 2.39   amber 1.60   mint 2.34
```

Amber at 1.60 is close to invisible. So the brand ramp is decoration — the
mark, gradients, hero panels, category tints, large display type.
Everything pressable or readable uses the interactive ramp, which is the
same hues darkened until they pass. Navy carries all body copy.

If you are putting white text on a brand-ramp colour directly (rather than
`--hl-primary` and friends), you have reached for the wrong layer.

The gradient CTA (`.hl-gradient-cta` in `app/globals.css`, used by
`PrimaryButton` in `components/ui/Primitives.tsx`) is the one sanctioned
exception: allowed once per screen, at large size, as brand expression.
Every screen in this app already has exactly one primary action, so this
was a styling change, not a new design constraint to enforce.

---

## Clear space & minimums

Clear space = one quarter of the mark's width on all four sides.

| | Screen | Print |
|---|---|---|
| Mark alone | 20 px (micro) | 10 mm |
| Mark + wordmark | 96 px | 28 mm |

## Don't

- Don't use the gradient variant below 64 px — it turns to mud.
- Don't put white text on any brand-ramp colour directly.
- Don't recolour the leaves warm or the cart pink-to-amber. The two-family
  split is the whole idea: produce vs. basket.
- Don't rotate, stretch, or add a drop shadow to the flat variant.
- Don't place the mark on a photo without a solid tile behind it.
- Don't rebuild the gradient by hand — it has six stops at specific offsets
  (see the `linearGradient` definitions in `MachlaIcon.tsx` or the raw SVGs).
