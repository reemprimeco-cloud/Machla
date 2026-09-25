-- KFM's own bakery and oil product-catalog photography, sent by the owner
-- (5 collage images: gluten-free line, general bakery line, flatbreads,
-- Dalal/Al Joud cooking oils, biscuits). Each product was cropped out of
-- its collage, background-removed, and converted to webp by Claude — see
-- 20260925094500_kfm_lemon_sandwich_biscuit.sql for why this is fine to
-- use (KFM's own catalog photography, in KFM's own dedicated section).
--
-- Bakery items and biscuits carry brand 'Kuwait Flour Mills' (matching
-- the existing biscuit row). The five oils/ghee carry their own printed
-- brand — 'Dalal' or 'Al Joud' — exactly as labeled on the bottle/tin,
-- per the owner (خلها بعلامة دلال والجود زي العبوة بالضبط).

begin;

insert into products (
  category_id, brand, name_en, name_ar, name_hi, name_te, name_ur, name_fil,
  name_ne, name_id, name_si, name_am, name_fr, name_fon,
  size, unit, icon, image_url, search_keywords, sort_order, natural_key, is_active
) values
-- Gluten Free line
('5c7f1214-ff2a-4bc3-b03d-8c4e9c16581e', 'Kuwait Flour Mills', 'Burger Buns (Gluten Free)', 'خبز برجر خالي من الجلوتين', 'ग्लूटन-मुक्त बर्गर बन्स', 'గ్లూటెన్ ఫ్రీ బర్గర్ బన్స్', 'گلوٹن فری برگر بنز', 'Burger Buns Gluten Free',
 'ग्लुटेन-रहित बर्गर बन्स', 'Roti Burger Bebas Gluten', 'ග්ලූටන් රහිත බර්ගර් බනිස්', 'ግሉተን ነጻ ቡርገር ባንስ', 'Pains à burger sans gluten', 'Wɔntin burger gluten ɖě',
 null, 'pack', '🍞', 'https://uwouqetlzwvnlrirrhbh.supabase.co/storage/v1/object/public/product-images/kfm_burger_buns_gf.webp',
 array['kfm','kuwait flour mills','gluten free','burger buns','خبز برجر','جلوتين'], 2, 'kfm_burger_buns_gf||', true),

('5c7f1214-ff2a-4bc3-b03d-8c4e9c16581e', 'Kuwait Flour Mills', 'Rolls (Gluten Free, 4 pcs)', 'خبز رول خالي من الجلوتين (4 حبات)', 'ग्लूटन-मुक्त रोल्स (4 पीस)', 'గ్లూటెన్ ఫ్రీ రోల్స్ (4 పీస్‌లు)', 'گلوٹن فری رولز (4 عدد)', 'Rolls Gluten Free (4 pirasong tinapay)',
 'ग्लुटेन-रहित रोल (4 वटा)', 'Roti Gulung Bebas Gluten (4 pcs)', 'ග්ලූටන් රහිත රෝල්ස් (කෑලි 4)', 'ግሉተን ነጻ ሮልስ (4 ቁራጭ)', 'Petits pains sans gluten (4 pièces)', 'Wɔntin rolls gluten ɖě (ɖě ɛnɛ)',
 null, 'pack', '🍞', 'https://uwouqetlzwvnlrirrhbh.supabase.co/storage/v1/object/public/product-images/kfm_rolls_gf.webp',
 array['kfm','kuwait flour mills','gluten free','rolls','خبز رول','جلوتين'], 3, 'kfm_rolls_gf||', true),

('5c7f1214-ff2a-4bc3-b03d-8c4e9c16581e', 'Kuwait Flour Mills', 'CupCake (Gluten Free, 2 pcs)', 'كب كيك خالي من الجلوتين (2 قطعة)', 'ग्लूटन-मुक्त कपकेक (2 पीस)', 'గ్లూటెన్ ఫ్రీ కప్‌కేక్ (2 పీస్‌లు)', 'گلوٹن فری کپ کیک (2 عدد)', 'CupCake Gluten Free (2 piraso)',
 'ग्लुटेन-रहित कपकेक (2 वटा)', 'CupCake Bebas Gluten (2 pcs)', 'ග්ලූටන් රහිත කප්කේක් (කෑලි 2)', 'ግሉተን ነጻ ካፕኬክ (2 ቁራጭ)', 'Cupcakes sans gluten (2 pièces)', 'CupCake gluten ɖě (ɖě wè)',
 null, 'pack', '🧁', 'https://uwouqetlzwvnlrirrhbh.supabase.co/storage/v1/object/public/product-images/kfm_cupcake_gf.webp',
 array['kfm','kuwait flour mills','gluten free','cupcake','كب كيك','جلوتين'], 4, 'kfm_cupcake_gf||', true),

