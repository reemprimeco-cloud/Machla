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
