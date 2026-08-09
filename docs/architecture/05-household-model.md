# 05 — Household / Member / Worker Relationship Model

## 1. Shape

```text
Household ("Reem's Home")
│
├── Owner (exactly one, active)          — Reem
│
├── Members (zero or more)               — Husband, Adult Daughter
│
└── Workers (zero or more)               — Worker A, Worker B
```

Modeled as a single join table, `household_members(household_id, user_id,
role, status)`, not three separate tables — Owner/Member/Worker are values
of one `role` column, not distinct entities. This keeps queries ("who is
in this household") to one table and keeps role changes (e.g. promoting a
Member — not built in V1, but should not require a schema change) cheap.

## 2. Invariants

1. **One active Owner per household.** Enforced by a partial unique index
   (`03-database-schema.md`). No co-ownership, no ownership transfer in
   V1 — see `14-technical-risks-decisions.md`.
2. **A household is never empty of its Owner.** There is no "leave
   household" path for the sole active Owner in V1; that requires either
   deleting the household or a future ownership-transfer feature.
3. **Zero or more Members and Workers**, unbounded — the master plan is
   explicit that "the system must NOT assume one household = one worker"
   (Section 14). No V1 cap is imposed at the schema level; a soft UI/UX
   sanity cap can be added later if needed.
4. **A `household_members` row is never hard-deleted.** Removing someone
   sets `status = 'removed'`. This preserves `shopping_lists.
   created_by_user_id` and `shopping_list_items.purchased_by_user_id`
   history — the owner can always answer "who sent this list" and "who
   bought this item" even after someone is removed. Immediate loss of
   access is enforced by RLS checking `status = 'active'`, not by row
   deletion.
5. **A user can belong to more than one household** at the schema level
   (no uniqueness constraint on `user_id` alone). V1 UI is not required to
   build a household-switcher; see item 5 in
   `14-technical-risks-decisions.md`.

## 3. Lifecycle

```text
create_household(name)                      [RPC, any authenticated user]
        │
        ▼
household row created; household_members row
  (role='owner', status='active') created atomically
        │
        ▼
Owner calls create_invitation(household_id, role)  → household_invitations row
        │
        ▼
Invitee redeems it via accept_invitation(code)      → household_members row
  (role=invitation.role, status='active') created atomically;
  invitation marked accepted
        │
        ▼
Owner may later call remove_member(household_id, user_id)
  → household_members.status = 'removed'  (soft delete, access revoked immediately)
```

Both `create_household` and `accept_invitation` are Postgres RPC
functions (not raw table inserts from the client) so the "create exactly
one owner row" and "atomically consume a single-use invitation" invariants
can't be bypassed by a malformed client request. Full detail in
`07-invitation-flow.md` and `10-security-model.md`.

## 4. Why not a "workers" table separate from "members"?

A separate `household_workers` table was considered and rejected for V1:
it would duplicate the household-membership concept (join semantics,
removal semantics, RLS policies) for no behavioral gain, since Owner /
Member / Worker differ only in **permissions**, not in the shape of their
relationship to a household. The single-table-with-role-column design
also makes a future role change (e.g., if the product ever needs a
"promote Worker to Member") a one-row `UPDATE` instead of a migration
between tables.

## 5. Relationship to shopping lists

Every `shopping_lists` row has exactly one `household_id` and one
`created_by_user_id`. Because `created_by_user_id` references `users.id`
(not `household_members.id`), a list's authorship survives even if the
creator is later removed from the household — the Owner can still see
"Worker B (removed) sent this list on [date]."
