HomeList — Product & Engineering Plan

Multilingual Household Shopping & Communication App

Working Product Name: HomeList
Alternative brand candidates: My Home List, My Prime List, My List,
Prime List

Initial platform: Mobile-first Web App / PWA
Future platforms: Native iOS + Android applications
Primary market: Kuwait
Primary users: Household owners/families and domestic workers

────────

> **Amendment Log**
>
> - **2026-08-09 — Amendment 1.** Added Section 16A, *Shopping List
>   Grouping & Purchase Checklist*, as a **core V1 requirement** (not a
>   future feature). Updated the Section 16 data model to include
>   `category_id` and `purchase_status` on shopping list items. Updated
>   Phase 5, 6, 7, 8 and 10 task lists in Section 25 to explicitly cover
>   category-grouped lists, the purchase checklist, and its test
>   coverage. Updated Section 30 (Definition of Done) accordingly. See
>   `docs/architecture/13-shopping-list-grouping-checklist.md` for the
>   full Phase 0 architecture treatment of this requirement.

────────

1. Product Vision

HomeList is a simple visual shopping-list and household communication
application designed for domestic workers who may not speak or read
Arabic or English.

The worker selects her preferred language, browses real Kuwait grocery
and household products using clear product images, adds quantities, and
sends the list.

The household owner receives the same list in Arabic or English.

The product must remain extremely simple:

• Visual-first
• Minimal typing
• No complicated navigation
• No unnecessary chat functionality
• No e-commerce checkout in V1
• No payment or delivery in V1
• Designed mobile-first
• Built so the same backend can later support separate Worker and
Household apps

────────

2. Recommended Product Name

Primary recommendation: HomeList

Why:

• Clear immediately
• Not limited to groceries
• Works for future household tasks
• Suitable for Kuwait and international expansion
• Works as a future iOS/Android app name
• Can later support shopping, cleaning supplies, household requests
and recurring lists

Brand naming direction

Primary: HomeList

Optional subtitle: Your Home. Your List.

Alternative names to keep available:

1. My Home List
2. My Prime List
3. Prime List
4. My List
5. Home Grocery List

Do not hard-code the brand name throughout the codebase. Store
application branding in a centralized configuration.

────────

3. Core Product Concept

The system has two sides.

Worker App

The domestic worker:

1. Opens the website
2. Selects language
3. Signs in using mobile number + OTP
4. Joins or is invited to a household
5. Browses visual product categories
6. Selects products
7. Sets quantities
8. Reviews the list
9. Sends the list

Household App

The household owner:

1. Creates a household
2. Adds household members/workers
3. Generates invitations
4. Receives shopping lists
5. Views lists in Arabic or English
6. Marks lists as completed
7. Can manage connected workers/members

────────

4. Supported Languages

V1 must support:

• Arabic — ar
• English — en
• Hindi — hi
• Telugu — te
• Urdu — ur
• Filipino / Tagalog — fil
• Nepali — ne
• Indonesian — id
• Sinhala — si

Important:

• Display each language using its native name/script where possible.
• Support RTL for Arabic and Urdu.
• Do not translate dynamically during normal use.
• Product translations should be stored in the database.
• UI translations should be stored in structured locale files.

────────

5. Product Catalog

The product catalog should represent real products commonly available in
Kuwait.

Initial reference sources:

• Sharq Cooperative Society
• Deliveroo Kuwait / Al Rawda & Hawally Coop
• Other Kuwait cooperative and grocery sources may be added later

Important legal/technical rule:

Do not assume that product images from third-party websites can legally
be copied and permanently re-hosted.

For the initial development phase:

• Extract product metadata where technically and legally appropriate.
• Keep source URL/reference.
• Do not import prices into the application.
• Prefer licensed, permitted, original, or internally created product
images for production.
• Build the database so image source can be changed later without
changing the application.

The catalog should NOT be an e-commerce catalog.

There is no checkout, payment, delivery, or order placement in V1.

────────

5A. Product Source Import / Extraction Strategy

The two supplied Kuwait sources are reference sources for the initial catalog:

1. Sharq Cooperative Society
2. Deliveroo Kuwait — Al Rawda & Hawally Coop Society

Claude Code must NOT assume that a URL can be scraped or that images can be redistributed.

