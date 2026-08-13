# Generated product artwork

Photorealistic product images generated for this project (2026-08) with
Higgsfield's `marketing_studio_image` model, at the owner's request, to
replace the emoji fallback in the browse grids.

**These are original works this project owns**, which is the whole reason
they live here and are committed while the images one directory up are
not (`../.gitignore`). Nothing was copied from a stock library or a
retailer's site — this project treats Sharq Coop and Deliveroo Kuwait as
reference-only and never re-hosts their photography
(`docs/architecture/11-product-catalog-architecture.md` §2).

## House style

Every prompt follows one shape, so the grid reads as one set:

> Professional e-commerce product photograph of **&lt;one single item&gt;**.
> Isolated on a pure white seamless background, centred, soft studio
> lighting, subtle soft shadow beneath, sharp focus, photorealistic
> supermarket catalogue style, no text, no logo, no packaging.

Two rules in that template are not cosmetic:

- **One single item.** Not "three potatoes" — the catalogue is one row
  per product type with no size or weight, so a photo showing a quantity
  contradicts the data.
- **No text, no logo, unbranded.** Generating imitation Almarai or KDD
  packaging would be trademark infringement, so packaged goods are drawn
  as plain unmarked containers. That is also why the categories of mostly
  *packaged* goods (Cleaning, Personal Care, Household, Baby Care,
  Canned & Sauces, Cooking & Pantry) were deliberately left on their
  emoji: an anonymous white bottle is less use to a low-literacy shopper
  than 🧴 is.

## Files are named after the product type

`tomato.webp` covers the `tomato` type. Same namespace as the directory
above; a file placed there overrides the generated one of the same name,
which is how a real photograph replaces generated artwork later without
deleting anything.

400×400, WebP, ~5–15 KB each.

## Regenerating

There is no script — these came from an interactive session. To replace
one, generate a new 1:1 image with the template above, then:

```bash
convert new.png -resize 400x400 -background white -alpha remove -alpha off \
  -quality 82 catalog-import/images/generated/<type>.webp
```

Then re-run the uploader (`../../scripts/upload-images.mjs`), or drop the
file into the `product-images` bucket by hand and re-point the row.

## A caveat worth keeping

Generated food photography is convincing but not authoritative. The fish
in particular (`fish_hamour`, `fish_zubaidi`) are plausible rather than
verified likenesses of the Gulf species a Kuwaiti shopper knows by sight.
If a helper ever picks the wrong thing because of one of these, replace
it with a real photograph — that is what the override above is for.
