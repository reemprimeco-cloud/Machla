import "server-only";

import { connect, constants } from "node:http2";
import type { ClientHttp2Session } from "node:http2";
import { createPrivateKey, sign } from "node:crypto";

/**
 * Apple Push Notification service — the App Store build's transport.
 *
 * The web build uses Web Push (`send.ts`), which covers every browser
 * including the iOS home-screen PWA. It cannot cover a WKWebView app:
 * Safari grants the Push API only to a site the user installed to their
 * own Home Screen, so inside our own app shell there is no PushManager to
 * subscribe with. A native app talks to APNs instead, and this is that
 * half. `sendPendingPushes` picks between the two per recipient row —
 * there is still exactly one fan-out (20260814100000_apns_push.sql).
 *
 * NO DEPENDENCY
 *
 * Every APNs library on npm exists to do three things: sign an ES256 JWT,
 * hold an HTTP/2 connection, and POST JSON. Node does all three in its
 * standard library, and the parts a library would save us from — token
 * refresh windows, the `:path` format, which failure reasons are
 * permanent — are exactly the parts you have to understand anyway to
 * operate this. So it is written out, once, here.
 *
 * CONFIGURATION (Vercel project env, Production + Preview)
 *
 *   APNS_KEY_ID       the 10-character Key ID of the .p8 auth key
 *   APNS_TEAM_ID      the 10-character Apple Developer Team ID
 *   APNS_BUNDLE_ID    app.reemora.machla — must match the built app
 *   APNS_PRIVATE_KEY  the whole .p8 file, BEGIN/END lines included
 *   APNS_ENVIRONMENT  "production" (default) or "sandbox"
 *
 * APNS_PRIVATE_KEY is a signing key: it goes in the server-side env only,
 * never in a NEXT_PUBLIC_* variable, and never in the repository. One .p8
 * signs for every app on the team and Apple lets you download it exactly
 * once, so losing it means revoking and re-issuing.
 *
 * The environment matters more than it looks: a token minted by a
 * development build (Xcode run, or a TestFlight build signed with a
 * development profile) is only valid against the sandbox host, and a
 * production token only against the production host. Sending to the wrong
 * one returns BadDeviceToken, which reads exactly like a stale token.
 */

const PRODUCTION_HOST = "https://api.push.apple.com";
const SANDBOX_HOST = "https://api.sandbox.push.apple.com";

/** Apple rejects provider tokens refreshed more often than once every 20
 * minutes, and expires them after 60. Anywhere in between is safe; 50
 * leaves room for a cold start to reuse a warm module. */
const TOKEN_TTL_MS = 50 * 60 * 1000;

/** A whole batch shares one connection, so this bounds the batch, not a
 * single notification. Push is best-effort and runs after the user's
 * action already succeeded — waiting longer helps nobody. */
const REQUEST_TIMEOUT_MS = 10_000;

export interface ApnsPayload {
  title: string;
  body: string;
  /** Groups related alerts in Notification Center, like Web Push's `tag`. */
  threadId: string;
  /** In-app path to open on tap. Read natively from `userInfo["url"]`. */
  url: string;
}

export type ApnsResult =
  | { ok: true }
  | { ok: false; gone: boolean; reason: string };

interface ApnsConfig {
  keyId: string;
  teamId: string;
  bundleId: string;
  privateKey: string;
  host: string;
}

function readConfig(): ApnsConfig | null {
  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APNS_TEAM_ID;
  const bundleId = process.env.APNS_BUNDLE_ID;
  const privateKey = process.env.APNS_PRIVATE_KEY;
  if (!keyId || !teamId || !bundleId || !privateKey) return null;

  return {
    keyId,
    teamId,
    bundleId,
    // A .p8 is a multi-line PEM. Vercel's dashboard preserves real
    // newlines, but a value pasted through a shell or a CI secret often
    // arrives with them escaped, and createPrivateKey rejects that with
    // an error that names neither cause.
    privateKey: privateKey.includes("\\n") ? privateKey.replaceAll("\\n", "\n") : privateKey,
    host: process.env.APNS_ENVIRONMENT === "sandbox" ? SANDBOX_HOST : PRODUCTION_HOST,
  };
}

/** Mirrors isPushConfigured(): every APNs path degrades to a no-op when
 * the credentials are absent, so a deployment without them still sends
 * web pushes rather than failing. */
export function isApnsConfigured(): boolean {
  return readConfig() !== null;
}

function base64url(input: Buffer | string): string {
  return (typeof input === "string" ? Buffer.from(input) : input).toString("base64url");
}

let cachedToken: { value: string; expiresAt: number } | null = null;

/** The provider token: an ES256 JWT whose only claims are "which team"
 * and "when". It authenticates the sender, not the message, which is why
 * one token serves every device. */
