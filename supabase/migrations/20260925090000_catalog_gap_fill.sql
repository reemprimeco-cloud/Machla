-- Catalog gap-fill: fruits/vegetables Reem asked for by name, plus
-- frozen/snacks/personal-care brands spotted in a co-op flyer she shared
-- (2026-09-25 owner request).
--
-- WHY NO FLYER PHOTOS
--
-- The flyer's own product shots (Lay's World Cup packaging with licensed
-- footballer likenesses, brand-owned box photography for Lezita/Amada/
-- Dabur/etc.) are never re-hosted here — see
-- docs/architecture/11-product-catalog-architecture.md §7.5: this catalog
-- only ever uses specifically licensed photography, everything else falls
-- back to an icon. In practice that policy is already how every existing
-- brand row in this table works: Signal and Sensodyne toothpaste, Pringles
-- and Chipsy chips, Lifebuoy soap — none of them point at a photo of their
-- own box, they all reuse the one generic product-type photo already in
-- storage (toothpaste.webp, potato_chips.webp, soap_bar.webp). New brand
-- rows below follow the exact same pattern. Two genuinely new frozen
-- products (chicken strips, chicken shawerma) have no existing generic
-- photo to reuse yet, so they ship icon-only until real photography is
-- licensed for them — same as every other icon-only row already in this
-- table.
--
-- WHY "كوجا" BECAME PERSIMMON
--
-- Not a standard Gulf Arabic produce name. Read as a misspelling of "كاكا"
-- (kaki/persimmon), sold seasonally in Kuwait under that name — flagged to
-- the owner rather than silently guessed.

begin;

-- ============================================================
-- 1. Fruits & Vegetables — 12 items from the owner's list not already
--    in the catalog (بطاطس/تفاح/طماط/فلفل حلو/عرموط/عنب/بطاط were already
--    covered by existing rows under a different but equivalent name).
-- ============================================================

insert into products (
  category_id, brand, name_en, name_ar, name_hi, name_te, name_ur, name_fil,
  name_ne, name_id, name_si, name_am, name_fr, name_fon,
  unit, icon, search_keywords, sort_order, natural_key
) values
('bc8f0bef-579b-4f13-93d4-2524e4378d8b', null, 'Persimmon', 'كاكا', 'पर्सिमन', 'పర్సిమన్', 'خرمالو', 'Persimmon',
 'पर्सिमन', 'Kesemek', 'පර්සිමන්', 'ካኪ ፍሬ', 'Kaki', 'Pɛsimɔn',
 'kg', '🟠', array['kaki','persimmon','kesemek','khormalu'], 346, 'persimmon||'),

('bc8f0bef-579b-4f13-93d4-2524e4378d8b', null, 'Galia Melon', 'رقي', 'गैलिया खरबूजा', 'గాలియా ఖర్బూజా', 'گیلیا خربوزہ', 'Galia Melon',
 'ग्यालिया खर्बुजा', 'Melon Galia', 'ගාලියා මෙලන්', 'ጋሊያ ሜሎን', 'Melon Galia', 'Mɛlɔ̃ Galia',
 'pcs', '🍈', array['galia','melon','raqi'], 347, 'melon_galia||'),

('bc8f0bef-579b-4f13-93d4-2524e4378d8b', null, 'White Nectarine', 'نكتارين أبيض', 'सफ़ेद नेक्टेरिन', 'తెల్ల నెక్టరిన్', 'سفید نیکٹرین', 'Puting Nectarine',
 'सेतो नेक्टेरिन', 'Nektarin Putih', 'සුදු නෙක්ටරින්', 'ነጭ ኔክታሪን', 'Nectarine blanche', 'Nɛktalin wewe',
 'kg', '🍑', array['nectarine','white nectarine'], 348, 'nectarine_white||'),

('bc8f0bef-579b-4f13-93d4-2524e4378d8b', null, 'Effendi Orange', 'أفندي', 'एफेंडी संतरा', 'ఎఫెండి నారింజ', 'افندی مالٹا', 'Effendi na Dalandan',
 'एफेन्डी सुन्तला', 'Jeruk Effendi', 'එෆෙන්ඩි දොඩම්', 'ኤፈንዲ ብርቱካን', 'Orange effendi', 'Blɛfutu effendi',
 'kg', '🍊', array['effendi','effendi orange'], 349, 'orange_effendi||'),

('bc8f0bef-579b-4f13-93d4-2524e4378d8b', null, 'Juicing Orange', 'برتقال عصير', 'जूसिंग संतरा', 'జ్యూసింగ్ నారింజ', 'جوسنگ مالٹا', 'Dalandan na Pang-Juice',
 'जुस सुन्तला', 'Jeruk untuk Jus', 'යුෂ දොඩම්', 'ለጭማቂ ብርቱካን', 'Orange à jus', 'Blɛfutu jusi tɔn',
 'kg', '🍊', array['juicing orange','juice orange'], 350, 'orange_juicing||'),