Before implementing automated extraction:

• Inspect robots.txt and relevant site terms where accessible.
• Determine whether product data/images are rendered server-side or client-side.
• Build a one-time import pipeline that can ingest permitted metadata.
• Store the original source URL for every imported product.
• Do not import prices into the product catalog.
• Do not create automated checkout/order placement.
• Do not permanently re-host third-party images unless permitted.
• Support replacing image_url with an owned/licensed image later.
• If automated scraping is blocked or inappropriate, create an import CSV/JSON pipeline instead of bypassing protections.

The import pipeline should be separate from the main application so the catalog can be refreshed or replaced without changing the UI.

6. Product Data Model

Each product should support:

```text
id
category_id
subcategory_id
brand
name_en
name_ar
name_hi
name_te
name_ur
name_fil
name_ne
name_id
name_si
size
unit
image_url
image_source_url
source_name
is_active
sort_order
created_at
updated_at
```

Optional future fields:

```text
barcode
sku
aliases
search_keywords
favorite_count
```

────────

7. Initial Product Categories

Recommended V1 categories:

1. Fruits & Vegetables
2. Dairy & Eggs
3. Rice, Pasta & Grains
4. Meat, Chicken & Fish
5. Bakery
6. Cooking & Pantry
7. Canned & Sauces
8. Drinks
9. Snacks & Sweets
10. Frozen
11. Cleaning
12. Personal Care
13. Household
14. Baby Care
15. Other

The category structure must be configurable from the database.

> **Amendment 1 note:** Section 16A defines a canonical, deterministic
> default *display order* for these categories on the household/owner
> side, which differs slightly from this authoring list (grouped by
> shopping relevance). Both lists describe the same 15 categories.

────────

8. Authentication & Household Linking

This is a critical part of the architecture.

DO NOT use one permanent shared code for the entire household.

Instead use:

A. User Account

Every person has an account identified by:

```text
user_id
phone_number
role
preferred_language
created_at
```

Authentication:

Phone Number + OTP

The initial web version may use Supabase Auth or another secure OTP
provider.

────────

9. Household Model

Create a separate Household entity.

```text
household
---------
id
name
owner_user_id
created_at
updated_at
```

Example:

```text
Household ID:
H_8F72K91
```

The internal ID must never be used as the invitation code.

────────

10. Household Members

A household can have multiple users.

```text
household_members
-----------------
id
household_id
user_id
role
status
created_at
```

Roles:

Owner

The person who created the household.

Permissions:

• Manage household
• Invite users
• Remove users
• View lists
• Complete lists
• Manage settings

Member

Examples:

• Husband
• Wife
• Adult child
• Other trusted family member

Permissions can include:

• View lists
• Create lists
• Receive lists

Worker

Domestic worker.

Permissions:

• View assigned household
• Create shopping lists
• Send lists
• View own previous lists

Workers should NOT automatically have access to household management.

────────

11. Household Invitation System

Do NOT make the phone number itself the household identifier.

Do NOT use one permanent shared household password.

Instead:

Owner creates an invitation

The owner selects:

Add Worker

The system generates a temporary invitation:

```text
Invite Code:
K7P4-M2
```

or preferably a secure deep link:

```text
homelist.app/join/K7P4M2
```

The invitation should:

• Expire after a configurable period
• Be single-use by default
• Be revocable
• Be associated with the household
• Optionally be restricted to a role such as Worker or Member

────────

12. Recommended Joining Flow

Worker

Step 1

Open HomeList.

Step 2

Choose language.

Step 3

Enter phone number.

Step 4

Receive OTP.

Step 5

After verification:

Show:

Join a Home

```text
Enter invitation code
[ K7P4-M2 ]

[ Join Home ]
```

Step 6

Show confirmation:

```text
You are joining:

Reem's Home

Role:
Domestic Worker

[ Confirm ]
```

Step 7

Worker becomes linked to the household.

────────

13. Better Alternative: Invite Link

The owner should be able to press:

Invite Worker

Then:

Share Invite

This can share a link through WhatsApp.

Example:

```text
Join my HomeList household:

https://homelist.app/join/7X92KP
```

The worker opens the link, verifies her phone number with OTP, and the
invitation is accepted.