('5c7f1214-ff2a-4bc3-b03d-8c4e9c16581e', 'Kuwait Flour Mills', 'Toast (Gluten Free)', 'توست خالي من الجلوتين', 'ग्लूटन-मुक्त टोस्ट', 'గ్లూటెన్ ఫ్రీ టోస్ట్', 'گلوٹن فری ٹوسٹ', 'Toast Gluten Free',
 'ग्लुटेन-रहित टोस्ट', 'Roti Tawar Bebas Gluten', 'ග්ලූටන් රහිත ටෝස්ට්', 'ግሉተን ነጻ ቶስት', 'Pain de mie sans gluten', 'Wɔntin toast gluten ɖě',
 null, 'pack', '🍞', 'https://uwouqetlzwvnlrirrhbh.supabase.co/storage/v1/object/public/product-images/kfm_toast_gf.webp',
 array['kfm','kuwait flour mills','gluten free','toast','توست','جلوتين'], 5, 'kfm_toast_gf||', true),

-- General bakery line
('5c7f1214-ff2a-4bc3-b03d-8c4e9c16581e', 'Kuwait Flour Mills', 'Rusk (Al Matahen)', 'شابورة المطاحن', 'रस्क (अल मताहेन)', 'రస్క్ (అల్ మతాహెన్)', 'رسک (المطاحن)', 'Rusk (Al Matahen)',
 'रस्क (अल मताहेन)', 'Rusk (Al Matahen)', 'රස්ක් (අල් මටාහෙන්)', 'ራስክ (አል ማታሄን)', 'Biscotte (Al Matahen)', 'Rusk (Al Matahen)',
 null, 'pack', '🍞', 'https://uwouqetlzwvnlrirrhbh.supabase.co/storage/v1/object/public/product-images/kfm_rusk.webp',
 array['kfm','kuwait flour mills','rusk','shaboura','شابورة'], 6, 'kfm_rusk||', true),

('5c7f1214-ff2a-4bc3-b03d-8c4e9c16581e', 'Kuwait Flour Mills', 'Mini Dates CupCake', 'كب كيك محشي تمر', 'मिनी डेट्स कपकेक', 'మినీ డేట్స్ కప్‌కేక్', 'منی کھجور کپ کیک', 'Mini Dates CupCake',
 'मिनी खजुर कपकेक', 'CupCake Mini Kurma', 'මිනි ඉඳි කප්කේක්', 'ሚኒ ዘንባባ ካፕኬክ', 'Mini cupcakes aux dattes', 'Mini CupCake azi',
 null, 'box', '🧁', 'https://uwouqetlzwvnlrirrhbh.supabase.co/storage/v1/object/public/product-images/kfm_dates_cupcake.webp',
 array['kfm','kuwait flour mills','dates cupcake','كب كيك تمر'], 7, 'kfm_dates_cupcake||', true),

('5c7f1214-ff2a-4bc3-b03d-8c4e9c16581e', 'Kuwait Flour Mills', 'French Bread (Whole Grain)', 'خبز فرنسي بالحبوب', 'फ्रेंच ब्रेड (साबुत अनाज)', 'ఫ్రెంచ్ బ్రెడ్ (హోల్ గ్రెయిన్)', 'فرانسیسی بریڈ (سالم اناج)', 'French Bread na may Buong Butil',
 'फ्रेन्च ब्रेड (सम्पूर्ण अन्न)', 'Roti Prancis (Gandum Utuh)', 'ප්‍රංශ පාන් (සම්පූර්ණ ධාන්‍ය)', 'ፈረንሳይ ዳቦ (ሙሉ እህል)', 'Pain français (grains entiers)', 'Wɔntin Flansɛ (bilibili blibli)',
 null, 'pack', '🥖', 'https://uwouqetlzwvnlrirrhbh.supabase.co/storage/v1/object/public/product-images/kfm_french_bread_brown.webp',
 array['kfm','kuwait flour mills','french bread','whole grain','خبز فرنسي','بالحبوب'], 8, 'kfm_french_bread_brown||', true),

