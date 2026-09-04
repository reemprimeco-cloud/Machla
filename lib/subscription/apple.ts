import "server-only";

import { createPrivateKey, sign } from "node:crypto";

import type { SubscriptionStatus } from "@/lib/supabase/database.types";

/**
 * Apple's App Store Server API — the source of truth for a household's
 * subscription, looked up directly from Apple rather than trusted from
 * whatever the device says.
 *
 * NO DEPENDENCY, same reasoning as lib/push/apns.ts: the whole thing is
 * signing one ES256 JWT and making one authenticated GET, both of which
 * Node's standard library already does.
 *
 * CONFIGURATION (Vercel project env, Production + Preview)
 *
 *   APPLE_IAP_KEY_ID       Key ID of an "In-App Purchase" API key
 *                          (App Store Connect > Users and Access >
 *                          Integrations > In-App Purchase, NOT the APNs
 *                          auth key used by lib/push/apns.ts — a
 *                          different key, a different purpose)
 *   APPLE_IAP_ISSUER_ID    the Issuer ID shown on that same page
 *   APPLE_IAP_PRIVATE_KEY  the whole .p8 file, BEGIN/END lines included
 *
 * Reuses APNS_BUNDLE_ID for the "bid" claim below — it names the same
 * app bundle either way, so there is no reason for a second copy of it.
 */

const PRODUCTION_HOST = "https://api.storekit.itunes.apple.com";
const SANDBOX_HOST = "https://api.storekit-sandbox.itunes.apple.com";

/** Apple rejects a token older than 60 minutes; 55 leaves room for a
 * cold start to reuse a warm module, same margin lib/push/apns.ts uses. */
const TOKEN_TTL_MS = 55 * 60 * 1000;

interface IapConfig {
  keyId: string;
  issuerId: string;
  bundleId: string;
  privateKey: string;
}

function readConfig(): IapConfig | null {
  const keyId = process.env.APPLE_IAP_KEY_ID;
  const issuerId = process.env.APPLE_IAP_ISSUER_ID;
  const bundleId = process.env.APNS_BUNDLE_ID;
  const privateKey = process.env.APPLE_IAP_PRIVATE_KEY;
  if (!keyId || !issuerId || !bundleId || !privateKey) return null;

  return {
    keyId,
    issuerId,
    bundleId,
    // Same escaping gotcha as APNS_PRIVATE_KEY: a .p8 pasted through a
    // shell or CI secret often arrives with its newlines escaped.
    privateKey: privateKey.includes("\\n") ? privateKey.replaceAll("\\n", "\n") : privateKey,
  };
}

export function isAppleIapConfigured(): boolean {
  return readConfig() !== null;
}

function base64url(input: Buffer | string): string {
  return (typeof input === "string" ? Buffer.from(input) : input).toString("base64url");
}

let cachedToken: { value: string; expiresAt: number } | null = null;

/** The API's bearer token: an ES256 JWT identifying which developer
 * account is asking, not which household — one token serves every
 * lookup. */
