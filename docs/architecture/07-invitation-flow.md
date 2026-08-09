# 07 — Invitation & Household-Linking Flow

## 1. Design goals (from master plan Sections 11–13, 15)

- No permanent shared household password/code.
- No use of the household's internal `id` as an invitation identifier.
- Invitations expire, are single-use by default, are revocable, and are
  scoped to a specific role (`member` or `worker`).
- A household is never discoverable/searchable — the *only* way in is a
  valid invitation.

## 2. Invitation code design

- 8-character code from a **Crockford base32** alphabet (excludes
  ambiguous characters `0/O`, `1/I/L`) → readable over the phone, typeable
  on a numeric-heavy keyboard, and URL-safe.
- ~40 bits of entropy per code. Combined with single-use + a 7-day default
  expiry + server-side rate limiting on the redemption endpoint, this is
  judged sufficient for V1 (small household counts, not a public
  namespace to brute-force against). Flagged for confirmation in
  `14-technical-risks-decisions.md` item 4.
- The same code value backs **both** the manual-entry code (shown as
  `K7P4-M2`, hyphen inserted for display only) and the deep link
  (`homelist.app/join/K7P4M2`) — one code, two entry points, per master
  plan Section 13 ("keep both").

## 3. Generation (Owner side)

```text
Owner taps "Invite Worker" (or "Invite Member")
        │
        ▼
create_invitation(household_id, role)          [RPC, Owner-only]
        │  - verifies caller is the household's active Owner
        │  - generates a unique code (retry on collision)
        │  - inserts household_invitations row:
        │      status='pending', max_uses=1, expires_at=now()+7d
        ▼
Owner sees:
  "Share Invite" → Web Share API (WhatsApp, SMS, etc.) with the deep link
  "Show Code"    → K7P4-M2 for manual entry
```

## 4. Redemption (Invitee side) — two-step, race-safe

The master plan's joining flow (Section 12) explicitly shows a **preview
before commit**: the invitee sees "You are joining: Reem's Home / Role:
Domestic Worker" with a separate "Confirm" tap. This maps to two RPCs:

```text
1. preview_invitation(code)         [RPC, any authenticated user]
   - read-only; does NOT mark the invitation used
   - validates status='pending' and not expired
   - returns { household_name, role } only — never the full
     household_invitations row, never other household details

2. accept_invitation(code)          [RPC, any authenticated user]
   - re-validates status='pending' and not expired, inside a single
     transaction with a row lock (SELECT ... FOR UPDATE) on the
     invitation row, so two simultaneous redemption attempts on the
     same single-use code cannot both succeed
   - inserts household_members (household_id, user_id=auth.uid(),
     role=invitation.role, status='active')
   - updates household_invitations: status='accepted',
     used_by_user_id=auth.uid(), used_at=now()
   - if the user already has an active membership in this household,
     returns a friendly no-op rather than a duplicate row (unique
     constraint on (household_id, user_id) backs this)
```

Full flow:

```text
Worker: language → phone+OTP (see 06-auth-otp-flow.md) → verified
        │
        ▼
/join/[code]  (from a shared link) OR  /onboarding → "Enter invitation code"
        │
        ▼
preview_invitation(code)  →  "You are joining: Reem's Home / Role: Worker"
        │
        ▼ (user taps Confirm)
accept_invitation(code)  →  household_members row created
        │
        ▼
Routed into the Worker experience for that household
```

## 5. Expiry & revocation

- `expires_at` is checked at both `preview_invitation` and
  `accept_invitation` time (never trust a cached preview).
- A scheduled job (Supabase cron / pg_cron, Phase 4) flips
  `status='pending' and expires_at < now()` rows to `status='expired'` —
  belt-and-suspenders on top of the runtime check, so expired invitations
  don't linger indefinitely as "pending" in the Owner's invitation list.
- Owner can call `revoke_invitation(invitation_id)` any time while
  `status='pending'` → `status='revoked'`. Revoked/expired/accepted codes
  are permanently dead; a new invitation must be generated (no code
  reactivation).
- Invitation rows are **never deleted**, only status-transitioned —
  preserves an audit trail of who invited whom and when.

## 6. Explicit security properties this design guarantees

1. A worker cannot join any household without possessing a currently
   valid (`pending`, unexpired) code for it.
2. A code cannot be redeemed twice (row-locked single-use check).
3. A revoked code stops working immediately — no cache/propagation delay,
   since every redemption re-checks `status` server-side.
4. Nothing about a household (name, member list, existing lists) is
   exposed to a non-member beyond the minimal `{household_name, role}`
   preview, and only for someone holding a valid code for it.
