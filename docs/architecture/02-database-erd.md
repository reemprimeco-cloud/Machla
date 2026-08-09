# 02 — Database ERD

Full column-level detail lives in `03-database-schema.md`. This document is
the relationship map.

```mermaid
erDiagram
    USERS ||--o{ HOUSEHOLD_MEMBERS : "has memberships"
    HOUSEHOLDS ||--o{ HOUSEHOLD_MEMBERS : "has members"
    HOUSEHOLDS ||--o{ HOUSEHOLD_INVITATIONS : "issues"
    USERS ||--o{ HOUSEHOLD_INVITATIONS : "created_by"
    USERS ||--o{ HOUSEHOLD_INVITATIONS : "used_by (nullable)"
    HOUSEHOLDS ||--o{ SHOPPING_LISTS : "owns"
    USERS ||--o{ SHOPPING_LISTS : "created_by (worker/member)"
    SHOPPING_LISTS ||--o{ SHOPPING_LIST_ITEMS : "contains"
    PRODUCTS ||--o{ SHOPPING_LIST_ITEMS : "referenced by"
    CATEGORIES ||--o{ PRODUCTS : "classifies"
    CATEGORIES ||--o{ SHOPPING_LIST_ITEMS : "snapshotted on"
    USERS ||--o{ SHOPPING_LIST_ITEMS : "purchased_by (nullable)"
    USERS ||--o{ PRODUCT_USAGE_STATS : "tracks frequency for"
    PRODUCTS ||--o{ PRODUCT_USAGE_STATS : "counted by"

    USERS {
        uuid id PK
        text phone_number
        text role "primary persona: owner/member/worker"
        text preferred_language
        text display_name
        timestamptz created_at
        timestamptz updated_at
    }

    HOUSEHOLDS {
        uuid id PK
        text public_code "not used for invitations"
        text name
        uuid owner_user_id FK
        timestamptz created_at
        timestamptz updated_at
    }

    HOUSEHOLD_MEMBERS {
        uuid id PK
        uuid household_id FK
        uuid user_id FK
        text role "owner/member/worker"
        text status "active/removed"
        uuid invited_by_user_id FK
        timestamptz joined_at
        timestamptz created_at
        timestamptz updated_at
    }

    HOUSEHOLD_INVITATIONS {
        uuid id PK
        uuid household_id FK
        text code
        text role "member/worker"
        text status "pending/accepted/revoked/expired"
        int max_uses
        uuid created_by_user_id FK
        uuid used_by_user_id FK
        timestamptz used_at
        timestamptz expires_at
        timestamptz created_at
    }

    CATEGORIES {
        uuid id PK
        text key
        text icon
        int sort_order
        bool is_active
        text name_en
        text name_ar
        text name_hi
        text name_te
        text name_ur
        text name_fil
        text name_ne
        text name_id
        text name_si
    }

    PRODUCTS {
        uuid id PK
        uuid category_id FK
        uuid subcategory_id FK "nullable, self-ref to categories"
        text brand
        text name_en
        text name_ar
        text name_hi
        text name_te
        text name_ur
        text name_fil
        text name_ne
        text name_id
        text name_si
        text size
        text unit
        text image_url
        text image_source_url
        text source_name
        text barcode "nullable"
        text sku "nullable"
        text[] search_keywords
        bool is_active
        int sort_order
        timestamptz created_at
        timestamptz updated_at
    }

    PRODUCT_USAGE_STATS {
        uuid id PK
        uuid user_id FK
        uuid product_id FK
        int selection_count
        timestamptz last_selected_at
    }

    SHOPPING_LISTS {
        uuid id PK
        uuid household_id FK
        uuid created_by_user_id FK
        text status "draft/sent/viewed/completed/archived"
        text language
        timestamptz created_at
        timestamptz sent_at
        timestamptz viewed_at
        timestamptz completed_at
        timestamptz updated_at
    }

    SHOPPING_LIST_ITEMS {
        uuid id PK
        uuid list_id FK
        uuid product_id FK
        uuid category_id FK "snapshot at add-time"
        numeric quantity
        text unit
        text note "nullable"
        int sort_order
        text purchase_status "pending/purchased/unavailable"
        timestamptz purchased_at "nullable"
        uuid purchased_by_user_id FK "nullable"
        timestamptz created_at
        timestamptz updated_at
    }
```

## Notes on relationships

- `households.owner_user_id` is a convenience denormalization of "the
  household_members row with role=owner" — it exists so ownership can be
  read without a join, but the **authoritative** owner is still whichever
  `household_members` row has `role='owner', status='active'`. A future
  ownership-transfer feature would update both in one transaction.
- `shopping_list_items.category_id` intentionally duplicates
  `products.category_id` at the time the item was added — see
  `13-shopping-list-grouping-checklist.md` for why this is a deliberate
  snapshot, not normalization debt.
- `product_usage_stats` backs Section 19 ("My Usual Items") — a simple
  per-user, per-product counter, no AI.
- No table stores OTP codes; Supabase Auth owns that internally (master
  plan rule 29.13).