('bc8f0bef-579b-4f13-93d4-2524e4378d8b', null, 'Grapefruit', 'جريب فروت', 'चकोतरा', 'గ్రేప్‌ఫ్రూట్', 'چکوترا', 'Grapefruit',
 'भोगटे', 'Grapefruit', 'ග්‍රේප්ෆෘට්', 'ግሬፕ ፍሩት', 'Pamplemousse', 'Grɛpufuluti',
 'kg', '🍊', array['grapefruit','chakotra'], 351, 'grapefruit||'),

('bc8f0bef-579b-4f13-93d4-2524e4378d8b', null, 'Black Grapes', 'عنب أسود', 'काले अंगूर', 'నల్ల ద్రాక్ష', 'کالے انگور', 'Itim na Ubas',
 'कालो अंगुर', 'Anggur Hitam', 'කළු මිදි', 'ጥቁር ወይን', 'Raisins noirs', 'Vinu vɔvɔ',
 'kg', '🍇', array['black grapes','enab aswad'], 352, 'grapes_black||'),

('bc8f0bef-579b-4f13-93d4-2524e4378d8b', null, 'Banati Grapes', 'عنب بناتي', 'बनाती अंगूर', 'బనాటి ద్రాక్ష', 'بناتی انگور', 'Banati na Ubas',
 'बनाती अंगुर', 'Anggur Banati', 'බනාති මිදි', 'ባናቲ ወይን', 'Raisins Banati', 'Vinu banati',
 'kg', '🍇', array['banati grapes','enab banati'], 353, 'grapes_banati||'),

('bc8f0bef-579b-4f13-93d4-2524e4378d8b', null, 'Red Grapes (Seeded)', 'عنب أحمر بذر', 'लाल अंगूर (बीज सहित)', 'ఎర్ర ద్రాక్ష (గింజలతో)', 'بیج والے سرخ انگور', 'Pulang Ubas (May Buto)',
 'रातो अंगुर (बीउसहित)', 'Anggur Merah Berbiji', 'රතු මිදි (බීජ සහිත)', 'ዘር ያለው ቀይ ወይን', 'Raisins rouges à pépins', 'Vinu vɔvɔ kuli',
 'kg', '🍇', array['seeded red grapes','enab ahmar bidhir'], 354, 'grapes_red_seeded||'),

('bc8f0bef-579b-4f13-93d4-2524e4378d8b', null, 'Sweet Potato', 'بطاطا حلوة', 'शकरकंद', 'చిలగడదుంప', 'شکرقندی', 'Kamote',
 'सखरखण्ड', 'Ubi Jalar', 'බතල', 'ጣፋጭ ድንች', 'Patate douce', 'Kumasu vivɛ',
 'kg', '🍠', array['sweet potato','kamote','batata hilwa'], 355, 'sweet_potato||'),

('bc8f0bef-579b-4f13-93d4-2524e4378d8b', null, 'Red Onion', 'بصل أحمر', 'लाल प्याज़', 'ఎర్ర ఉల్లిపాయ', 'سرخ پیاز', 'Pulang Sibuyas',
 'रातो प्याज', 'Bawang Merah', 'රතු ලූනු', 'ቀይ ሽንኩርት', 'Oignon rouge', 'Aklio vɔvɔ',
 'kg', '🧅', array['red onion','basal ahmar'], 356, 'onion_red||'),

('bc8f0bef-579b-4f13-93d4-2524e4378d8b', null, 'White Onion', 'بصل أبيض', 'सफ़ेद प्याज़', 'తెల్ల ఉల్లిపాయ', 'سفید پیاز', 'Puting Sibuyas',
 'सेतो प्याज', 'Bawang Bombay', 'සුදු ලූනු', 'ነጭ ሽንኩርት', 'Oignon blanc', 'Aklio wewe',
 'kg', '🧅', array['white onion','basal abyad'], 357, 'onion_white||');

-- ============================================================
-- 2. Frozen — Lezita (nuggets/fillet/strips), Nabil shawerma, Warba
--    torpedo shrimp. Reuses each generic's existing photo; the two
--    genuinely new generics (strips, shawerma) are icon-only for now.
-- ============================================================

