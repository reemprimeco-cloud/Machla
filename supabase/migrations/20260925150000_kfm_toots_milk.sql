-- One more KFM item the owner asked for by name (2026-09-25): توتس
-- بالحليب. No photo yet — she's uploading it herself through the
-- general per-product uploader on /admin/photos (extended in this same
-- change to also cover the kfm category, not just tamween), so
-- image_url stays null and the product shows its icon until she does.

begin;

insert into products (
  category_id, brand, name_en, name_ar, name_hi, name_te, name_ur, name_fil,
  name_ne, name_id, name_si, name_am, name_fr, name_fon,
  size, unit, icon, search_keywords, sort_order, natural_key, is_active
) values (
  '5c7f1214-ff2a-4bc3-b03d-8c4e9c16581e', 'Kuwait Flour Mills', 'Toots with Milk', 'توتس بالحليب', 'टूट्स विद मिल्क', 'టూట్స్ విత్ మిల్క్', 'ٹوٹس ود ملک', 'Toots with Milk',
  'टुट्स विद मिल्क', 'Toots with Milk', 'ටූට්ස් විත් මිල්ක්', 'ቱትስ ከወተት ጋር', 'Toots au lait', 'Toots ale',
  null, 'pack', '🍞', array['kfm','kuwait flour mills','toots','milk','توتس','حليب'], 27, 'kfm_toots_milk||', true
);

commit;
