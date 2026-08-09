# 10 — Security Model

## 1. Core principle

**Authorization lives in Postgres, not in the UI.** Every table that
holds household-scoped or user-scoped data has Row Level Security (RLS)
enabled, and every mutation that has business rules beyond "the owner of
this row" goes through a `SECURITY DEFINER`-style Postgres RPC function
rather than a raw client `INSERT`/`UPDATE`. The Next.js route groups add
a second layer of guarding (`08-route-map.md` §3), but that is
defense-in-depth — it is never the only check.

## 2. RLS helper

A single security-definer SQL function backs almost every policy:

```sql
create or replace function is_active_member(p_household_id uuid, p_min_roles text[] default null)
returns boolean
language sql security definer stable as $$
  select exists (
    select 1 from household_members
    where household_id = p_household_id
      and user_id = auth.uid()
      and status = 'active'
      and (p_min_roles is null or role = any(p_min_roles))
  );
$$;
```

Every policy below is expressed in terms of this function so the
membership/role check is written once and audited once.

## 3. Table-by-table policy summary

| Table | SELECT | INSERT / UPDATE / DELETE |
|---|---|---|
| `users` | own row only (`id = auth.uid()`); also readable by fellow active members of a shared household **only via a restricted view/RPC** that exposes `id, display_name, role` — never phone number, to other members | own row only |
| `households` | `is_active_member(id)` | none directly — only via `create_household`/settings-update RPCs, `role='owner'` enforced inside |
| `household_members` | **split as of Phase 4** — `user_id = auth.uid()` (everyone can read their own membership rows; the root route needs this to pick an experience) plus `is_active_member(household_id, array['owner','member'])` for the full roster. The original single `is_active_member(household_id)` policy contradicted the permission matrix, which denies Workers the member list | **no direct client writes** — only via `create_household`, `accept_invitation`, `remove_household_member` RPCs |
| `household_invitations` | **owner only** (`is_active_member(household_id, array['owner'])`) — an invitee never reads this table directly, only via `preview_invitation`/`accept_invitation` RPCs which return the minimal `{household_name, role}` | insert/update only via `create_invitation`/`revoke_invitation` RPCs, owner-checked inside |
| `categories`, `products` | public (`true`) — not sensitive, needed pre-auth-context in some flows | **no client writes at all** — service role only (import pipeline) |
| `product_usage_stats` | own rows only | only via `record_product_selection` RPC |
| `shopping_lists` | `is_active_member(household_id)` | INSERT via `create_shopping_list` RPC (creator = auth.uid()); status transitions (`sent`, `viewed`, `completed`) via dedicated RPCs, each checking role and current status |
| `shopping_list_items` | `is_active_member(household_id)` via join to `shopping_lists` | **split by RPC**, see §4 below — never a raw client `UPDATE` |

## 4. The requested-vs-purchased RPC split (core to the checklist feature)

This is the mechanism that makes the master plan's acceptance test hold
structurally, not just by UI convention:

```sql
-- Only the list's creator, only while the list is still a draft.
create function update_requested_item(p_item_id uuid, p_quantity numeric,
                                       p_unit text, p_note text)
returns void language plpgsql security definer as $$
  -- verifies: auth.uid() = shopping_lists.created_by_user_id
  --           and shopping_lists.status = 'draft'
  -- touches only: quantity, unit, note, updated_at
$$;

-- Only an active Owner/Member of the household, any list status from 'sent' on.
create function set_purchase_status(p_item_id uuid, p_status text)
returns void language plpgsql security definer as $$
  -- verifies: is_active_member(household_id, array['owner','member'])
  -- verifies: p_status in ('pending','purchased','unavailable')
  -- touches only: purchase_status, purchased_at, purchased_by_user_id, updated_at
$$;
```

Because these are the *only* two write paths into
`shopping_list_items` (no RLS `UPDATE` policy is granted to
`authenticated` directly on that table), it is structurally impossible for
a Worker to call `set_purchase_status`, and structurally impossible for
an Owner marking an item "purchased" to also change its `quantity` in the
same call — which is exactly the two guarantees the acceptance test in
master plan Section 16A.12 requires. See
`13-shopping-list-grouping-checklist.md` for the full feature spec.

## 5. Threat scenarios and how the model answers each

