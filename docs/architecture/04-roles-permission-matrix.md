# 04 — User Roles & Permission Matrix

## 1. Two role fields — and why that's intentional, not a bug

The master plan puts a `role` column on **both** `users` (Section 8) and
`household_members` (Section 10). Phase 0 formalizes this as two distinct
concepts rather than collapsing them, because a single global role cannot
correctly express "Owner of my own household, Worker in someone else's" —
an edge case the schema should not structurally forbid even though V1 UI
doesn't need to actively support switching between them.

| Field | Meaning | Used for |
|---|---|---|
| `users.role` | The person's **primary persona** at signup (what onboarding flow they took: created a household → `owner`, joined as trusted family → `member`, joined via a worker invitation → `worker`). | UI defaulting only: which onboarding screen to show again, and — importantly — which **language set** is offered (workers choose from all 9 languages; owners/members choose Arabic or English only, per Section 21). |
| `household_members.role` | The role granted **for that specific household**, set at invitation-acceptance time. | The **sole source of truth for authorization**. Every RLS policy and RPC permission check reads this table, scoped by `household_id`, never `users.role`. |

**This is flagged as a decision requiring your confirmation** — see
`14-technical-risks-decisions.md` item 1. The recommendation above is the
Phase 0 default; if you'd rather collapse to a single role (simpler, but
forecloses the future multi-household edge case), say so before Phase 3/4.

## 2. Roles

- **Owner** — created the household. Exactly one active Owner per
  household in V1 (no co-owners, no ownership transfer in V1 — see
  `14-technical-risks-decisions.md`).
- **Member** — trusted household adult (spouse, adult child, etc.),
  added by the Owner.
- **Worker** — domestic worker, added by the Owner via invitation.

## 3. Permission matrix

| Action | Owner | Member | Worker |
|---|:---:|:---:|:---:|
| Create a household | ✅ (becomes Owner) | — | — |
| View household name/settings | ✅ | ✅ | ❌ |
| Edit household name/settings | ✅ | ❌ | ❌ |
| Delete/archive household | ✅ | ❌ | ❌ |
| View household member/worker list | ✅ | ✅ | ❌ |
| Create invitation (worker or member) | ✅ | ❌ | ❌ |
| Revoke a pending invitation | ✅ | ❌ | ❌ |
| Accept an invitation (join a household) | — | ✅ | ✅ |
| Remove a member | ✅ | ❌ | ❌ |
| Remove a worker | ✅ | ❌ | ❌ |
| Leave a household voluntarily | ⚠️ blocked while sole Owner (must transfer/delete — not built in V1) | ✅ | ✅ |
| Browse product catalog | ✅ | ✅ | ✅ |
| Create/build a shopping list (draft) | ✅ | ✅ | ✅ |
| Send a shopping list | ✅ | ✅ | ✅ |
| Edit a list's requested items while `draft` | creator only | creator only | creator only |
| Edit a list's requested items after `sent` | ❌ | ❌ | ❌ |
| View any list belonging to the household | ✅ | ✅ | ❌ (own lists only, master plan Section 15) |
| View own previously-sent lists | ✅ | ✅ | ✅ |
| Mark a list item purchased/unavailable | ✅ | ✅ | ❌ |
| Mark a whole list completed | ✅ | ✅ | ❌ |
| Set own preferred language | ✅ (Arabic/English only) | ✅ (Arabic/English only) | ✅ (any of 9) |
| Search for households | ❌ (not possible for anyone — no such feature exists) | ❌ | ❌ |

Rows marked "creator only" or "own lists only" additionally require
household membership — a Worker in Household A can never touch a list in
Household B regardless of any other permission, and this is enforced at
the RLS/RPC layer, not the UI (`10-security-model.md`).

Two matrix entries are explicit Phase 0 recommendations, not restatements
of the master plan (which says "permissions **can include**" for Member) —
flagged for your confirmation in `14-technical-risks-decisions.md` items 2
and 3:

- **Members can create and send shopping lists**, same as Workers.
- **Members have the same purchase-checklist rights as Owner** (check off
  items, mark unavailable, mark list completed) — only household
  management (invite/remove/settings) is Owner-exclusive.

## 4. Status gating

`household_members.status = 'removed'` immediately revokes every
permission above for that household — enforced because every RLS policy
filters on `status = 'active'`, not merely on role. There is no
UI-only removal.