This is easier than manually typing codes.

Keep both:

• Share Link
• Manual Code

────────

14. Multiple People in One Household

The architecture must support:

```text
1 Household
    |
    +-- Owner
    |
    +-- Member
    |
    +-- Member
    |
    +-- Worker
    |
    +-- Worker
```

Example:

```text
Reem's Home

Owner:
Reem

Members:
Husband
Daughter

Workers:
Worker A
Worker B
```

All authorized users can interact with the same household.

The system must NOT assume one household = one worker.

────────

15. Important Security Rule

A worker must never be able to:

• Discover other households
• Search for households by name
• Join a household without a valid invitation
• View another household's lists
• Access another worker's private data
• Manage owner permissions

All household data access must be enforced server-side.

Never rely only on frontend route protection.

Use database-level authorization / RLS where Supabase is used.

────────

16. Shopping List Model

```text
shopping_lists
--------------
id
household_id
created_by_user_id
status
language
created_at
completed_at
```

Statuses:

```text
draft
sent
viewed
completed
archived
```

Items:

```text
shopping_list_items
-------------------
id
list_id
product_id
category_id
quantity
unit
note
purchase_status
purchased_at
purchased_by_user_id
created_at
updated_at
```

> **Amendment 1:** `category_id` and the purchase-execution fields
> (`purchase_status`, `purchased_at`, `purchased_by_user_id`) were added
> to `shopping_list_items` so that category grouping and the owner's
> purchase checklist are first-class, persisted data — not values
> derived at display time. See Section 16A for the full behavior.

────────

16A. Shopping List Grouping & Purchase Checklist (Core V1 Requirement)

This section is a **core V1 requirement**, not a future feature. It
governs how a worker's selections travel to the household side and how
the owner executes the physical shopping trip against that list.

**16A.1 Worker side — category integrity**

The worker browses products by category. Every selected product retains
its canonical `category_id` from the product catalog (e.g. Milk → Dairy
& Eggs, Rice → Rice, Pasta & Grains, Tomatoes → Fruits & Vegetables,
Chicken → Meat, Chicken & Fish, Dish Soap → Cleaning).

When the worker sends the list, the system must **not** flatten it into
an arbitrary order. The product/category relationship must be preserved
end-to-end.

**16A.2 Household/owner side — automatic grouping**

When the owner opens a received list, the system automatically groups
the requested items by category. The owner never sees a flat, randomly
ordered list.

Example rendering:

```text
SHOPPING LIST

🥬 Fruits & Vegetables
☐ Tomatoes × 2 kg
☐ Potatoes × 2 kg
☐ Onions × 1 kg

🥛 Dairy & Eggs
☐ Almarai Milk × 2
☐ Eggs × 1

🍚 Rice, Pasta & Grains
☐ Basmati Rice × 2
☐ Pasta × 2

🍗 Meat, Chicken & Fish
☐ Chicken × 2

🧼 Cleaning
☐ Dishwashing Liquid × 1
☐ Laundry Detergent × 1
```

The category order is configurable and deterministic. Recommended
default order:

```text
1. Fruits & Vegetables
2. Dairy & Eggs
3. Meat, Chicken & Fish
4. Bakery
5. Rice, Pasta & Grains
6. Cooking & Pantry
7. Canned & Sauces
8. Frozen
9. Drinks
10. Snacks & Sweets
11. Cleaning
12. Personal Care
13. Household
14. Baby Care
15. Other
```

**16A.3 Purchase checklist**

The owner can check items off while shopping. Each shopping-list item
has an independent purchase status:

```text
pending      (default)
purchased
unavailable
```

Interaction: `☐ Pending → ☑ Purchased`. The owner can also mark an item
`↪ Unavailable`.

**The purchase status belongs to the owner's shopping execution and must
never modify the original worker request.** If the worker requested
`Milk × 2, Eggs × 1, Rice × 2`, the owner can independently record
`Milk → purchased, Eggs → pending, Rice → purchased` while the requested
quantities remain exactly `2`, `1`, `2`.

**16A.4 Data model**

`shopping_list_items` must support at minimum:

```text
id
list_id
product_id
category_id
quantity
unit
note
purchase_status
purchased_at
purchased_by_user_id
created_at
updated_at
```