('5c7f1214-ff2a-4bc3-b03d-8c4e9c16581e', 'Kuwait Flour Mills', 'French Bread (White)', 'خبز فرنسي أبيض', 'फ्रेंच ब्रेड (सफेद)', 'ఫ్రెంచ్ బ్రెడ్ (వైట్)', 'فرانسیسی بریڈ (سفید)', 'French Bread na Puti',
 'फ्रेन्च ब्रेड (सेतो)', 'Roti Prancis (Putih)', 'ප්‍රංශ පාන් (සුදු)', 'ፈረንሳይ ዳቦ (ነጭ)', 'Pain français (blanc)', 'Wɔntin Flansɛ (wewe)',
 null, 'pack', '🥖', 'https://uwouqetlzwvnlrirrhbh.supabase.co/storage/v1/object/public/product-images/kfm_french_bread_white.webp',
 array['kfm','kuwait flour mills','french bread','white','خبز فرنسي','أبيض'], 9, 'kfm_french_bread_white||', true),

('5c7f1214-ff2a-4bc3-b03d-8c4e9c16581e', 'Kuwait Flour Mills', 'Brioche', 'البريوش', 'ब्रियोश', 'బ్రయోష్', 'بریوش', 'Brioche',
 'ब्रियोश', 'Brioche', 'බ්‍රියෝෂ්', 'ብርዮሽ', 'Brioche', 'Brioche',
 null, 'pack', '🥐', 'https://uwouqetlzwvnlrirrhbh.supabase.co/storage/v1/object/public/product-images/kfm_brioche.webp',
 array['kfm','kuwait flour mills','brioche','بريوش'], 10, 'kfm_brioche||', true),

('5c7f1214-ff2a-4bc3-b03d-8c4e9c16581e', 'Kuwait Flour Mills', 'Slider Potato Buns (12 pcs)', 'سلايدر خبز البطاطس (12 حبة)', 'स्लाइडर पोटैटो बन्स (12 पीस)', 'స్లైడర్ పొటాటో బన్స్ (12 పీస్‌లు)', 'سلائیڈر پوٹیٹو بنز (12 عدد)', 'Slider Potato Buns (12 pirasong tinapay)',
 'स्लाइडर आलु बन (12 वटा)', 'Roti Kentang Slider (12 pcs)', 'ස්ලයිඩර් අල බනිස් (කෑලි 12)', 'ስላይደር ድንች ባንስ (12 ቁራጭ)', 'Petits pains à la pomme de terre (12 pièces)', 'Slider potato buns (ɖě wǒgban)',
 null, 'pack', '🍞', 'https://uwouqetlzwvnlrirrhbh.supabase.co/storage/v1/object/public/product-images/kfm_slider_bun.webp',
 array['kfm','kuwait flour mills','slider','potato bun','سلايدر','خبز البطاطس'], 11, 'kfm_slider_bun||', true),

('5c7f1214-ff2a-4bc3-b03d-8c4e9c16581e', 'Kuwait Flour Mills', 'Hot Dog Roll Bread', 'خبز هوت دوج رول', 'हॉट डॉग रोल ब्रेड', 'హాట్ డాగ్ రోల్ బ్రెడ్', 'ہاٹ ڈاگ رول بریڈ', 'Hot Dog Roll Bread',
 'हट डग रोल ब्रेड', 'Roti Hot Dog', 'හොට් ඩෝග් රෝල් පාන්', 'ሆት ዶግ ሮል ዳቦ', 'Pain pour hot-dog', 'Wɔntin hot dog',
 null, 'pack', '🌭', 'https://uwouqetlzwvnlrirrhbh.supabase.co/storage/v1/object/public/product-images/kfm_hotdog_bun.webp',
 array['kfm','kuwait flour mills','hot dog','خبز هوت دوج'], 12, 'kfm_hotdog_bun||', true),

('5c7f1214-ff2a-4bc3-b03d-8c4e9c16581e', 'Kuwait Flour Mills', 'Original Toast', 'التوست الأصلي', 'ओरिजिनल टोस्ट', 'ఒరిజినల్ టోస్ట్', 'اورجنل ٹوسٹ', 'Orihinal na Toast',
 'ओरिजिनल टोस्ट', 'Roti Tawar Original', 'මුල් ටෝස්ට්', 'ኦርጅናል ቶስት', 'Pain de mie nature', 'Toast (blibli)',
 null, 'pack', '🍞', 'https://uwouqetlzwvnlrirrhbh.supabase.co/storage/v1/object/public/product-images/kfm_toast_original.webp',
 array['kfm','kuwait flour mills','toast','توست'], 13, 'kfm_toast_original||', true),

