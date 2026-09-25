-- First real (non-flyer) product photo, sent by the owner and processed by
-- Claude (background removed, cropped, converted to webp) — see
-- 20260925093000_product_images_admin_write.sql for the upload path.
-- Kuwait Flour Mills & Bakeries Co. (KFM), a Kuwaiti bakery brand, on the
-- existing "Biscuits" generic.

begin;

insert into products (
  category_id, brand, name_en, name_ar, name_hi, name_te, name_ur, name_fil,
  name_ne, name_id, name_si,
  size, unit, icon, image_url, search_keywords, sort_order, natural_key, is_active
) values (
  '4ff2f562-02e2-4ee5-9d19-3baad6681230', 'Kuwait Flour Mills', 'Biscuits', 'بسكويت', 'बिस्किट', 'బిస్కెట్లు', 'بسکٹ', 'Biskwit',
  'बिस्कुट', 'Biskuit', 'බිස්කට්',
  null, 'pack', '🍪', 'https://uwouqetlzwvnlrirrhbh.supabase.co/storage/v1/object/public/product-images/biscuits_kfm_lemon_sandwich.webp',
  array['kfm','kuwait flour mills','lemon sandwich','lemon biscuit','ليمون ساندوتش'], 238, 'biscuits|kuwait flour mills|', true
);

commit;