| Scenario (master plan Section 15 / Phase 10) | Mitigation |
|---|---|
| Worker discovers other households | No `SELECT` policy ever exposes a household to a non-member; no search/list-all endpoint exists for households |
| Worker joins without a valid invitation | `accept_invitation` re-validates `status='pending'` and `expires_at` inside the transaction; no other insert path into `household_members` exists |
| Worker A views Household B's lists | `shopping_lists`/`shopping_list_items` SELECT policies require `is_active_member(household_id)`; Worker A has no active membership row for Household B |
| Worker views another worker's private data | Workers only ever see their **own** created lists client-side, and RLS additionally would allow same-household visibility only for Owner/Member roles per the permission matix — worker-to-worker cross-visibility within one household is deliberately not granted in V1 (see `04-roles-permission-matrix.md`) |
| Removed worker keeps access | `status='removed'` is checked by `is_active_member` on every policy — access is gone the instant the row updates, no cache/session invalidation needed since the check is server-side per-request |
| Frontend route manipulation bypasses checks | Irrelevant to data access — RLS is enforced by Postgres itself regardless of which URL the request came from |
| Single-use invitation reused / raced | `accept_invitation` takes a row lock (`SELECT ... FOR UPDATE`) on the invitation before checking/consuming it |
| Owner over-writes a worker's requested quantity while "marking purchased" | Not possible via `set_purchase_status` — it has no `quantity` parameter at all |
| Worker edits their list after sending it, to make it look like they asked for something else | `update_requested_item` checks `shopping_lists.status = 'draft'`; once `sent`, no requested-field write path remains for anyone |

## 5A. Verification (Phase 4)

Every scenario in §5 that Phase 4 can reach — cross-household discovery,
joining without an invitation, invitation reuse, revocation, removed-member
access, and direct-write bypass — is asserted in
`supabase/tests/01_phase4_households_test.sql`, run against a real
PostgreSQL instance via `supabase/tests/run-tests.sh` (72 assertions).
The remaining scenarios concern shopping lists and land with Phases 6-8.

Two things make those tests meaningful rather than decorative:

- They run **as the `authenticated` role**, not as the superuser the
  migrations execute as. A superuser bypasses RLS entirely, so a suite
  that skipped `set role` would pass no matter how wrong the policies
  were.
- **`UPDATE`/`DELETE` blocked by RLS raise nothing** — they simply match
  zero rows. So "this write must be impossible" is asserted by re-reading
  the row and proving it unchanged, not by expecting an error. Expecting
  an error there would pass vacuously.

The suite was validated by negative control: removing the owner check
from `create_invitation` makes it fail on the corresponding assertion,
confirming it detects a genuinely broken authorization boundary.

## 5B. Function EXECUTE privileges (the RPC surface itself)

RLS governs table access; a separate, easily-missed layer governs who may
*call* a function at all. On Supabase these come apart in a way worth
stating explicitly, because getting it wrong shipped a real vulnerability
in Phase 4:

- Supabase grants `EXECUTE` on functions in `public` **directly to the
  `anon` and `authenticated` roles**, in addition to PostgreSQL's own
  implicit grant to `PUBLIC`. `has_function_privilege()` is true if the
  privilege arrives by *either* path, so `revoke ... from public` alone
  leaves a function callable. Every revoke must name `public`, `anon`,
  and (where applicable) `authenticated`.
- The consequence: `expire_stale_invitations()` — the one function with
  no internal `auth.uid()` check, because it is a maintenance sweep —
  was reachable at `/rest/v1/rpc/expire_stale_invitations` by anyone
  holding the anon key, which ships in the browser bundle. Calling it
  would mark every pending invitation in every household as expired.
  Fixed in `*_phase4_function_grants.sql`; asserted in
  `supabase/tests/02_function_grants_test.sql`.

The intended end state, which that test enforces:

| Function | anon | authenticated |
|---|:---:|:---:|
| `create_household`, `create_invitation`, `revoke_invitation`, `preview_invitation`, `accept_invitation`, `remove_household_member`, `get_household_members` | ✗ | ✓ (each checks `auth.uid()` and role internally — that is what makes exposing them safe) |
| `is_active_member` | ✗ | ✓ (required, or every RLS policy that calls it fails) |
| `normalize_invitation_code` | ✗ | ✓ |
| `expire_stale_invitations`, `handle_new_user`, `generate_invitation_code` | ✗ | ✗ (owner/`service_role`/trigger context only) |

Supabase's database linter will still report
`authenticated_security_definer_function_executable` for the seven
user-facing RPCs. That is expected and correct to leave: exposing a
`SECURITY DEFINER` function that authorizes internally is precisely the
design in §1. The linter cannot see the internal check.

Every function also pins `search_path` at definition time, so a caller
cannot influence name resolution inside a `SECURITY DEFINER` body.

## 6. Secrets

- The Supabase **service role** key is used only by the offline catalog
  import pipeline (`11-product-catalog-architecture.md`) and any future
  server-only admin scripts — never bundled into the Next.js client, never
  referenced in any `NEXT_PUBLIC_*` env var (master plan rule 29.14).
- The Next.js app uses only the Supabase **anon/publishable** key
  client-side; all sensitive logic is in RLS/RPC, so the anon key having
  broad read access to non-sensitive tables (`categories`, `products`) is
  intentional and safe.

## 7. Input validation

User-controlled input (phone number format, invitation code format,
quantity being a positive number, language code being one of the 9
supported values, note length) is validated both client-side (fast
feedback) and inside the relevant RPC function (authoritative) — never
trusted from the client alone (master plan rule 29.15).
