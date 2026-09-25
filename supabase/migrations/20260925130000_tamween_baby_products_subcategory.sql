-- "منتجات الأطفال" (Baby Products) as a subcategory inside Tamween —
-- Cerelac + every infant-formula brand/stage (52 items), grouped under
-- their own section header on the category page rather than mixed into
-- the flat Tamween list. is_active = false so this row never appears as
-- its own top-level tile in CategoryGrid (getCategories() only fetches
-- active rows) — it exists purely as a subcategory tag that
-- products.subcategory_id points at.

begin;

insert into categories (key, icon, sort_order, is_active, is_capture, name_en, name_ar, name_hi, name_te, name_ur, name_fil, name_ne, name_id, name_si, name_am, name_fr, name_fon)
values (
  'tamween_baby', '🍼', 9000, false, false,
  'Baby Products', 'منتجات الأطفال',
  'शिशु उत्पाद', 'శిశు ఉత్పత్తులు', 'بچوں کی مصنوعات', 'Produkto para sa Sanggol',
  'शिशु उत्पादन', 'Produk Bayi', 'ළදරු නිෂ්පාදන', 'የህጻናት ምርቶች', 'Produits pour bébés', 'Nudogbɛ Vi'
);

update products
set subcategory_id = (select id from categories where key = 'tamween_baby')
where category_id = (select id from categories where key = 'tamween')
  and natural_key = any (array(
    select 'tamween_' || lpad(n::text, 3, '0') || '||'
    from generate_series(8, 59) as n
  ));

commit;
