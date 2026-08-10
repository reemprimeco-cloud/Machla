# 13 — Shopping List Grouping & Purchase Checklist Architecture

This is the Phase 0 architectural treatment of the **core V1 requirement**
specified in master plan Section 16A. It is not a future feature; Phase 6
(worker send), Phase 7 (owner grouped view), Phase 8 (persistence/history)
and Phase 10 (tests) all carry pieces of it, as amended in the master
plan's Phase Plan section.

## 1. Why this needs its own document

This feature touches every layer already documented elsewhere in this
Phase 0 set — schema (`03`), RLS/RPC boundary (`10`), route map (`08`) —
and has a specific, testable acceptance scenario. Rather than repeating
partial detail in each of those documents, they each link back here for
the full behavior, and this document is the single place the acceptance
test lives.

## 2. Data flow, end to end

```text
Worker (Phase 6)                     Household (Phase 7/8)
──────────────────                   ──────────────────────
Browse category "Dairy & Eggs"
  → select Milk (product_id=P1,
    category_id snapshotted from
    products.category_id at the
    moment it's added to the
    draft list)
  → set quantity, unit
        │
        ▼
shopping_list_items row created
  (list_id, product_id, category_id,
   quantity, unit, sort_order,
   purchase_status='pending')
        │
        ▼
Worker taps "Send"
  → shopping_lists.status: draft → sent, sent_at=now()
  → update_requested_item RPC no longer reaches this list
    (creator-editable window is closed)
                                            │
                                            ▼
                                    Owner opens /home/lists/[listId]
                                      → shopping_lists.status: sent → viewed
                                      → items fetched, GROUP BY category_id,
                                        categories ordered by categories.sort_order,
                                        items within a category ordered by
                                        shopping_list_items.sort_order
                                            │
                                            ▼
                                    Owner taps a checkbox
                                      → set_purchase_status RPC
                                        (purchase_status='purchased',
                                         purchased_at=now(),
                                         purchased_by_user_id=auth.uid())
                                      → quantity/product/category UNTOUCHED
                                            │
                                            ▼
                                    Owner marks Dish Soap unavailable
                                      → set_purchase_status RPC
                                        (purchase_status='unavailable')
                                            │
                                            ▼
                                    Progress = count(purchase_status='purchased')
                                               / count(*)  — item count, not
                                               quantity sum
```

## 3. Category grouping is a query pattern, not a UI trick

Because `shopping_list_items.category_id` is stored (not derived at
render time — see `03-database-schema.md`), the owner's grouped view is
produced by a single query:

```sql
select c.sort_order, c.name_ar, c.name_en, c.icon,
       i.id, i.product_id, i.quantity, i.unit, i.purchase_status, i.sort_order
from shopping_list_items i
join categories c on c.id = i.category_id
where i.list_id = :list_id
order by c.sort_order, i.sort_order;
```

No client-side re-sorting or grouping logic is required to be correct —
the deterministic order (master plan's 15-category default order,
configurable via `categories.sort_order`) is guaranteed by the query,
which also means every client (web now, native apps later) gets identical
grouping/ordering for free without re-implementing the rule.

## 4. Why category is snapshotted instead of joined live

If `shopping_list_items` only stored `product_id` and grouping joined
live to `products.category_id`, then re-categorizing a product in the
catalog later (a routine catalog-maintenance action) would silently
rewrite the grouping of every historical list that ever included that
product — including already-completed lists whose history (master plan
Section 16A.10 / 10) is supposed to be preserved as it was. Snapshotting
`category_id` at add-time avoids that, at the cost of one denormalized
column — judged a clearly correct tradeoff for Phase 0, not flagged as a
decision needing approval.

## 5. Requested vs. purchased — enforced, not just designed