`purchase_status` ∈ `{pending, purchased, unavailable}`.

`category_id` is captured at item-creation time from the product's
catalog category and is not re-derived from the UI at display time —
this is what makes grouping deterministic and keeps historical lists
accurate even if a product's catalog category changes later.

**16A.5 Progress indicator**

The owner view displays shopping progress, e.g. `7 / 12 purchased` with
a progress bar. Progress is calculated from the count of shopping-list
items whose `purchase_status = purchased`, divided by total items —
**item count, not quantity count.** Ten units of one product is one
checklist item, not ten.

**16A.6 Category progress**

Each category may optionally show its own sub-progress, e.g.
`Dairy & Eggs — 2 / 3 purchased`. This must stay simple — no
per-category settings or extra UI beyond a count.

**16A.7 List order within a category**

Inside each category, default item order is: (1) the worker's
selection/add order, falling back to (2) the product's catalog
`sort_order` if a deterministic order is otherwise needed. Products must
never be reordered randomly.

**16A.8 Mobile UX**

The owner most likely uses this screen while physically shopping.
Required: large checkbox/touch target, large product image, clearly
visible product name and quantity, category headers, a sticky progress
indicator where appropriate, minimal text, fast interaction, no
confirmation modal per checkbox tap, and immediate visual feedback.

**16A.9 Owner display language**

The owner views the list in Arabic or English. The worker's original
input language does not determine the owner's display language — e.g. a
worker using Hindi and an owner using Arabic both work against the same
underlying `product_id`/`category_id` data, rendered with each user's
own localized strings.

**16A.10 List history**

When a list is completed, the system preserves: original requested
items, requested quantities, categories, purchase status per item,
purchased timestamp, purchased-by user, unavailable items, the creating
worker, creation timestamp, and completion timestamp. This is required
groundwork for future shopping history and recurring lists.

**16A.11 Future recurring lists (not built in V1)**

The data model keeps the original request (`shopping_list_items`
requested fields) and the purchase execution (`purchase_status` and
related fields) as separate concepts specifically so that a future
"repeat last week's shopping list" feature can clone the requested
fields of a prior list into a new draft without carrying over any
purchase-execution state. No recurring-list feature is implemented in
V1.

**16A.12 Acceptance test**

This feature is not complete unless the following scenario works
end-to-end:

Worker selects `Tomatoes × 2, Milk × 2, Rice × 1, Chicken × 2, Dish Soap
× 1, Eggs × 1` and sends the list. The owner receives it grouped as
Fruits & Vegetables / Dairy & Eggs / Rice, Pasta & Grains / Meat,
Chicken & Fish / Cleaning, in that order. The owner purchases Tomatoes,
Milk, Rice, and Chicken — the app shows `4 / 6 purchased`. The worker's
original list still shows all 6 requested items unchanged. The owner
then marks Dish Soap as unavailable. Final state: Tomatoes, Milk, Rice,
Chicken purchased; Eggs pending; Dish Soap unavailable — and the
requested quantities for every item are untouched throughout.

See `docs/architecture/13-shopping-list-grouping-checklist.md` for the
full architectural treatment (schema, RPC boundary, RLS implications,
UI wireframe notes).

────────

17. Worker Shopping Experience

The home screen should show:

```text
What do you need?

[ Fruits & Vegetables ]
[ Dairy & Eggs ]
[ Rice & Groceries ]
[ Chicken & Meat ]
[ Bakery ]
[ Drinks ]
[ Frozen ]
[ Cleaning ]
[ Personal Care ]
[ Household ]
```

Use large cards and real product images.

The design should be inspired by clean, visual localization/product
interfaces such as Lokalise, but must NOT copy its branding or UI
directly.

────────

18. Product Selection

Product cards:

```text
[ PRODUCT IMAGE ]

Almarai
Fresh Milk 2L

[-]  1  [+]

[ Add ]
```

The product name must appear in the worker's selected language.

Image should be the primary visual identifier.

────────

19. Frequently Used Products

Add:

My Usual Items

This should show products the worker frequently selects.

Initial implementation can be simple:

• Count selections per worker
• Sort by selection frequency
• Show top 12 products

No AI required.

────────

20. Search

Search must support:

• Localized product names
• Brand names
• Common aliases
• Transliteration where practical

Example:

Worker searches:

```text
gatas
```

Result:

```text
Milk
```

Search should be database-backed and not depend on an AI API.

────────

21. Owner Experience

Owner dashboard:

```text
HomeList

Good morning, Reem

New Lists
--------------------------------
Today
12 items

[ View List ]
```

List view:

```text
Shopping List

🥛 Almarai Milk × 2
🥚 Eggs × 1
🍚 Basmati Rice × 2
🍅 Tomatoes × 1 kg
🧼 Dishwashing Liquid × 1

[ Mark as Completed ]
```

> **Amendment 1:** this list view is now specified in full in Section
> 16A — items are grouped under category headers with an individual
> purchase checkbox per item and an overall progress indicator, rather
> than a flat list with a single "Mark as Completed" action only.

Owner language options:

• Arabic
• English

────────

22. Notifications

V1:

Start with in-app notifications.

Future:

• Web Push
• WhatsApp notifications
• Email
• Native Apple Push Notifications
• Android push notifications

Do not make WhatsApp a dependency for V1.

────────

23. Application Architecture

Build the web application as a modular monorepo-ready architecture so it
can later become two applications.

Recommended logical structure:

```text
/apps
    /web
    /worker-app       (future)
    /household-app    (future)

/packages
    /ui
    /i18n
    /types
    /catalog
    /auth
    /database
```

For V1, do NOT physically build three applications.

Build one responsive PWA with role-based experiences.

Later:

```text
HomeList Worker
HomeList Home
```

can become separate native applications while sharing:

• Supabase backend
• Authentication
• Database
• Product catalog
• API
• Design system
• Localization system

────────

24. Recommended Technology

Locked V1 infrastructure decision:

• Hosting: Vercel
• Backend/database/auth: Supabase
• Netlify is not required for V1.

Frontend:

• Next.js
• TypeScript
• Tailwind CSS
• Responsive mobile-first UI
• PWA support

Backend:

• Supabase
• PostgreSQL
• Supabase Auth
• Row Level Security
• Supabase Storage if permitted/appropriate for owned images

Future:

• React Native / Expo for native apps
• Apple Push Notifications
• Google/Android push notifications

Do not introduce unnecessary infrastructure.

────────

25. PHASE PLAN

PHASE 0 — Product Foundation

Goal:

Define the product architecture before coding.

Tasks:

• Confirm HomeList branding
• Define user roles
• Define household model
• Define invitation model
• Define product categories
• Define supported languages
• Define database schema
• Define security model
• Define future two-app architecture

Deliverables:

• Architecture document
• Database ERD
• Route map
• Permission matrix

No UI polishing yet.

────────

PHASE 1 — Project Setup

Goal:

Create the production-ready web foundation.

Tasks:

• Create Next.js application
• TypeScript
• Tailwind
• PWA foundation
• Environment configuration
• Supabase connection
• Database migrations
• RLS foundation
• Centralized branding configuration
• Centralized localization system
• Basic responsive shell

Acceptance:

Application runs locally and deploys successfully.

────────

PHASE 2 — Localization System

Goal:

Build the multilingual foundation.

Languages:

ar en hi te ur fil ne id si

Tasks:

• Locale files
• Language selector
• Persist selected language
• RTL support
• Arabic typography
• Urdu RTL support
• Native language labels
• Translation fallback logic

Acceptance:

The entire worker interface can switch languages without code changes.

────────

PHASE 3 — Authentication

Goal:

Secure user identity.

Tasks:

• Phone number login
• OTP verification
• Session handling
• Logout
• User profile
• Preferred language
• Role handling

Acceptance:

A user can securely create and access their account using phone + OTP.

────────

PHASE 4 — Household & Invitations

Goal:

Create the secure relationship between owner and worker.

Tasks:

• Create household
• Owner profile
• Add member
• Add worker
• Generate invitation
• Invitation expiry
• Single-use invitation
• Share invitation link
• Manual invitation code
• Accept invitation
• Revoke invitation
• Remove household member
• Role-based permissions

Acceptance:

A worker can join ONLY through a valid invitation.

Multiple workers and members can belong to one household.

────────

PHASE 5 — Product Catalog

Goal:

