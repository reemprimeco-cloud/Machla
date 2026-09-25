-- The owner offered an AI-generated "photo catalog" for the 116 Tamween
-- items, but it's unusable: the packaging text on it is garbled AI
-- hallucination ("Suger Flour", "Comt Oil", "Paosun Cheese"), so it would
-- misidentify specific regulated grocery items, and several cells mimic
-- real Kuwaiti brand trade dress (KDD's blue carton, the pink chicken
-- bag) closely enough to raise the same trademark concern as the flyer
-- earlier. Declined that source entirely.
--
-- Instead: 114 of the 116 Tamween items are generic product types this
-- catalog already has real, licensed photography for elsewhere (rice,
-- sugar, chicken, milk, infant formula, fish...) — same reuse pattern as
-- every brand-variant row in this table. Only Corn Flakes (2 rows) has no
-- existing match and stays icon-only.

begin;

update products set image_url = 'https://uwouqetlzwvnlrirrhbh.supabase.co/storage/v1/object/public/product-images/basmati_rice.webp' where natural_key in ('tamween_001||');
update products set image_url = 'https://uwouqetlzwvnlrirrhbh.supabase.co/storage/v1/object/public/product-images/sugar.webp' where natural_key in ('tamween_002||');
update products set image_url = 'https://uwouqetlzwvnlrirrhbh.supabase.co/storage/v1/object/public/product-images/lentils_red.webp' where natural_key in ('tamween_003||');
update products set image_url = 'https://uwouqetlzwvnlrirrhbh.supabase.co/storage/v1/object/public/product-images/sunflower_oil.webp' where natural_key in ('tamween_004||');
update products set image_url = 'https://uwouqetlzwvnlrirrhbh.supabase.co/storage/v1/object/public/product-images/milk_powder.webp' where natural_key in ('tamween_005||');
update products set image_url = 'https://uwouqetlzwvnlrirrhbh.supabase.co/storage/v1/object/public/product-images/tomato_paste.webp' where natural_key in ('tamween_006||', 'tamween_007||');
update products set image_url = 'https://uwouqetlzwvnlrirrhbh.supabase.co/storage/v1/object/public/product-images/baby_cereal.webp' where natural_key in ('tamween_008||');
update products set image_url = 'https://uwouqetlzwvnlrirrhbh.supabase.co/storage/v1/object/public/product-images/infant_formula.webp' where natural_key in ('tamween_009||', 'tamween_010||', 'tamween_011||', 'tamween_012||', 'tamween_013||', 'tamween_014||', 'tamween_015||', 'tamween_016||', 'tamween_017||', 'tamween_018||', 'tamween_019||', 'tamween_020||', 'tamween_021||', 'tamween_022||', 'tamween_023||', 'tamween_024||', 'tamween_025||', 'tamween_026||', 'tamween_027||', 'tamween_028||', 'tamween_029||', 'tamween_030||', 'tamween_031||', 'tamween_032||', 'tamween_033||', 'tamween_034||', 'tamween_035||', 'tamween_036||', 'tamween_037||', 'tamween_038||', 'tamween_039||', 'tamween_040||', 'tamween_041||', 'tamween_042||', 'tamween_043||', 'tamween_044||', 'tamween_045||', 'tamween_046||', 'tamween_047||', 'tamween_048||', 'tamween_049||', 'tamween_050||', 'tamween_051||', 'tamween_052||', 'tamween_053||', 'tamween_054||', 'tamween_055||', 'tamween_056||', 'tamween_057||', 'tamween_058||', 'tamween_059||');
update products set image_url = 'https://uwouqetlzwvnlrirrhbh.supabase.co/storage/v1/object/public/product-images/frozen_chicken.webp' where natural_key in ('tamween_060||', 'tamween_061||', 'tamween_062||', 'tamween_063||', 'tamween_064||', 'tamween_065||', 'tamween_066||', 'tamween_067||', 'tamween_068||', 'tamween_069||', 'tamween_070||', 'tamween_071||', 'tamween_072||', 'tamween_073||', 'tamween_074||', 'tamween_075||', 'tamween_076||', 'tamween_077||', 'tamween_078||', 'tamween_079||', 'tamween_080||', 'tamween_081||', 'tamween_082||', 'tamween_083||', 'tamween_084||', 'tamween_085||', 'tamween_086||', 'tamween_087||', 'tamween_088||', 'tamween_089||');
update products set image_url = 'https://uwouqetlzwvnlrirrhbh.supabase.co/storage/v1/object/public/product-images/milk_fresh.webp' where natural_key in ('tamween_090||', 'tamween_091||', 'tamween_092||', 'tamween_093||', 'tamween_094||', 'tamween_095||', 'tamween_096||', 'tamween_097||', 'tamween_098||');
update products set image_url = 'https://uwouqetlzwvnlrirrhbh.supabase.co/storage/v1/object/public/product-images/milk_long_life.webp' where natural_key in ('tamween_099||');
update products set image_url = 'https://uwouqetlzwvnlrirrhbh.supabase.co/storage/v1/object/public/product-images/frozen_shrimp.webp' where natural_key in ('tamween_102||', 'tamween_103||', 'tamween_113||');
update products set image_url = 'https://uwouqetlzwvnlrirrhbh.supabase.co/storage/v1/object/public/product-images/frozen_fish.webp' where natural_key in ('tamween_104||');
update products set image_url = 'https://uwouqetlzwvnlrirrhbh.supabase.co/storage/v1/object/public/product-images/fish_zubaidi.webp' where natural_key in ('tamween_105||', 'tamween_106||');
update products set image_url = 'https://uwouqetlzwvnlrirrhbh.supabase.co/storage/v1/object/public/product-images/salmon.webp' where natural_key in ('tamween_107||', 'tamween_108||');
update products set image_url = 'https://uwouqetlzwvnlrirrhbh.supabase.co/storage/v1/object/public/product-images/minced_beef.webp' where natural_key in ('tamween_109||');
update products set image_url = 'https://uwouqetlzwvnlrirrhbh.supabase.co/storage/v1/object/public/product-images/mutton.webp' where natural_key in ('tamween_110||');
update products set image_url = 'https://uwouqetlzwvnlrirrhbh.supabase.co/storage/v1/object/public/product-images/chicken_breast.webp' where natural_key in ('tamween_111||', 'tamween_112||');
update products set image_url = 'https://uwouqetlzwvnlrirrhbh.supabase.co/storage/v1/object/public/product-images/tilapia.webp' where natural_key in ('tamween_114||');
update products set image_url = 'https://uwouqetlzwvnlrirrhbh.supabase.co/storage/v1/object/public/product-images/oats.webp' where natural_key in ('tamween_115||', 'tamween_116||');

commit;