-- Flatbreads
('5c7f1214-ff2a-4bc3-b03d-8c4e9c16581e', 'Kuwait Flour Mills', 'Protein Bread (4 pcs)', 'خبز البروتين (4 قطع)', 'प्रोटीन ब्रेड (4 पीस)', 'ప్రోటీన్ బ్రెడ్ (4 పీస్‌లు)', 'پروٹین بریڈ (4 عدد)', 'Protein Bread (4 piraso)',
 'प्रोटिन ब्रेड (4 वटा)', 'Roti Protein (4 pcs)', 'ප්‍රෝටීන් පාන් (කෑලි 4)', 'ፕሮቲን ዳቦ (4 ቁራጭ)', 'Pain protéiné (4 pièces)', 'Wɔntin protein (ɖě ɛnɛ)',
 null, 'pack', '🍞', 'https://uwouqetlzwvnlrirrhbh.supabase.co/storage/v1/object/public/product-images/kfm_protein_bread.webp',
 array['kfm','kuwait flour mills','protein bread','خبز البروتين'], 14, 'kfm_protein_bread||', true),

('5c7f1214-ff2a-4bc3-b03d-8c4e9c16581e', 'Kuwait Flour Mills', 'Shawerma Bread (5 pcs)', 'خبز الشاورما (5 حبات)', 'शावरमा ब्रेड (5 पीस)', 'షవర్మా బ్రెడ్ (5 పీస్‌లు)', 'شاورما بریڈ (5 عدد)', 'Shawerma Bread (5 piraso)',
 'शावर्मा ब्रेड (5 वटा)', 'Roti Shawarma (5 pcs)', 'ෂවර්මා පාන් (කෑලි 5)', 'ሻዋርማ ዳቦ (5 ቁራጭ)', 'Pain à shawarma (5 pièces)', 'Wɔntin shawerma (ɖě atɔɔn)',
 null, 'pack', '🌯', 'https://uwouqetlzwvnlrirrhbh.supabase.co/storage/v1/object/public/product-images/kfm_shawerma_bread.webp',
 array['kfm','kuwait flour mills','shawerma bread','خبز الشاورما'], 15, 'kfm_shawerma_bread||', true),

('5c7f1214-ff2a-4bc3-b03d-8c4e9c16581e', 'Kuwait Flour Mills', 'White Rugag Bread', 'خبز الرقاق الأبيض', 'सफेद रुगाग ब्रेड', 'వైట్ రుగాగ్ బ్రెడ్', 'سفید رقاق بریڈ', 'White Rugag Bread',
 'सेतो रुगाग ब्रेड', 'Roti Rugag Putih', 'සුදු රුගාග් පාන්', 'ነጭ ሩጋግ ዳቦ', 'Pain rugag blanc', 'Wɔntin rugag wewe',
 null, 'pack', '🍞', 'https://uwouqetlzwvnlrirrhbh.supabase.co/storage/v1/object/public/product-images/kfm_rugag_white.webp',
 array['kfm','kuwait flour mills','rugag','white rugag','خبز الرقاق','أبيض'], 16, 'kfm_rugag_white||', true),

('5c7f1214-ff2a-4bc3-b03d-8c4e9c16581e', 'Kuwait Flour Mills', 'Brown Rugag Bread', 'خبز الرقاق الأسمر', 'ब्राउन रुगाग ब्रेड', 'బ్రౌన్ రుగాగ్ బ్రెడ్', 'براؤن رقاق بریڈ', 'Brown Rugag Bread',
 'खैरो रुगाग ब्रेड', 'Roti Rugag Cokelat', 'දුඹුරු රුගාග් පාන්', 'ቡናማ ሩጋግ ዳቦ', 'Pain rugag brun', 'Wɔntin rugag vɔvɔ',
 null, 'pack', '🍞', 'https://uwouqetlzwvnlrirrhbh.supabase.co/storage/v1/object/public/product-images/kfm_rugag_brown.webp',
 array['kfm','kuwait flour mills','rugag','brown rugag','خبز الرقاق','أسمر'], 17, 'kfm_rugag_brown||', true),

