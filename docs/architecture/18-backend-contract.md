# 18 — Backend Contract (Phase 12)

**No native app is built here.** Phase 12's instruction is explicit: do not
build them, validate the web application first. What this document does is
make the backend's contract legible, so that when a native client is
written it consumes the same API rather than inventing a parallel one — and
so that anyone changing an RPC can see who else depends on it.

The whole surface is Supabase: PostgREST over the tables for reads, and
Postgres functions for every write. There is no bespoke API server to
build, and a native client needs no new endpoint.

## 1. The rule a native client must not break

**Authorization is in Postgres, not in the client.** Every rule in
`10-security-model.md` is enforced by RLS and by each function's own
`auth.uid()` check. A native client that skips a screen, calls an RPC
directly, or is decompiled and modified gets exactly the same refusals the
web app does.

The corollary matters more: **a native client must never be given the
service role key.** It bypasses every policy. The only holder of that key
is `catalog-import/`, run from a laptop.

## 2. Reads (PostgREST, scoped by RLS)

| Table | Who sees what |
|---|---|
| `categories`, `products` | everyone, including signed-out — public reference data, no prices |
| `users` | own row only |
| `households` | active members |
| `household_members` | own rows, plus the full roster for Owner/Member |
| `household_invitations` | Owner only |
| `shopping_lists`, `shopping_list_items` | active members; Owner/Member see all, a Worker sees only lists they created |
| `product_usage_stats` | own rows |
| `notifications` | own rows |

No table has a client write policy except `users` (own row). Every other
mutation goes through §3.

## 3. Writes (RPC). Every one is `SECURITY DEFINER` and checks `auth.uid()`

### Household and membership — Phase 4

| Function | Args | Returns | Caller |
|---|---|---|---|
| `create_household` | `p_name` | `uuid` | any signed-in user |
| `create_invitation` | `p_household_id, p_role, p_expires_in_days?` | row | Owner |
| `revoke_invitation` | `p_invitation_id` | — | Owner |
| `preview_invitation` | `p_code` | `{household_name, role}` or 0 rows | any signed-in user |
| `accept_invitation` | `p_code` | `uuid` | any signed-in user |
| `remove_household_member` | `p_household_id, p_user_id` | — | Owner |
| `get_household_members` | `p_household_id` | roster | Owner/Member |

### Catalogue — Phase 5

| Function | Args | Returns |
|---|---|---|
| `search_products` | `p_query, p_limit?` | products, all 9 languages + brand + transliteration |
| `get_frequent_products` | `p_limit?` | the caller's most-chosen products |

### The worker's list — Phase 6

| Function | Args | Returns |
|---|---|---|
| `get_or_create_draft_list` | `p_household_id, p_language?` | `uuid` — idempotent, one open draft per person |
| `set_list_item` | `p_list_id, p_product_id, p_quantity?, p_note?` | `uuid` — upsert, **absolute** quantity |
| `remove_list_item` | `p_list_id, p_product_id` | `boolean` |
| `send_list` | `p_list_id` | `timestamptz` |

### The household's checklist — Phase 7

| Function | Args | Returns |
|---|---|---|
| `get_household_lists` | `p_household_id, p_list_id?, p_limit?` | lists + sender name + progress |
| `mark_list_viewed` | `p_list_id` | `timestamptz` |
| `set_purchase_status` | `p_item_id, p_status` | item row — Owner/Member only |
| `set_list_completed` | `p_list_id, p_completed?` | list row |

### Notifications — Phase 8

| Function | Args | Returns |
|---|---|---|
| `mark_notifications_read` | `p_ids?` | `int` |
| `set_notification_preference` | `p_type, p_enabled` | `jsonb` |

Not callable by any client: `assert_own_draft`, `assert_can_work_list`,
`notify_list_status_change`, `handle_new_user`, `expire_stale_invitations`,
`generate_invitation_code`, `products_refresh_search_text`. `anon` can
execute **nothing**.

## 4. Error codes

Functions `raise exception` with a bare identifier, so a client can map to
a translated message without parsing prose. The full set is mirrored in
`lib/household/errors.ts` and `lib/list/errors.ts`; a native client should
mirror the same list.