The separation described in master plan Section 16A.3 ("must NOT modify
the original request") is enforced structurally by the RPC split detailed
in `10-security-model.md` §4: `update_requested_item` (creator, draft-only,
touches requested fields) and `set_purchase_status` (Owner/Member, any
status from `sent` on, touches only purchase-execution fields) are the
*only* two mutation paths into the table. There is no code path — not a
bug to avoid, an absent capability — by which marking an item purchased
can also change its quantity, and no path by which a Worker's role can
call `set_purchase_status` at all.

## 6. Progress calculation

```text
progress = count(items where purchase_status = 'purchased') / count(items)
```

Computed per list for the header progress bar, and per category
(`group by category_id`) for the optional category sub-progress (master
plan 16A.6). Always item-count based, never `sum(quantity)` based — ten
units of one product is one checklist item, matching the master plan's
explicit example (10 requested items, 7 purchased = 70%, not a
quantity-weighted figure).

## 7. UI notes carried into Phase 7/9 (not built now)

- Large checkbox/touch target, large product image, category header,
  sticky progress bar, no per-tap confirmation modal, immediate optimistic
  UI feedback on tap (calling `set_purchase_status` in the background).
- Owner display language (Arabic/English) is resolved from the
  **viewer's** `users.preferred_language`, independent of
  `shopping_lists.language` (the language the worker composed it in) —
  the same underlying `product_id`/`category_id` row renders differently
  per viewer because product/category names are stored per-language in
  the catalog, not baked into the list at send time.

## 8. Acceptance test (restated from the master plan, this is the Definition of Done for this feature)

Worker sends `Tomatoes×2, Milk×2, Rice×1, Chicken×2, Dish Soap×1, Eggs×1`.
Owner sees it grouped: Fruits & Vegetables / Dairy & Eggs / Rice, Pasta &
Grains / Meat, Chicken & Fish / Cleaning, in that deterministic order.
Owner purchases Tomatoes, Milk, Rice, Chicken → app shows `4 / 6
purchased`. Worker's original list still shows all 6 requested items,
unchanged quantities. Owner marks Dish Soap unavailable. Final state:
4 purchased, 1 pending (Eggs), 1 unavailable (Dish Soap) — and every
requested quantity is exactly what the worker entered, throughout. This
scenario is the Phase 10 automated-test target (master plan Phase 10 task
list, amended).

## 9. Explicit non-goals for now

- No recurring/"repeat last list" feature is built in V1 — the
  requested/purchased separation exists so it *can* be built later purely
  by cloning a prior list's requested fields into a new draft (master plan
  16A.11), but no clone action exists yet.
- No notification is sent when an item's purchase status changes — Phase
  8 only prepares the architecture (status columns, timestamps) for
  future notifications, per the amended Phase 8 task list.
- No quantity-weighted progress, no partial-purchase ("bought 1 of 2")
  state — `purchase_status` is a 3-value enum, not a partial-quantity
  tracker, matching the master plan's model exactly.

---

## 10. Phase 6 — as built (worker side)

The worker half of this feature is implemented. The household half
(§5, §6 — checking off, marking unavailable, progress) remains Phase 7.

### 10.1 The draft lifecycle

Four RPCs, in `supabase/migrations/*_phase6_worker_lists.sql`:

| Function | What it does |
|---|---|
| `get_or_create_draft_list` | Returns the caller's open draft, creating one only if there is none |
| `set_list_item` | Adds a product, or changes an existing one's quantity/note |
| `remove_list_item` | Takes a product off the draft |
| `send_list` | Draft → `sent`, stamping `sent_at` |

Plus `assert_own_draft`, the shared precondition the three mutations all
call — factored out precisely so they cannot drift apart on who is
allowed to do what. It is **not** granted to `authenticated`: it returns a
whole list row and exists only for the functions above, which are
themselves authorized.

Two properties worth stating plainly, because both are load-bearing:

- **One draft per (household, person).** Reopening resumes the same list
  rather than starting a second. A worker on a low-end phone loses the app
  mid-shop routinely; the list has to still be there.
- **A draft belongs to exactly one person.** Not to the household. A
  fellow worker in the same household can *read* the list (RLS scopes by
  household) but cannot add to, remove from, or send it — and neither can
  the owner. `04_phase6_worker_lists_test.sql` asserts all four refusals.

### 10.2 Grouping, end to end

§3 and §4 of this document describe the intent; here is where each piece
actually lives:

1. `set_list_item` snapshots `category_id`, `unit` and `sort_order` from
   the product **at add-time**.
2. `lib/list/queries.ts:groupEntries()` groups on the item's stored
   `category_id` — never a live join to `products.category_id`. Joining
   live here would quietly undo the guarantee the database is keeping.
3. Category order follows `categories.sort_order`; items within a category
   follow their own snapshotted `sort_order`. Both are asserted unique
   (`03_phase5_catalog_test.sql`), so the ordering is deterministic — the
   same list renders identically on every device.
4. The review screen, the send confirmation, and (in Phase 7) the owner's
   view all read the same grouped structure. The list is never flattened
   or re-sorted between worker and owner (§16A.1).

Verified end-to-end against the live project: three products added in the
order cleaning → dairy → produce came back grouped as produce (aisle 1),
dairy (2), cleaning (11).

### 10.3 Purchase state is unreachable from the worker side

Approved Phase 0 decision 6 in its strong form. Not "the worker UI does
not offer it" but:

- no worker-reachable RPC takes a `purchase_status` / `purchased_*`
  argument — asserted generically against `pg_proc`, so a future function
  that adds one fails the suite;
- `set_list_item`'s UPDATE branch names the columns it writes, and those
  three are not among them;
- `shopping_list_items` has no UPDATE policy at all, so a direct write
  from a client is a silent no-op — the test asserts the data is
  *unchanged* rather than expecting an error, which is the stronger check.

### 10.4 What the worker sees