-- Dalal / Al Joud oils and ghee (brand kept exactly as printed on the pack)
('5c7f1214-ff2a-4bc3-b03d-8c4e9c16581e', 'Dalal', 'Dalal Corn Oil', 'زيت الذرة دلال', 'डलाल कॉर्न ऑयल', 'దలాల్ కార్న్ ఆయిల్', 'دلال کارن آئل', 'Dalal Corn Oil',
 'डलाल मकै तेल', 'Minyak Jagung Dalal', 'ඩලාල් බඩ ඉරිඟු තෙල්', 'ዳላል በቆሎ ዘይት', 'Huile de maïs Dalal', 'Dalal ami gbado',
 null, 'bottle', '🫗', 'https://uwouqetlzwvnlrirrhbh.supabase.co/storage/v1/object/public/product-images/kfm_dalal_corn_oil.webp',
 array['dalal','kuwait flour mills','corn oil','زيت الذرة','دلال'], 18, 'kfm_dalal_corn_oil||', true),

('5c7f1214-ff2a-4bc3-b03d-8c4e9c16581e', 'Dalal', 'Dalal Cottonseed Oil', 'زيت بذرة القطن دلال', 'डलाल कॉटनसीड ऑयल', 'దలాల్ కాటన్‌సీడ్ ఆయిల్', 'دلال کاٹن سیڈ آئل', 'Dalal Cottonseed Oil',
 'डलाल कपास बीउ तेल', 'Minyak Biji Kapas Dalal', 'ඩලාල් කපු බීජ තෙල්', 'ዳላል የጥጥ ዘር ዘይት', 'Huile de coton Dalal', 'Dalal ami kɔtɔn',
 null, 'bottle', '🫗', 'https://uwouqetlzwvnlrirrhbh.supabase.co/storage/v1/object/public/product-images/kfm_dalal_cottonseed_oil.webp',
 array['dalal','kuwait flour mills','cottonseed oil','زيت بذرة القطن','دلال'], 19, 'kfm_dalal_cottonseed_oil||', true),

('5c7f1214-ff2a-4bc3-b03d-8c4e9c16581e', 'Dalal', 'Dalal Vegetable Ghee', 'سمن نباتي دلال', 'डलाल वेजिटेबल घी', 'దలాల్ వెజిటబుల్ నెయ్యి', 'دلال ویجیٹیبل گھی', 'Dalal Vegetable Ghee',
 'डलाल वनस्पति घ्यू', 'Dalal Minyak Samin Nabati', 'ඩලාල් එළවළු ගිතෙල්', 'ዳላል የአትክልት ቅቤ', 'Ghee végétal Dalal', 'Dalal nusinsɛn ami',
 null, 'box', '🧈', 'https://uwouqetlzwvnlrirrhbh.supabase.co/storage/v1/object/public/product-images/kfm_dalal_ghee.webp',
 array['dalal','kuwait flour mills','ghee','vegetable ghee','سمن نباتي','دلال'], 20, 'kfm_dalal_ghee||', true),

('5c7f1214-ff2a-4bc3-b03d-8c4e9c16581e', 'Al Joud', 'Al Joud Corn Oil', 'زيت الذرة الجود', 'अल जود कॉर्न ऑयल', 'అల్ జూద్ కార్న్ ఆయిల్', 'الجود کارن آئل', 'Al Joud Corn Oil',
 'अल जुद मकै तेल', 'Minyak Jagung Al Joud', 'අල් ජූඩ් බඩ ඉරිඟු තෙල්', 'አል ጁድ በቆሎ ዘይት', 'Huile de maïs Al Joud', 'Al Joud ami gbado',
 null, 'bottle', '🫗', 'https://uwouqetlzwvnlrirrhbh.supabase.co/storage/v1/object/public/product-images/kfm_aljoud_corn_oil.webp',
 array['al joud','kuwait flour mills','corn oil','زيت الذرة','الجود'], 21, 'kfm_aljoud_corn_oil||', true),

('5c7f1214-ff2a-4bc3-b03d-8c4e9c16581e', 'Al Joud', 'Al Joud Sunflower Oil', 'زيت دوار الشمس الجود', 'अल जود सनफ्लावर ऑयल', 'అల్ జూద్ సన్‌ఫ్లవర్ ఆయిల్', 'الجود سن فلاور آئل', 'Al Joud Sunflower Oil',
 'अल जुद सूर्यमुखी तेल', 'Minyak Bunga Matahari Al Joud', 'අල් ජූඩ් සූරියකාන්ත තෙල්', 'አል ጁድ የሱፍ ዘይት', 'Huile de tournesol Al Joud', 'Al Joud ami ɖewǔn',
 null, 'bottle', '🫗', 'https://uwouqetlzwvnlrirrhbh.supabase.co/storage/v1/object/public/product-images/kfm_aljoud_sunflower_oil.webp',
 array['al joud','kuwait flour mills','sunflower oil','زيت دوار الشمس','الجود'], 22, 'kfm_aljoud_sunflower_oil||', true),