insert into products (
  category_id, brand, name_en, name_ar, name_hi, name_te, name_ur, name_fil,
  name_ne, name_id, name_si, name_am, name_fr, name_fon,
  size, unit, icon, image_url, search_keywords, sort_order, natural_key
) values
-- new brand rows on existing generics
('0f0ddab3-cc1f-49a7-adec-54318b49d62f', 'Lezita', 'Chicken Nuggets', 'ناجتس دجاج', 'चिकन नगेट्स', 'చికెన్ నగ్గెట్స్', 'چکن نگٹس', 'Chicken Nuggets',
 'चिकन नगेट्स', 'Nugget Ayam', 'චිකන් නගට්ස්', null, null, null,
 '700 g', 'pack', '🍗', 'https://uwouqetlzwvnlrirrhbh.supabase.co/storage/v1/object/public/product-images/frozen_nuggets.webp',
 array['lezita','chicken nuggets'], 350, 'frozen_nuggets|lezita|700 g'),

('0f0ddab3-cc1f-49a7-adec-54318b49d62f', 'Lezita', 'Frozen Chicken Fillet', 'فيليه دجاج مجمد', 'जमे हुए चिकन फिलेट', 'ఫ్రోజెన్ చికెన్ ఫిల్లెట్', 'منجمد چکن فلیٹ', 'Frozen na Chicken Fillet',
 'फ्रोजन चिकन फिलेट', 'Fillet Ayam Beku', 'ශීත කළ කුකුල් මස් ෆිලට්', null, null, null,
 '700 g', 'pack', '🍗', 'https://uwouqetlzwvnlrirrhbh.supabase.co/storage/v1/object/public/product-images/frozen_chicken_fillet.webp',
 array['lezita','chicken fillet','chicken tender'], 351, 'frozen_chicken_fillet|lezita|700 g'),

-- new generic: chicken strips (+ Lezita brand row)
('0f0ddab3-cc1f-49a7-adec-54318b49d62f', null, 'Chicken Strips', 'ستربس دجاج', 'चिकन स्ट्रिप्स', 'చికెన్ స్ట్రిప్స్', 'چکن سٹرپس', 'Chicken Strips',
 'चिकन स्ट्रिप्स', 'Strip Ayam', 'චිකන් ස්ට්‍රිප්ස්', null, null, null,
 null, 'pack', '🍗', null,
 array['chicken strips','strips dajaj'], 352, 'chicken_strips||'),

('0f0ddab3-cc1f-49a7-adec-54318b49d62f', 'Lezita', 'Chicken Strips', 'ستربس دجاج', 'चिकन स्ट्रिप्स', 'చికెన్ స్ట్రిప్స్', 'چکن سٹرپس', 'Chicken Strips',
 'चिकन स्ट्रिप्स', 'Strip Ayam', 'චිකන් ස්ට්‍රිප්ස්', null, null, null,
 '700 g', 'pack', '🍗', null,
 array['lezita','chicken strips'], 353, 'chicken_strips|lezita|700 g'),

-- new generic: frozen chicken shawerma (+ Nabil brand row)
('0f0ddab3-cc1f-49a7-adec-54318b49d62f', null, 'Frozen Chicken Shawerma', 'شاورما دجاج مجمدة', 'फ्रोजन चिकन शवर्मा', 'ఫ్రోజెన్ చికెన్ షవర్మా', 'منجمد چکن شاورما', 'Frozen na Chicken Shawerma',
 'फ्रोजन चिकन शावर्मा', 'Shawarma Ayam Beku', 'ශීත කළ චිකන් ෂවර්මා', null, null, null,
 null, 'pack', '🌯', null,
 array['chicken shawerma','frozen shawerma'], 354, 'chicken_shawerma_frozen||'),

('0f0ddab3-cc1f-49a7-adec-54318b49d62f', 'Nabil', 'Frozen Chicken Shawerma', 'شاورما دجاج مجمدة', 'फ्रोजन चिकन शवर्मा', 'ఫ్రోజెన్ చికెన్ షవర్మా', 'منجمد چکن شاورما', 'Frozen na Chicken Shawerma',
 'फ्रोजन चिकन शावर्मा', 'Shawarma Ayam Beku', 'ශීත කළ චිකන් ෂවර්මා', null, null, null,
 '400 g', 'pack', '🌯', null,
 array['nabil','chicken shawerma'], 355, 'chicken_shawerma_frozen|nabil|400 g'),

-- new brand row on existing generic
('0f0ddab3-cc1f-49a7-adec-54318b49d62f', 'Warba', 'Frozen Shrimp', 'ربيان مجمد', 'जमे हुए झींगे', 'ఫ్రోజెన్ రొయ్యలు', 'منجمد جھینگا', 'Frozen na Hipon',
 'फ्रोजन झिंगा', 'Udang Beku', 'ශීත කළ ඉස්සන්', null, null, null,
 '400 g', 'pack', '🦐', 'https://uwouqetlzwvnlrirrhbh.supabase.co/storage/v1/object/public/product-images/frozen_shrimp.webp',
 array['warba','torpedo shrimp','breaded shrimp'], 356, 'frozen_shrimp|warba|400 g');

