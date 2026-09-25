-- New dairy product the owner asked for by name (2026-09-25): long-life
-- lactose-free milk, Almarai brand — in dairy_eggs, not tamween (she
-- was explicit: "بس مو بقسم التموين بقسم الالبان"). No photo yet — she's
-- uploading it herself.

begin;

insert into products (
  category_id, brand, name_en, name_ar, name_hi, name_te, name_ur, name_fil,
  name_ne, name_id, name_si, name_am, name_fr, name_fon,
  size, unit, icon, search_keywords, sort_order, natural_key, is_active
) values (
  '3011ad35-d8c7-4068-9b31-a41ea0b65486', 'Almarai', 'Long-Life Lactose-Free Milk', 'حليب طويل الأمد خالي من اللاكتوز', 'लॉन्ग-लाइफ लैक्टोज़-फ्री मिल्क', 'లాంగ్-లైఫ్ లాక్టోజ్-ఫ్రీ మిల్క్', 'لانگ لائف لیکٹوز فری ملک', 'Long-Life Lactose-Free Milk',
  'ल्याक्टोज-रहित दीर्घायु दूध', 'Susu UHT Bebas Laktosa', 'දිගු කල් පවතින ලැක්ටෝස් රහිත කිරි', 'ላክቶስ ነጻ የረዥም ጊዜ ወተት', 'Lait longue conservation sans lactose', 'Almarai notɔn ale (lactose ɖě)',
  '1 L', 'l', '🥛', array['almarai','lactose free','long life milk','حليب خالي من اللاكتوز','المراعي'], 391, 'milk_long_life_lactose_free|almarai|1 l', true
);

commit;
