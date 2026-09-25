-- The KFM Lemon Sandwich biscuit (20260925094500_kfm_lemon_sandwich_biscuit.sql)
-- was filed under Snacks & Sweets before the dedicated "kfm" category
-- existed (20260925095000_tamween_and_kfm_categories.sql). Move it now
-- that the category is live; future KFM products the owner uploads
-- through the admin photo tool land here directly.

begin;

update products
set category_id = '5c7f1214-ff2a-4bc3-b03d-8c4e9c16581e',
    sort_order = 1
where natural_key = 'biscuits|kuwait flour mills|';

commit;