- **Home** — 15 icon-led category tiles, two columns, plus search and a
  "you often buy" row that appears only once there is history.
- **Category / search** — a product grid; each card is picture, name,
  brand · size, and one stepper.
- **The stepper** is the whole interaction: "Add" at zero, then − N +.
  Updates are optimistic, and because the server sets an *absolute*
  quantity rather than incrementing, an impatient double-tap on a slow
  connection is idempotent rather than a double-add.
- **My list** — grouped review, quantity editable in place, then send.
- **Sent** — the list shown back, grouped as sent, rather than only a
  tick: the worker's own record of what they asked for is what settles a
  later disagreement.

Product images are the category icon throughout, since every
`image_url` is null (`11-product-catalog-architecture.md` §7.5). For a
low-literacy shopper a large familiar glyph beats a broken image frame;
this is the designed fallback, not a stub.

### 10.5 Frequently-used counters

`product_usage_stats` increments **only on a first add**, not on every
quantity change — otherwise nudging the stepper four times would outrank a
product genuinely bought every week. Counters are per-user and scoped by
RLS to `user_id = auth.uid()`, so one worker's habits never surface in
another's suggestions.

---

## 11. Phase 7 — as built (household side)

The household half is implemented. §5 (requested vs. purchased) and §6
(progress) are now enforced code, not intent.

### 11.1 The RPCs

| Function | Who | What |
|---|---|---|
| `get_household_lists` | any active member | Received lists + **sender name** + progress counts |
| `mark_list_viewed` | Owner/Member | `sent → viewed`, idempotent, never backwards |
| `set_purchase_status` | Owner/Member | The *only* write path into purchase state |
| `set_list_completed` | Owner/Member | `completed`, and reversible back to `viewed` |

Plus `assert_can_work_list`, the shared precondition — not granted to
`authenticated`, same reasoning as `assert_own_draft`.

### 11.2 Why `get_household_lists` is SECURITY DEFINER

The Phase 7 acceptance criterion is *"the owner can identify exactly which
worker sent each list."* `users` is scoped by RLS to the caller's own row,
so a plain query cannot resolve a sender's name at all. This RPC is the
narrow, membership-checked place that can — and it returns
`display_name` only. Phone numbers stay out, exactly as in
`get_household_members` (`10-security-model.md` §3).

It also excludes drafts unconditionally: another person's unsent list is
not the household's business, whoever is asking.

### 11.3 The split, now enforced in both directions

§5 described this; here is what actually holds:

- `set_purchase_status` names only `purchase_status`, `purchased_at` and
  `purchased_by_user_id`. Checking an item off structurally cannot alter
  the quantity, product, category or note (§16A.3).
- It refuses a Worker caller — including on a list they wrote themselves.
  The author of a request does not get to mark it fulfilled.
- `set_list_item` (Phase 6) refuses any list that is not a draft, so the
  request freezes on send.
- Un-checking clears `purchased_at` and `purchased_by_user_id` rather than
  leaving a stale attribution on an item that is no longer purchased.

`05_phase7_household_lists_test.sql` asserts each of these, and two of them
structurally rather than behaviourally: exactly one signed-in-callable
function *assigns* `purchase_status` (the regex anchors on the
`UPDATE … SET` form, so a function that merely counts by the column does
not match — `get_household_lists` tripped an earlier, looser version), and
`set_list_item`'s definition does not mention the purchase columns in any
executable line (`--` comments are stripped first, since its body carries
a note explaining exactly which columns it omits).

### 11.4 Completion is not gated on the checklist

`set_list_completed` closes a list with items still outstanding. A shop
legitimately finishes with something unavailable, and refusing to close
would only teach people to tick boxes they did not fill. Reopening drops
to `viewed`, not `sent` — it has certainly been seen — and items stay
editable afterwards so a miscount can be corrected.

### 11.5 Progress

`purchased / total`, by item count, computed in SQL by
`count(*) filter (where purchase_status = ...)`. Never quantity-weighted:
ten units of one product is one checklist item (§16A.6). `unavailable` is
counted separately and does not count as purchased.

The UI mirrors this optimistically — the header count moves on the same
tap that moves the row — so a slow connection does not make the bar look
stuck.

### 11.6 What the household sees

- **Dashboard** — the three newest lists with sender and progress, then
  People and Invitations. Lists come first: receiving them is what this
  side of the app is for.
- **Lists** — everything received, newest first; unopened ones outlined.
- **Checklist** — grouped by category in aisle order, from the same
  `groupEntries()` the worker's review screen uses, so the two sides
  cannot drift. The whole row is the check target (48px, one-handed, in an
  aisle); a separate ✕ marks an item unavailable.

Quantities and notes are displayed but have no editing affordance — which
is presentation matching a guarantee the database is already keeping,
not the guarantee itself.
