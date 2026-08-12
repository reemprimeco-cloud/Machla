/**
 * Sanitizes a `?next=` redirect target.
 *
 * Used by the invitation deep link (/join/<code>), which sends an
 * unauthenticated visitor through sign-in and then back to the same
 * page. Only same-site absolute paths are allowed: anything protocol-
 * relative ("//evil.com"), absolute-URL, or otherwise unparseable falls
 * back to "/", so the parameter can never be used as an open redirect.
 */
export function safeNextPath(raw: string | undefined | null): string {
  if (!raw) return "/";
  if (!raw.startsWith("/")) return "/";
  if (raw.startsWith("//")) return "/";
  // Backslashes are normalized to forward slashes by some user agents,
  // which would turn "/\evil.com" into a protocol-relative URL.
  if (raw.includes("\\")) return "/";
  return raw;
}
