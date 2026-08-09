/**
 * Stable error codes raised by the Phase 4 RPCs
 * (supabase/migrations/*_phase4_households.sql). The functions raise
 * bare identifiers like 'NOT_OWNER' so the UI can map them to a
 * translated message without parsing prose or leaking SQL detail to the
 * user.
 */
export type HouseholdErrorCode =
  | "AUTH_REQUIRED"
  | "NOT_OWNER"
  | "FORBIDDEN"
  | "INVALID_NAME"
  | "INVALID_ROLE"
  | "INVALID_CODE"
  | "INVITATION_NOT_PENDING"
  | "INVITATION_EXPIRED"
  | "INVITATION_NOT_FOUND"
  | "MEMBER_NOT_FOUND"
  | "CANNOT_REMOVE_OWNER"
  | "NOT_CONFIGURED"
  | "UNKNOWN";

const KNOWN_CODES: HouseholdErrorCode[] = [
  "AUTH_REQUIRED",
  "NOT_OWNER",
  "FORBIDDEN",
  "INVALID_NAME",
  "INVALID_ROLE",
  "INVALID_CODE",
  "INVITATION_NOT_PENDING",
  "INVITATION_EXPIRED",
  "INVITATION_NOT_FOUND",
  "MEMBER_NOT_FOUND",
  "CANNOT_REMOVE_OWNER",
];

/** Postgres surfaces a raised exception as the error message, so match on
 * the identifier rather than an error number. Anything unrecognized
 * becomes UNKNOWN — the UI shows a generic message and the detail stays
 * server-side. */
export function toHouseholdErrorCode(message: string | undefined): HouseholdErrorCode {
  if (!message) return "UNKNOWN";
  return KNOWN_CODES.find((code) => message.includes(code)) ?? "UNKNOWN";
}

export type ActionResult<T = undefined> =
  | { ok: true; value: T }
  | { ok: false; code: HouseholdErrorCode };