-- ============================================================
-- 3. Snacks & Sweets — Doritos, Lay's, Cheetos on the existing "Potato
--    Chips" generic; Amada on the existing "Biscuits" generic.
-- ============================================================

insert into products (
  category_id, brand, name_en, name_ar, name_hi, name_te, name_ur, name_fil,
  name_ne, name_id, name_si,
  size, unit, icon, image_url, search_keywords, sort_order, natural_key
) values
('4ff2f562-02e2-4ee5-9d19-3baad6681230', 'Doritos', 'Potato Chips', 'رقائق بطاطس', 'आलू चिप्स', 'బంగాళాదుంప చిప్స్', 'آلو چپس', 'Potato Chips',
 'आलु चिप्स', 'Keripik Kentang', 'අර්තාපල් චිප්ස්',
 '110 g', 'pack', '🍟', 'https://uwouqetlzwvnlrirrhbh.supabase.co/storage/v1/object/public/product-images/potato_chips.webp',
 array['doritos','chips','tortilla chips'], 234, 'potato_chips|doritos|110 g'),

('4ff2f562-02e2-4ee5-9d19-3baad6681230', 'Lay''s', 'Potato Chips', 'رقائق بطاطس', 'आलू चिप्स', 'బంగాళాదుంప చిప్స్', 'آلو چپس', 'Potato Chips',
 'आलु चिप्स', 'Keripik Kentang', 'අර්තාපල් චිප්ස්',
 '155 g', 'pack', '🍟', 'https://uwouqetlzwvnlrirrhbh.supabase.co/storage/v1/object/public/product-images/potato_chips.webp',
 array['lays','lay''s','chips'], 235, 'potato_chips|lay''s|155 g'),

('4ff2f562-02e2-4ee5-9d19-3baad6681230', 'Cheetos', 'Potato Chips', 'رقائق بطاطس', 'आलू चिप्स', 'బంగాళాదుంప చిప్స్', 'آلو چپس', 'Potato Chips',
 'आलु चिप्स', 'Keripik Kentang', 'අර්තාපල් චිප්ස්',
 '115 g', 'pack', '🍟', 'https://uwouqetlzwvnlrirrhbh.supabase.co/storage/v1/object/public/product-images/potato_chips.webp',
 array['cheetos','cheese puffs','chips'], 236, 'potato_chips|cheetos|115 g'),

('4ff2f562-02e2-4ee5-9d19-3baad6681230', 'Amada', 'Biscuits', 'بسكويت', 'बिस्किट', 'బిస్కెట్లు', 'بسکٹ', 'Biskwit',
 'बिस्कुट', 'Biskuit', 'බිස්කට්',
 '135 g', 'pack', '🍪', 'https://uwouqetlzwvnlrirrhbh.supabase.co/storage/v1/object/public/product-images/biscuits.webp',
 array['amada','mood','biscuits','filled cookies'], 237, 'biscuits|amada|135 g');

-- ============================================================
-- 4. Personal Care — Dabur Herbal on the existing "Toothpaste" generic,
--    DermoViva on the existing "Hand Wash" generic.
-- ============================================================

insert into products (
  category_id, brand, name_en, name_ar, name_hi, name_te, name_ur, name_fil,
  name_ne, name_id, name_si,
  size, unit, icon, image_url, search_keywords, sort_order, natural_key
) values
('052c32e7-5f77-46ab-ac7e-5fe3ec38b922', 'Dabur Herbal', 'Toothpaste', 'معجون أسنان', 'टूथपेस्ट', 'టూత్‌పేస్ట్', 'ٹوتھ پیسٹ', 'Toothpaste',
 'दाँत माझ्ने', 'Pasta Gigi', 'දත් බෙහෙත්',
 '100 ml', 'pack', '🪥', 'https://uwouqetlzwvnlrirrhbh.supabase.co/storage/v1/object/public/product-images/toothpaste.webp',
 array['dabur','dabur herbal','clove toothpaste'], 409, 'toothpaste|dabur herbal|100 ml'),

('052c32e7-5f77-46ab-ac7e-5fe3ec38b922', 'DermoViva', 'Hand Wash', 'غسول اليدين', 'हैंड वॉश', 'హ్యాండ్ వాష్', 'ہینڈ واش', 'Hand Wash',
 'हात धुने', 'Sabun Cuci Tangan', 'අත් සබන්',
 '200 ml', 'bottle', '🧼', 'https://uwouqetlzwvnlrirrhbh.supabase.co/storage/v1/object/public/product-images/hand_wash.webp',
 array['dermoviva','age renewal','hand wash'], 410, 'hand_wash|dermoviva|200 ml');

commit;