`AUTH_REQUIRED`, `FORBIDDEN`, `NOT_OWNER`, `INVALID_NAME`, `INVALID_ROLE`,
`INVALID_CODE`, `INVITATION_NOT_PENDING`, `INVITATION_EXPIRED`,
`INVITATION_NOT_FOUND`, `MEMBER_NOT_FOUND`, `CANNOT_REMOVE_OWNER`,
`LIST_NOT_FOUND`, `LIST_NOT_DRAFT`, `LIST_NOT_SENT`, `LIST_ARCHIVED`,
`LIST_EMPTY`, `INVALID_QUANTITY`, `INVALID_STATUS`, `PRODUCT_NOT_FOUND`,
`ITEM_NOT_FOUND`, `NOT_HOUSEHOLD_SIDE`, `INVALID_TYPE`.

`PHONE_REQUIRED` is the one code a client never calls an RPC to receive:
it comes from the `auth.users` insert trigger, so it surfaces at signup
through Supabase Auth rather than through PostgREST. A native client that
offers any non-phone sign-in method will meet it
(`06-auth-otp-flow.md` §5A).

`LIST_NOT_FOUND` deliberately covers both "does not exist" and "belongs to
someone else" — probing ids must reveal nothing. A native client must not
try to be more specific than the database was.

## 5. Behaviours a native client has to preserve

These are properties of the *product*, not of the web implementation, and
re-implementing a client is exactly when they get lost.

- **Quantities are absolute, not increments.** `set_list_item` takes the
  quantity to end up with. This is what makes an impatient double-tap on a
  slow connection idempotent instead of a double-add.
- **Category is a snapshot.** Group by `shopping_list_items.category_id`,
  never by a live join to `products.category_id`. A catalogue re-import
  must not reshuffle a list that has already been sent (§16A.4).
- **Progress is item counts.** `purchased / total`, never
  quantity-weighted: ten units of one product is one checklist item.
- **Ordering is `categories.sort_order`, then the item's own `sort_order`.**
  Both are asserted unique, which is what makes the same list render
  identically on two devices.
- **A sent list is frozen.** No client may offer editing of quantity, note
  or product after sending — and none can, because no RPC accepts it.
- **Never cache an authenticated response across sessions.** These are
  shared phones.

## 6. What is portable today, measured

Audited by checking every module's imports rather than by assumption
(`grep` for `next/*`, `server-only`, `react`).

**Portable as-is — no framework coupling at all (13 modules):**

```text
lib/i18n/{config,cookie,messages}.ts     locale metadata, 9 locale files, lookup
lib/catalog/localized.ts                 pick the right name column, format brand·size
lib/{household,list}/errors.ts           the error-code contract in §4
lib/supabase/{client,database.types,isConfigured}.ts
lib/auth/{phone,nextPath,syncPreferredLanguage}.ts
lib/branding.ts
```

These are the natural first `packages/` extraction and would work unchanged
in React Native. `lib/i18n/cookie.ts` is the one to look at twice — its
logic is portable but its storage is `document.cookie`, which a native
client would swap for its own key-value store.

**Server-only — Next.js runtime, must be reimplemented per client
(12 modules):** everything in `lib/*/queries.ts`, `lib/*/actions.ts`,
`lib/household/guard.ts`, `lib/supabase/{server,updateSession}.ts`.

That is not a portability problem, and the split is the point: these files
are *thin wrappers* around the RPCs in §3. They contain no business rules —
the rules are in Postgres, which is why a native client can rewrite this
layer freely and still get identical behaviour, including identical
refusals.

**UI components** are all Next/React-coupled (`next/link`,
`next/navigation`). A native client rebuilds these; the design tokens in
`app/globals.css` and `docs/design/BRAND.md` carry over as values.

## 7. The two future apps

Both consume everything above. Neither needs a backend change.

- **HomeList Worker** — login, join a household, catalogue, build and send
  lists, notifications, history. §3 Phases 4/5/6 plus notifications.
- **HomeList Home** — dashboard, lists and checklist, members,
  invitations, settings. §3 Phases 4/7 plus notifications.

One backend, one database, one authentication system — which is already
true of the web app, because both experiences are served from it today.