function bearerToken(config: IapConfig): string {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now) return cachedToken.value;

  const nowSeconds = Math.floor(now / 1000);
  const header = base64url(JSON.stringify({ alg: "ES256", kid: config.keyId, typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({
      iss: config.issuerId,
      iat: nowSeconds,
      exp: nowSeconds + 55 * 60,
      aud: "appstoreconnect-v1",
      bid: config.bundleId,
    }),
  );
  const signingInput = `${header}.${claims}`;

  // JOSE wants the raw r||s pair, not Node's default DER encoding — the
  // same ieee-p1363 requirement APNs has, and skipping it here gets a
  // 401 instead of APNs' 403, but it is the identical mistake.
  const signature = sign("sha256", Buffer.from(signingInput), {
    key: createPrivateKey(config.privateKey),
    dsaEncoding: "ieee-p1363",
  });

  const value = `${signingInput}.${base64url(signature)}`;
  cachedToken = { value, expiresAt: now + TOKEN_TTL_MS };
  return value;
}

/**
 * Decodes — without re-verifying — the payload of a JWS Apple just sent
 * back over the TLS connection this module opened itself. The transport
 * is the trust boundary here, exactly like reading any other field out
 * of an HTTPS JSON response; there is no separate signature worth
 * checking on top of a connection we authenticated ourselves by dialing
 * Apple's own hostname.
 *
 * This is NOT how to handle a `signedPayload` arriving the other
 * direction, over a webhook Apple initiates (App Store Server
 * Notifications) — that channel is not one we dialed, so it would still
 * need real JWS signature + certificate-chain verification. This app
 * does not implement that webhook yet (see the migration's own comment);
 * subscription state is refreshed lazily instead, by calling back into
 * this module — a connection this server always initiates.
 */
function decodeJwsPayload<T>(jws: string): T {
  const [, payload] = jws.split(".");
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as T;
}

interface SignedTransactionInfo {
  originalTransactionId: string;
  expiresDate?: number;
}

/** Apple's numeric subscription status, collapsed to this app's own
 * four-value SubscriptionStatus (20260904160000_household_subscriptions.sql):
 * 1 active, 2 expired, 3 billing retry, 4 billing grace period, 5 revoked.
 * Both retry and grace period keep access — Apple is still trying to
 * charge the card, and a household should not lose the app mid-retry. */
function mapAppleStatus(status: number): SubscriptionStatus {
  switch (status) {
    case 1:
      return "active";
    case 3:
    case 4:
      return "grace_period";
    case 5:
      return "revoked";
    case 2:
    default:
      return "expired";
  }
}

export interface AppleSubscriptionState {
  originalTransactionId: string;
  status: SubscriptionStatus;
  /** ISO timestamp, or null if Apple gave none (a revoked/expired
   * transaction may not carry one). */
  periodEnd: string | null;
}

interface SubscriptionStatusesResponse {
  data?: Array<{
    lastTransactions?: Array<{
      originalTransactionId: string;
      status: number;
      signedTransactionInfo: string;
    }>;
  }>;
}

/**
 * The live status of a subscription, straight from Apple, keyed by its
 * originalTransactionId (stable across every renewal).
 *
 * Tries the production host first, then sandbox — Apple's own documented
 * pattern, since a TestFlight/Xcode-sandbox purchase 404s against
 * production and a real purchase 404s against sandbox, and a server has
 * no other way to know which one a given transaction came from.
 */
export async function fetchAppleSubscriptionState(
  originalTransactionId: string,
): Promise<AppleSubscriptionState | null> {
  const config = readConfig();
  if (!config) {
    console.error("[apple-iap] not configured");
    return null;
  }

  for (const host of [PRODUCTION_HOST, SANDBOX_HOST]) {
    let response: Response;
    try {
      response = await fetch(
        `${host}/inApps/v1/subscriptions/${encodeURIComponent(originalTransactionId)}`,
        { headers: { Authorization: `Bearer ${bearerToken(config)}` } },
      );
    } catch (err) {
      console.error("[apple-iap] request failed:", host, (err as Error).message);
      continue;
    }

    // 404 here means "not a transaction from this environment" — the
    // documented signal to retry the other host, not a real failure.
    if (response.status === 404) continue;
    if (!response.ok) {
      console.error("[apple-iap] unexpected status:", host, response.status);
      return null;
    }

    const body = (await response.json()) as SubscriptionStatusesResponse;
    const last = body.data?.[0]?.lastTransactions?.[0];
    if (!last) return null;

    const info = decodeJwsPayload<SignedTransactionInfo>(last.signedTransactionInfo);
    return {
      originalTransactionId: last.originalTransactionId,
      status: mapAppleStatus(last.status),
      periodEnd: info.expiresDate ? new Date(info.expiresDate).toISOString() : null,
    };
  }

  console.error("[apple-iap] transaction not found in either environment:", originalTransactionId);
  return null;
}