Create the Kuwait-focused visual product database.

Tasks:

• Define categories
• Import product metadata
• Import/associate product images where permitted
• Store source URLs
• Store brand
• Store size
• Store localized names
• Create product search index
• Create admin seed/import script
• **Product catalog must provide a `category_id`/category relationship
  for every product** (Amendment 1 — required by Section 16A)

Initial target:

300–500 useful Kuwait products.

Do NOT import prices.

Do NOT implement purchasing.

Acceptance:

Worker can browse realistic Kuwait grocery and household products.

────────

PHASE 6 — Worker Application

Goal:

Build the simplest possible shopping experience.

Screens:

1. Language
2. Login
3. Join Home
4. Home
5. Category
6. Product Grid
7. Product Selection
8. My List
9. Send Confirmation

Features:

• Visual category cards
• Real product images
• Quantity controls
• Search
• Frequently used products
• Review list
• Send list
• **Worker creates shopping lists; every selected product retains its
  category information; worker sends the list without flattening or
  reordering it** (Amendment 1 — Section 16A.1)

Acceptance:

A worker can create and send a shopping list in under 60 seconds after
setup.

────────

PHASE 7 — Household Application

Goal:

Allow the owner to receive and manage lists.

Screens:

1. Login
2. Household Dashboard
3. New Lists
4. List Detail
5. Members
6. Invitations
7. Settings

Features:

• Receive lists
• Arabic/English display
• View worker identity
• View list timestamp
• Mark completed
• Manage household members
• Invite worker
• Remove worker
• **Owner sees products grouped by category; owner can check/uncheck
  products and mark products unavailable; owner sees shopping progress**
  (Amendment 1 — Section 16A.2, 16A.3, 16A.5, 16A.6)

Acceptance:

Owner can identify exactly which worker sent each list.

────────

PHASE 8 — List & Notification System

Goal:

Make communication reliable.

Tasks:

• List status
• Viewed status
• Completed status
• In-app notification
• Optional browser push
• Notification preferences
• Read/unread state
• **Persist purchase status and timestamps per item; support
  viewed/completed list states; support list history; prepare the
  architecture for future notifications on purchase-status changes**
  (Amendment 1 — Section 16A.3, 16A.4, 16A.10)

Future integrations:

• WhatsApp
• Email
• Push notifications

Acceptance:

A sent list appears reliably in the correct household.

────────

PHASE 9 — UX / Visual Polish

Goal:

Make the application extremely easy for non-English/Arabic speakers.

Tasks:

• Large touch targets
• Product photography
• Minimal text
• Clear icons
• Simple animations
• Empty states
• Loading states
• Error states
• Offline-friendly behavior
• Mobile testing

Test on:

• iPhone
• Android
• Small Android phones
• Older/low-end devices where practical

Acceptance:

A user with limited literacy can navigate the core flow using images and
familiar visual cues.

────────

PHASE 10 — QA & Security

Goal:

Production readiness.

Tasks:

• Authentication tests
• Authorization tests
• RLS tests
• Invitation security tests
• Cross-household access tests
• RTL tests
• All 9 language tests
• Mobile browser tests
• PWA install tests
• Performance tests
• Image optimization
• Search tests
• Duplicate submission tests
• **Automated tests for: correct category grouping; no random
  ordering; purchase-status persistence; worker cannot modify owner
  purchase status; owner cannot modify original requested quantity;
  progress calculation; cross-household isolation of shopping lists;
  completed/unavailable states** (Amendment 1 — Section 16A)

Security scenarios:

1. Worker A cannot access Household B.
2. Worker A cannot use an expired invitation.
3. Worker A cannot reuse a single-use invitation.
4. Removed worker loses access immediately.
5. Member cannot perform owner-only actions.
6. API cannot be bypassed through frontend manipulation.

────────

PHASE 11 — Deployment

Goal:

Launch the first real web version.

Recommended:

• Vercel
• Supabase
• Custom domain
• HTTPS
• Production environment variables
• Analytics
• Error monitoring
• Database backups

Initial launch:

```text
HomeList Web App
    |
    +-- Worker experience
    |
    +-- Household experience
```

One backend.

One database.

One authentication system.

────────

PHASE 12 — Prepare for Native Apps