function providerToken(config: ApnsConfig): string {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now) return cachedToken.value;

  const header = base64url(JSON.stringify({ alg: "ES256", kid: config.keyId, typ: "JWT" }));
  const claims = base64url(JSON.stringify({ iss: config.teamId, iat: Math.floor(now / 1000) }));
  const signingInput = `${header}.${claims}`;

  // JOSE wants the raw r||s pair. Node signs ECDSA as DER by default,
  // which APNs rejects as a malformed token — `ieee-p1363` is the raw
  // encoding, and skipping it is the classic way to get an opaque 403.
  const signature = sign("sha256", Buffer.from(signingInput), {
    key: createPrivateKey(config.privateKey),
    dsaEncoding: "ieee-p1363",
  });

  const value = `${signingInput}.${base64url(signature)}`;
  cachedToken = { value, expiresAt: now + TOKEN_TTL_MS };
  return value;
}

/** Reasons Apple will never accept this token again, whatever we do:
 * the app was deleted, or the token belongs to the other environment.
 * Anything else (throttling, an Apple outage, a malformed payload) is
 * either transient or our bug, and deleting the row would be wrong. */
const PERMANENT_FAILURES = new Set(["BadDeviceToken", "Unregistered", "DeviceTokenNotForTopic"]);

export interface ApnsSender {
  send: (deviceToken: string, payload: ApnsPayload) => Promise<ApnsResult>;
  close: () => void;
}

/**
 * Opens one HTTP/2 session for a batch of sends. APNs multiplexes them
 * over that single connection, which is the entire point of its HTTP/2
 * interface — opening a connection per notification is both slower and a
 * good way to get throttled.
 *
 * Returns null when APNs is not configured, so callers can skip the whole
 * branch rather than checking the environment themselves.
 */
export function createApnsSender(): ApnsSender | null {
  const config = readConfig();
  if (!config) return null;

  let session: ClientHttp2Session | null = null;

  function getSession(): ClientHttp2Session {
    if (session && !session.closed && !session.destroyed) return session;
    session = connect(config!.host);
    // Without a listener, a connection-level error is an unhandled 'error'
    // event, which takes down the whole serverless invocation — including
    // the request the user is waiting on. Per-request rejections are
    // handled in send(); this is purely the safety net.
    session.on("error", () => {});
    return session;
  }

  async function send(deviceToken: string, payload: ApnsPayload): Promise<ApnsResult> {
    return new Promise<ApnsResult>((resolve) => {
      let settled = false;
      const settle = (result: ApnsResult) => {
        if (settled) return;
        settled = true;
        resolve(result);
      };

      let request: ReturnType<ClientHttp2Session["request"]>;
      try {
        request = getSession().request({
          [constants.HTTP2_HEADER_METHOD]: "POST",
          [constants.HTTP2_HEADER_PATH]: `/3/device/${deviceToken}`,
          [constants.HTTP2_HEADER_AUTHORIZATION]: `bearer ${providerToken(config!)}`,
          [constants.HTTP2_HEADER_CONTENT_TYPE]: "application/json",
          "apns-topic": config!.bundleId,
          // "alert" is what lets the notification be shown while the app
          // is backgrounded or closed; the default would be treated as a
          // background update and silently dropped.
          "apns-push-type": "alert",
          "apns-priority": "10",
        });
      } catch (error) {
        settle({ ok: false, gone: false, reason: String(error) });
        return;
      }

      request.setEncoding("utf8");
      request.setTimeout(REQUEST_TIMEOUT_MS, () => {
        request.close();
        settle({ ok: false, gone: false, reason: "Timeout" });
      });

      let status = 0;
      let body = "";

      request.on("response", (headers) => {
        status = Number(headers[constants.HTTP2_HEADER_STATUS]) || 0;
      });
      request.on("data", (chunk: string) => {
        body += chunk;
      });
      request.on("error", (error) => settle({ ok: false, gone: false, reason: error.message }));
      request.on("end", () => {
        if (status === 200) {
          settle({ ok: true });
          return;
        }
        // Every APNs failure body is {"reason":"..."} — but a proxy or an
        // outage can return something else entirely, so this must not
        // assume it parses.
        let reason = `HTTP ${status}`;
        try {
          const parsed = JSON.parse(body) as { reason?: string };
          if (parsed.reason) reason = parsed.reason;
        } catch {
          // Keep the status-code reason.
        }
        settle({ ok: false, gone: PERMANENT_FAILURES.has(reason), reason });
      });

      request.end(
        JSON.stringify({
          aps: {
            alert: { title: payload.title, body: payload.body },
            sound: "default",
            "thread-id": payload.threadId,
          },
          // Outside `aps`, so it reaches the app untouched as userInfo.
          url: payload.url,
        }),
      );
    });
  }

  function close() {
    session?.close();
    session = null;
  }

  return { send, close };
}
