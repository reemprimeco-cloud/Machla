-- The owner photographed and uploaded real photos for nearly all 116
-- Tamween items (2026-09-25). Several of those brands/products also
-- exist as their own separate rows elsewhere in the catalog (Tamween is
-- its own set of rows, not a view over the regular catalog) — she asked
-- for those other-category rows to pick up her uploaded photo too,
-- rather than keep showing their old generic photo/icon.
--
-- Matched only where the brand is an exact, unambiguous match to a
-- specific existing product/cut:
--   - Whole Chicken (meat_chicken_fish): Americana, Sadia, Seara
--     ("Chicken — Sera" in the Tamween list — same brand, alternate
--     spelling) — Tamween's chicken items are whole birds, matching
--     "Whole Chicken" specifically, not breast/legs/wings.
--   - Fresh Milk (dairy_eggs), brand KDD — Tamween's KDD items are all
--     fresh (Full-Fat/Half-Fat by the litre), not the long-life KDD row.
--   - Sugar and Milk Powder (cooking_pantry / dairy_eggs), the
--     unbranded/generic row — Tamween's own entries carry no brand.
-- Left alone: KDCOW milk, Tomato Paste (Khazan/KDD), Rice, Vegetable
-- Oil, Corn Flakes, Cerelac — no unambiguous matching row exists
-- elsewhere in the catalog.

begin;

update products set image_url = 'https://uwouqetlzwvnlrirrhbh.supabase.co/storage/v1/object/public/product-images/product_7becc6b0-5453-4b54-93cc-66c22f38ee00.webp'
where id = '19e826d7-856e-449b-a41d-85469f568adf'; -- Whole Chicken, Americana

update products set image_url = 'https://uwouqetlzwvnlrirrhbh.supabase.co/storage/v1/object/public/product-images/product_0354b2b4-97d0-40f6-975d-37e419eea82a.webp'
where id = 'ccdd6c28-6b37-4874-952a-4fd8b66793fc'; -- Whole Chicken, Sadia

update products set image_url = 'https://uwouqetlzwvnlrirrhbh.supabase.co/storage/v1/object/public/product-images/product_806728d8-4cdc-4860-b920-52d6d983bfc2.webp'
where id = '47e38d71-4d4b-4cc5-ad93-b3680abd4aec'; -- Whole Chicken, Seara

update products set image_url = 'https://uwouqetlzwvnlrirrhbh.supabase.co/storage/v1/object/public/product-images/product_94c4b7b2-fd42-41ce-bc14-426883719b01.webp'
where id in ('104c47bb-cd47-436f-9da8-be092962e6b8', 'a762dbbd-dd40-41ff-b4fe-adc53009b42e'); -- Fresh Milk, KDD (two rows)

update products set image_url = 'https://uwouqetlzwvnlrirrhbh.supabase.co/storage/v1/object/public/product-images/product_360aac60-ab7c-40d7-b2ef-f462dab73a1f.webp'
where id = '6965f933-c94f-4739-81e9-3e1f0d304bab'; -- Sugar, generic

update products set image_url = 'https://uwouqetlzwvnlrirrhbh.supabase.co/storage/v1/object/public/product-images/product_f997d29e-1d74-44c9-a8d4-c5f339a56665.webp'
where id = '858c6517-2dd6-4c85-9238-3bd5b81527f4'; -- Milk Powder, generic

commit;