Do NOT build native apps yet.

First validate the web application.

Once usage is proven:

Worker App

Possible future name:

HomeList Worker

Features:

• Login
• Household connection
• Product catalog
• Shopping lists
• Notifications
• Offline-friendly shopping

Household App

Possible future name:

HomeList Home

Features:

• Household dashboard
• Workers
• Lists
• Notifications
• Household settings

Both applications share the same backend.

────────

26. Future Household Relationship Model

The final architecture should support:

```text
Household
│
├── Owner
│
├── Members
│   ├── Spouse
│   ├── Adult Child
│   └── Other
│
└── Workers
    ├── Worker 1
    └── Worker 2
```

A shopping list belongs to the household, but also records:

```text
created_by_user_id
```

Therefore the owner always knows:

Who created this list?

────────

27. Future Expansion

The product can later evolve from:

Shopping List

into:

Home Communication Platform

Possible modules:

• Grocery List
• Cleaning Supplies
• Household Requests
• To-Do List
• Reminders
• Recurring Shopping
• Medicine / pharmacy requests
• Household inventory
• Chores
• Laundry instructions
• Cooking instructions
• Simple translation
• Voice requests
• Photo requests
• WhatsApp integration

Do NOT build these in V1.

The architecture should only make them possible later.

────────

28. Important Product Principle

The worker should never feel like she is using a complicated software
system.

The ideal flow is:

```text
Open App
    ↓
See Pictures
    ↓
Tap Products
    ↓
Choose Quantity
    ↓
Send
```

The owner flow:

```text
Receive
    ↓
See Arabic/English List (grouped by category, with a checklist)
    ↓
Buy
    ↓
Mark Done
```

Everything else is secondary.

────────

29. Claude Code Development Rules

Claude Code must:

1. Build one phase at a time.
2. Do not start the next phase until the current phase passes
acceptance criteria.
3. Do not introduce unnecessary dependencies.
4. Do not build future features prematurely.
5. Keep business logic separate from UI.
6. Keep translations separate from components.
7. Keep product data separate from UI.
8. Keep authentication separate from household logic.
9. Enforce authorization server-side.
10. Use database migrations for schema changes.
11. Never hard-code household IDs.
12. Never hard-code worker relationships.
13. Never store OTP codes manually in application tables unless
explicitly required by the selected auth provider.
14. Never expose Supabase service-role credentials to the browser.
15. Validate all user-controlled input.
16. Optimize product images.
17. Keep the application PWA-ready.
18. Keep the architecture compatible with future React Native/Expo
clients.
19. Document every major architectural decision.
20. After each phase, provide a concise completion report and list
remaining issues.

────────

30. Definition of Done

The MVP is considered complete when:

• User can authenticate with phone + OTP.
• Owner can create a household.
• Owner can invite a worker.
• Worker can accept invitation.
• Worker can select one of 9 languages.
• Worker can browse Kuwait products visually.
• Worker can add quantities.
• Worker can search products.
• Worker can send a shopping list.
• Owner receives the list.
• Owner can view it in Arabic or English.
• Owner can identify which worker sent it.
• **Owner sees the list grouped by category, in a deterministic
  configured order, with a per-item purchase checklist (pending /
  purchased / unavailable) and a shopping-progress indicator, without
  altering the worker's originally requested items or quantities**
  (Amendment 1 — Section 16A).
• Owner can mark it completed.
• Multiple household members/workers are supported.
• Cross-household access is blocked.
• RTL works correctly.
• Application works well on mobile browsers.
• PWA can be installed.
• Production deployment is stable.

────────

31. First Claude Code Instruction

Start with PHASE 0 only.

Do not write the entire application immediately.

First:

1. Inspect the repository.
2. Create a product architecture document.
3. Create the proposed database ERD.
4. Create the permission matrix.
5. Create the route map.
6. Create the folder architecture.
7. Identify technical risks.
8. Identify any missing decisions.
9. Present the Phase 0 plan for approval.

Do not implement Phase 1 until Phase 0 is complete and validated.

The product priority is:

Simplicity > Features

Visual clarity > Text

Security > Convenience

Real Kuwait products > Generic placeholder products

Reusable backend > Separate duplicated systems

Mobile-first > Desktop-first

────────

END
