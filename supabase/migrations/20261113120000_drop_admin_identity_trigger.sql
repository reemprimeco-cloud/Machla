-- Machla — retire the stopgap admin-identity trigger.
--
-- 20261112120000_block_admin_identity_claim.sql blocked any row from
-- newly acquiring the operator's email/phone, because admin status was
-- derived from those self-editable columns. 20261112130000 moved that
-- decision to public.admin_operators, and the app-side gate
-- (lib/admin/guard.ts) now asks is_admin_operator() too — deployed to
-- production before this ran. Those columns confer nothing any more, so
-- the trigger protects nothing, and left in place it would refuse the
-- real operator adding her own email through completeAccountWithEmailAction.

begin;

drop trigger if exists prevent_admin_identity_claim on public.users;
drop function if exists public.prevent_admin_identity_claim();

commit;
