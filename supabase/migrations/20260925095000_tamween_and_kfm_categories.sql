-- Two new top-level categories the owner asked for (2026-09-25):
--
-- 1. التموين (Tamween) — Kuwait's subsidized/reduced-price co-op goods
--    program. Prices are set by the Ministry of Commerce & Industry and
--    are the same at every co-op nationwide, so unlike every other
--    product in this catalog these items carry a real, regulated price —
--    hence the new products.price/price_label columns below, rather than
--    folding a price into an existing free-text field.
--
-- 2. المطاحن الكويتية (Kuwait Flour Mills & Bakeries Co., KFM) — a
--    dedicated section for this one Kuwaiti bakery brand's own product
--    line, separate from Tamween. The KFM biscuit added earlier today
--    (20260925094500_kfm_lemon_sandwich_biscuit.sql) moves into it in
--    the next migration.

begin;

alter table public.products
  add column if not exists price numeric(10,3),
  add column if not exists price_label text;

alter table public.products
  add constraint products_price_label_check
  check (price_label is null or price_label in ('subsidized', 'reduced'));

comment on column public.products.price is
  'KWD, 3 decimals. Only set for regulated price-list items (Tamween) — '
  'every other product in this catalog is priced by the store, not shown '
  'here.';
comment on column public.products.price_label is
  '''subsidized'' (مدعوم) or ''reduced'' (مخفض), the Ministry of Commerce''s '
  'own two-tier labeling for Tamween goods. Null for non-Tamween products.';

insert into categories (key, icon, sort_order, is_active, is_capture, name_en, name_ar, name_hi, name_te, name_ur, name_fil, name_ne, name_id, name_si, name_am, name_fr, name_fon)
values (
  'tamween', '🧾', 16, true, false,
  'Subsidized Goods (Tamween)', 'التموين',
  'सब्सिडी वाला सामान (Tamween)', 'సబ్సిడీ వస్తువులు', 'سبسڈی والا سامان', 'Subsidized na Produkto',
  'अनुदानित सामान', 'Barang Bersubsidi', 'සහනාධාර භාණ්ඩ', 'የድጎማ እቃዎች', 'Produits subventionnés', 'Nudogbɛ Sɔgbe'
);

insert into categories (key, icon, sort_order, is_active, is_capture, name_en, name_ar, name_hi, name_te, name_ur, name_fil, name_ne, name_id, name_si, name_am, name_fr, name_fon)
values (
  'kfm', '🌾', 17, true, false,
  'Kuwait Flour Mills (KFM)', 'المطاحن الكويتية',
  'कुवैत फ्लोर मिल्स (KFM)', 'కువైట్ ఫ్లోర్ మిల్స్ (KFM)', 'کویت فلور ملز (KFM)', 'Kuwait Flour Mills (KFM)',
  'कुवेत फ्लोर मिल्स (KFM)', 'Kuwait Flour Mills (KFM)', 'කුවේට් පිටි මෝල් (KFM)', 'ኩዌት ዱቄት ፋብሪካ (KFM)', 'Minoteries du Koweït (KFM)', 'Kuwait Flour Mills (KFM)'
);

commit;
