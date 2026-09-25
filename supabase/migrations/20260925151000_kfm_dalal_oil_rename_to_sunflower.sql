-- Correction from the owner: the second Dalal oil bottle (image 4 of
-- the KFM collage) is Sunflower Oil, not Cottonseed Oil as first
-- guessed (20260925140000_kfm_product_catalog.sql). Brand stays Dalal.

begin;

update products
set
  name_en = 'Dalal Sunflower Oil',
  name_ar = 'زيت دوار الشمس دلال',
  name_hi = 'डलाल सनफ्लावर ऑयल',
  name_te = 'దలాల్ సన్‌ఫ్లవర్ ఆయిల్',
  name_ur = 'دلال سن فلاور آئل',
  name_fil = 'Dalal Sunflower Oil',
  name_ne = 'डलाल सूर्यमुखी तेल',
  name_id = 'Minyak Bunga Matahari Dalal',
  name_si = 'ඩලාල් සූරියකාන්ත තෙල්',
  name_am = 'ዳላል የሱፍ ዘይት',
  name_fr = 'Huile de tournesol Dalal',
  name_fon = 'Dalal ami ɖewǔn',
  search_keywords = array['dalal','kuwait flour mills','sunflower oil','زيت دوار الشمس','دلال'],
  natural_key = 'kfm_dalal_sunflower_oil||'
where natural_key = 'kfm_dalal_cottonseed_oil||';

commit;
