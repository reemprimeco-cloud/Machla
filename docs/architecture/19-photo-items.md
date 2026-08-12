# 19 — Photographed Items

The catalogue has 295 products. Kuwaiti households buy more than 295
things. When a worker cannot find what the house needs, they photograph
it, and the picture reaches the household as an item on the same list.

## 1. It is a list item, not a second channel

The obvious alternative was a separate "photos" inbox. It was rejected
because it would need its own send action, its own notification type, its
own read state and its own checklist — and the household would then shop
from two screens.

As a list item it inherits all of that unchanged: `send_list`, the
purchased/unavailable checklist, progress counting, notifications and
history already work, because none of them ask what an item *is*.

An item is therefore a product **or** a photograph, never both and never
neither, enforced by `shopping_list_items_product_xor_photo`.

## 2. The 16th category

§16A groups a list by `shopping_list_items.category_id` and orders by
`categories.sort_order`. Photographed items belong to a real category row
(`key = 'photo'`, `sort_order = 9000`) rather than to a null, so no
consumer needs a special case and the group sorts last.

`categories.is_capture` marks it. The worker's browse grid renders it as
an ordinary tile that opens the camera instead of a product list — which
is exactly how the feature was asked for: a section alongside the others.

> The first `sort_order` chosen was 900, which collided with a test
> fixture and was caught by the existing "active categories have unique
> `sort_order`" assertion. Worth knowing before adding a 17th.

## 3. Security

These photographs are taken inside someone's home. They are household
data, which makes the `product-images` bucket the wrong model — that one
is public precisely because the catalogue is world-readable.

| | `product-images` | `list-photos` |
|---|---|---|
| Public | yes | **no** |
| Who reads | everyone | active members of one household |
| Who writes | service role, offline | active members, from the browser |
| Lifetime | permanent | until the item is purchased (§5) |

**Authorization is the object path.** An object is
`<household_id>/<list_id>/<uuid>.jpg`, and the storage policies read the
first segment and apply `is_active_member()` — the same predicate that
decides who may read the list. A worker removed from a household loses
the photographs at the same instant they lose the lists, because both
answer to one function.

The household id is in the path because **the upload happens before the
item row exists**. There is nothing else to authorize against at that
moment.

**`add_photo_item` then re-checks the whole prefix**, household *and*
list. This is not redundant: the storage policy cannot see which list an
object was destined for, so without it a worker who belongs to two
households could attach one household's photograph to the other's list.
Both halves are needed, and each covers what the other cannot see.

**No service role key is involved.** The browser uploads straight into
the bucket, which is only safe because the policy authorizes the write —
and is the reason the key stays out of the web app's environment entirely
(`17-deployment.md` §2.2).

**Rendering uses signed URLs**, minted server-side per request with the
caller's own client, so RLS decides who gets one. They last an hour: long
enough not to expire mid-aisle, short enough that a URL copied out of the
page stops working the same day. Signed URLs deliberately do not go
through `next/image` — the optimizer would cache them past their expiry.

**Thumbnails open full-size on tap** (`components/photo/PhotoThumbnail.tsx`),
shared by the household checklist and both worker screens. A 40-56px crop
defeats the point of the feature — the picture has to actually be
recognisable — so the same component renders the small thumbnail as a
button and a full-screen overlay on tap, reusing the identical signed URL
rather than minting a second one. In the household checklist this required
splitting what used to be one big "tap anywhere to toggle purchased" row
into two toggle buttons flanking the photo, because a `<button>` cannot
contain another interactive element — the photo needed its own tap target
to open, not just decorate, the row.

## 4. What the SQL suite proves, and what it cannot

`supabase/tests/09_photo_items_test.sql` covers the RPCs, the XOR
constraint, the path binding, the own-draft gate and cross-household
isolation of the rows — 28 assertions, run as `authenticated`.

**It cannot cover the storage policies.** The harness is a plain
PostgreSQL instance with no `storage` schema, and the migrations skip the
bucket block accordingly. That is half the isolation story, so it is
verified against the live project instead, as `authenticated`:

| Caller | Objects visible | Wanted |
|---|---|---|
| worker, member of household A | 1 | 1 |
| owner of household A | 1 | 1 |
| owner of household B | 0 | 0 |
| the worker after removal from A | 0 | 0 |
| `anon` | refused outright | none |

The `anon` row is worth reading twice: it does not return zero rows, it
raises `permission denied for function is_active_member`. The policy
fails closed rather than evaluating to false, which is the desired
direction but not the usual one.

That probe ends by raising, so the whole transaction rolls back and the
project is left untouched — Supabase forbids `delete from
storage.objects`, so rolling back is the only clean way to run it.

## 5. Retention: the picture does not outlive its purpose

**A photograph answers one question — "is this the thing you meant?" —
and that question is settled when the item is ticked off.** The blob is
deleted at that moment.

This reversed a decision made one migration earlier.
`20260810140000_photo_items.sql` gave clients no DELETE policy, arguing
that a photograph on a sent list is a record of what was asked for. That
reasoning survives for *substitution* — there is still no UPDATE policy,
so a picture cannot be swapped after the fact — but it was wrong for
*retention*, which is a data-minimisation question rather than an
integrity one.

What is kept and what goes:

- **Kept:** the item row, its quantity, its note, its purchase status,
  and `photo_path` itself. The list remains a complete record of what was
  requested and what happened to it, and progress counts are unchanged.
- **Gone:** the image.

`photo_path` is kept rather than nulled because the XOR constraint
requires a photographed item to have one; `photo_deleted_at` marks that
the object behind it is gone, and the UI renders a placeholder rather
than a broken image.

Two triggers, because one is not enough:

1. **On purchase** — `setPurchaseStatusAction`, the normal path.
2. **On completion** — `setListCompletedAction` sweeps whatever is left.
   Without this, an item marked *unavailable*, or one whose purge failed
   on a flaky connection, would keep its photograph forever.

Both are best-effort: a failed purge must never make ticking an item off
fail, because the checklist is what the person is actually doing. The
sweep is the backstop, and `mark_photo_purged` is idempotent so the two
paths can overlap safely.

**Deletion cannot happen in Postgres.** Supabase blocks `delete from
storage.objects` outright (`storage.protect_delete`), so no trigger can
do it however convenient that would be. It is a Storage API call from the
server action, running with the caller's session — which is what the
DELETE policy authorizes.

## 6. Known gaps

- **Orphaned objects.** A worker who uploads and then abandons the screen
  leaves a blob with no row pointing at it. It is unreadable through the
  app and bounded by the 20-photo-per-list limit, but it is not yet swept.
  A periodic job comparing bucket contents against `photo_path` is the
  fix; it is not built.
- **`remove_photo_item` leaves the blob**, for the same reason — the
  function is `SECURITY DEFINER` SQL and cannot reach the Storage API.
- **No SQL-level coverage of the storage policies**, per §4. If a
  Supabase-backed test environment ever exists, that gap should close
  before anything else here is changed.
