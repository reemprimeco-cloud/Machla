-- The owner asked to stop showing per-brand duplicate rows for a
-- generic product ("١ رز ١ دجاج كامل ١ صدرو دجاج" — one rice, one whole
-- chicken, one chicken breast) — going forward, a product only gets a
-- separate brand row when she specifically asks for that brand.
--
-- Soft-deleted (is_active = false) rather than DELETEd: products.id is
-- FK'd from shopping_list_items and product_usage_stats, so a hard
-- delete would either fail or orphan real shopping-list history. The
-- catalog query (getProductsInCategory) already filters on
-- is_active = true, same pattern as every other retired/inactive row.
--
-- Kept the generic/no-brand row in each case; deactivated the branded
-- ones. Basmati vs Egyptian rice and Whole Chicken vs Chicken Breast
-- are different products, not brand variants of each other, so each
-- keeps its own single row.

begin;

update products set is_active = false
where id in (
  '5b0425c0-1935-4341-8b5f-6fbc151610cf', -- Basmati Rice, Daawat
  '9a4c5f33-0b6c-45b6-86f1-77947d07cf86', -- Basmati Rice, Abu Kass
  'f9547f2b-f81e-4b65-bd62-6f46d513a895', -- Basmati Rice, Al Walimah
  '05fe635e-b6bf-45c1-8b2c-46c985cda764', -- Basmati Rice, India Gate
  'a6991758-2fcb-4f65-8e46-109d06046001', -- Egyptian Rice, Abu Kass
  '47e38d71-4d4b-4cc5-ad93-b3680abd4aec', -- Whole Chicken, Seara
  '19e826d7-856e-449b-a41d-85469f568adf', -- Whole Chicken, Americana
  'ccdd6c28-6b37-4874-952a-4fd8b66793fc', -- Whole Chicken, Sadia
  '46dd186e-0410-43ea-9002-af00bc19dcac'  -- Chicken Breast, Sadia
);

commit;
