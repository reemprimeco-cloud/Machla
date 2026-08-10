/**
 * Stable error codes raised by the Phase 6 RPCs
 * (supabase/migrations/*_phase6_worker_lists.sql), mapped the same way as
 * the Phase 4 codes: the functions raise bare identifiers so the UI can
 * translate them without parsing prose or leaking SQL detail.
 *
 * Note what LIST_NOT_FOUND covers: a list that does not exist AND one
 * that belongs to someone else. The RPC deliberately does not
 * distinguish, so probing ids tells an attacker nothing — the UI must not
 * try to be more specific than the database was.
 */
export type ListErrorCode =
  | "AUTH_REQUIRED"
  | "FORBIDDEN"
  | "LIST_NOT_FOUND"
  | "LIST_NOT_DRAFT"
  | "LIST_EMPTY"
  | "INVALID_QUANTITY"
  | "PRODUCT_NOT_FOUND"
  | "NOT_HOUSEHOLD_SIDE"
  | "LIST_NOT_SENT"
  | "LIST_ARCHIVED"
  | "INVALID_STATUS"
  | "ITEM_NOT_FOUND"
  | "INVALID_PHOTO_PATH"
  | "TOO_MANY_PHOTOS"
  | "NOT_CONFIGURED"
  | "UNKNOWN";

const KNOWN_CODES: ListErrorCode[] = [
  "AUTH_REQUIRED",
  "FORBIDDEN",
  "LIST_NOT_FOUND",
  "LIST_NOT_DRAFT",
  "LIST_EMPTY",
  "INVALID_QUANTITY",
  "PRODUCT_NOT_FOUND",
  "NOT_HOUSEHOLD_SIDE",
  "LIST_NOT_SENT",
  "LIST_ARCHIVED",
  "INVALID_STATUS",
  "ITEM_NOT_FOUND",
  "INVALID_PHOTO_PATH",
  "TOO_MANY_PHOTOS",
];

export function toListErrorCode(message: string | undefined): ListErrorCode {
  if (!message) return "UNKNOWN";
  return KNOWN_CODES.find((code) => message.includes(code)) ?? "UNKNOWN";
}

export type ListActionResult<T = undefined> =
  | { ok: true; value: T }
  | { ok: false; code: ListErrorCode };
