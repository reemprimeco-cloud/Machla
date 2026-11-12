import "server-only";

import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import { BlockList, isIP, type LookupFunction } from "node:net";

/**
 * Server-side fetch of an admin-pasted image URL, hardened against SSRF
 * (2026-11-12 security audit). The plain `fetch(url, { redirect: "follow" })`
 * this replaces would request any address at all — loopback, the cloud
 * metadata endpoint, private ranges — and follow a redirect anywhere.
 *
 * - Every resolved address is checked at connect time, inside the socket's
 *   own DNS lookup, so a hostname cannot pass a check and then rebind to an
 *   internal address before the connection opens.
 * - Redirects are followed by hand and re-validated hop by hop.
 * - One deadline covers the whole exchange, body included; the body is
 *   capped while streaming rather than after it has all arrived.
 * - The bytes must actually be a raster image (magic-number sniff); the
 *   response's own Content-Type is not trusted for what gets stored.
 *
 * Node built-ins only — no new dependency.
 */

const MAX_BYTES = 15 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 15_000;

const blocked = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  blocked.addSubnet(network, prefix, "ipv4");
}
for (const [network, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["::ffff:0:0", 96],
  ["64:ff9b::", 96],
  ["100::", 64],
  ["2001::", 32],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) {
  blocked.addSubnet(network, prefix, "ipv6");
}

function isBlockedAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return blocked.check(address, "ipv4");
  if (family === 6) return blocked.check(address, "ipv6");
  return true;
}

class BlockedAddressError extends Error {
  code = "EBLOCKEDADDRESS";
}

/** Rejects the whole hostname if ANY of its records is internal, so a
 * mixed public/private answer cannot be used to slip through. */
const safeLookup: LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, "");
    if (addresses.length === 0 || addresses.some((entry) => isBlockedAddress(entry.address))) {
      return callback(new BlockedAddressError(hostname), "");
    }
    if (options.all) return callback(null, addresses);
    callback(null, addresses[0].address, addresses[0].family);
  });
};

/** Protocol, port and literal-IP checks — the parts the DNS hook never
 * sees, because Node skips lookup entirely for an IP-literal host. */
function isAllowedTarget(url: URL): boolean {
  if (url.protocol !== "https:" && url.protocol !== "http:") return false;
  if (url.port !== "" && url.port !== "80" && url.port !== "443") return false;
  if (url.username || url.password) return false;
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host) !== 0 && isBlockedAddress(host)) return false;
  return true;
}

function request(url: URL, signal: AbortSignal): Promise<http.IncomingMessage> {
  return new Promise((resolve, reject) => {
    const client = url.protocol === "https:" ? https : http;
    const req = client.get(
      url,
      { lookup: safeLookup, signal, headers: { accept: "image/*" } },
      resolve,
    );
    req.on("error", reject);
  });
}

class TooLargeError extends Error {}

function readBody(response: http.IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    let ended = false;
    response.on("data", (chunk: Buffer) => {
      total += chunk.length;
      if (total > MAX_BYTES) {
        response.destroy();
        reject(new TooLargeError());
        return;
      }
      chunks.push(chunk);
    });
    response.on("end", () => {
      ended = true;
      resolve(Buffer.concat(chunks));
    });
    response.on("error", reject);
    response.on("close", () => {
      if (!ended) reject(new Error("closed before end"));
    });
  });
}

/** Identifies the format from the bytes themselves. SVG is deliberately
 * absent: it can carry script, and nothing here needs a vector format. */
function sniffImageType(buffer: Buffer): string | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return "image/png";
  }
  if (buffer.length >= 6) {
    const head = buffer.subarray(0, 6).toString("latin1");
    if (head === "GIF87a" || head === "GIF89a") return "image/gif";
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("latin1") === "RIFF" &&
    buffer.subarray(8, 12).toString("latin1") === "WEBP"
  ) {
    return "image/webp";
  }
  if (buffer.length >= 12 && buffer.subarray(4, 8).toString("latin1") === "ftyp") {
    const brand = buffer.subarray(8, 12).toString("latin1");
    if (brand === "avif" || brand === "avis") return "image/avif";
  }
  return null;
}

export type FetchRemoteImageFailure = "INVALID_URL" | "FETCH_FAILED" | "NOT_IMAGE" | "BAD_SIZE";

export type FetchRemoteImageResult =
  | { ok: true; buffer: Buffer; contentType: string }
  | { ok: false; reason: FetchRemoteImageFailure };

export async function fetchRemoteImage(rawUrl: string): Promise<FetchRemoteImageResult> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, reason: "INVALID_URL" };
  }

  const signal = AbortSignal.timeout(TIMEOUT_MS);

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!isAllowedTarget(url)) return { ok: false, reason: "INVALID_URL" };

    let response: http.IncomingMessage;
    try {
      response = await request(url, signal);
    } catch (err) {
      return { ok: false, reason: err instanceof BlockedAddressError ? "INVALID_URL" : "FETCH_FAILED" };
    }

    const status = response.statusCode ?? 0;
    const location = response.headers.location;

    if (status >= 300 && status < 400 && location) {
      response.resume();
      try {
        url = new URL(location, url);
      } catch {
        return { ok: false, reason: "INVALID_URL" };
      }
      continue;
    }

    if (status < 200 || status >= 300) {
      response.resume();
      return { ok: false, reason: "FETCH_FAILED" };
    }

    const declaredType = (response.headers["content-type"] ?? "").toLowerCase();
    if (!declaredType.startsWith("image/")) {
      response.resume();
      return { ok: false, reason: "NOT_IMAGE" };
    }

    const declaredLength = Number(response.headers["content-length"]);
    if (Number.isFinite(declaredLength) && declaredLength > MAX_BYTES) {
      response.destroy();
      return { ok: false, reason: "BAD_SIZE" };
    }

    let buffer: Buffer;
    try {
      buffer = await readBody(response);
    } catch (err) {
      return { ok: false, reason: err instanceof TooLargeError ? "BAD_SIZE" : "FETCH_FAILED" };
    }
    if (buffer.byteLength === 0) return { ok: false, reason: "BAD_SIZE" };

    const contentType = sniffImageType(buffer);
    if (!contentType) return { ok: false, reason: "NOT_IMAGE" };

    return { ok: true, buffer, contentType };
  }

  return { ok: false, reason: "FETCH_FAILED" };
}