-- Biscuits
('5c7f1214-ff2a-4bc3-b03d-8c4e9c16581e', 'Kuwait Flour Mills', 'Digestive Biscuits', 'بسكويت دايجستيف', 'डाइजेस्टिव बिस्किट', 'డైజెస్టివ్ బిస్కెట్లు', 'ڈائجسٹو بسکٹ', 'Digestive Biscuits',
 'डाइजेस्टिभ बिस्कुट', 'Biskuit Digestive', 'ඩයිජෙස්ටිව් බිස්කට්', 'ዲጀስቲቭ ብስኩት', 'Biscuits digestifs', 'Digestive biscuits',
 null, 'box', '🍪', 'https://uwouqetlzwvnlrirrhbh.supabase.co/storage/v1/object/public/product-images/kfm_biscuits_digestive.webp',
 array['kfm','kuwait flour mills','digestive biscuits','بسكويت دايجستيف'], 23, 'kfm_biscuits_digestive||', true),

('5c7f1214-ff2a-4bc3-b03d-8c4e9c16581e', 'Kuwait Flour Mills', 'Totally Bran Biscuits', 'بسكويت توتالي بران', 'टोटली ब्रान बिस्किट', 'టోటల్లీ బ్రాన్ బిస్కెట్లు', 'ٹوٹلی برین بسکٹ', 'Totally Bran Biscuits',
 'टोटल्ली ब्रान बिस्कुट', 'Biskuit Totally Bran', 'ටෝටලි බ්‍රැන් බිස්කට්', 'ቶታሊ ብራን ብስኩት', 'Biscuits Totally Bran', 'Totally Bran biscuits',
 null, 'box', '🍪', 'https://uwouqetlzwvnlrirrhbh.supabase.co/storage/v1/object/public/product-images/kfm_biscuits_totally_bran.webp',
 array['kfm','kuwait flour mills','bran biscuits','بسكويت بران','توتالي'], 24, 'kfm_biscuits_totally_bran||', true),

('5c7f1214-ff2a-4bc3-b03d-8c4e9c16581e', 'Kuwait Flour Mills', 'Digestive Biscuits (No Added Sugar)', 'دايجستيف بدون سكر مضاف', 'डाइजेस्टिव बिस्किट (बिना चीनी)', 'డైజెస్టివ్ బిస్కెట్లు (చక్కెర లేకుండా)', 'ڈائجسٹو بسکٹ (بغیر چینی)', 'Digestive Biscuits (Walang Idinagdag na Asukal)',
 'डाइजेस्टिभ बिस्कुट (चिनी नभएको)', 'Biskuit Digestive (Tanpa Tambahan Gula)', 'ඩයිජෙස්ටිව් බිස්කට් (සීනි රහිත)', 'ዲጀስቲቭ ብስኩት (ያለ ተጨማሪ ስኳር)', 'Biscuits digestifs (sans sucre ajouté)', 'Digestive biscuits (sukli ɖě)',
 null, 'box', '🍪', 'https://uwouqetlzwvnlrirrhbh.supabase.co/storage/v1/object/public/product-images/kfm_biscuits_digestive_nosugar.webp',
 array['kfm','kuwait flour mills','digestive biscuits','no added sugar','دايجستيف','بدون سكر'], 25, 'kfm_biscuits_digestive_nosugar||', true),

('5c7f1214-ff2a-4bc3-b03d-8c4e9c16581e', 'Kuwait Flour Mills', 'TIK Salty Biscuits', 'بسكويت مالح تيك', 'टीआईके सॉल्टी बिस्किट', 'టిఐకె సాల్టీ బిస్కెట్లు', 'ٹی آئی کے سالٹی بسکٹ', 'TIK Salty Biscuits',
 'टिक नुनिलो बिस्कुट', 'Biskuit Asin TIK', 'TIK ලුණු බිස්කට්', 'TIK ጨው ብስኩት', 'Biscuits salés TIK', 'TIK biscuits jinjin',
 null, 'box', '🍪', 'https://uwouqetlzwvnlrirrhbh.supabase.co/storage/v1/object/public/product-images/kfm_biscuits_tik_salty.webp',
 array['kfm','kuwait flour mills','tik','salty biscuits','بسكويت مالح','تيك'], 26, 'kfm_biscuits_tik_salty||', true);

commit;
