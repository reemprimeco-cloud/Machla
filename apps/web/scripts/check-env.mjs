#!/usr/bin/env node
/**
 * Preflight for a deployment.
 *
 * Two failure modes this exists to prevent, both of which are quiet:
 *
 *   1. Deploying with the Supabase vars missing. The app is written to
 *      degrade rather than crash (lib/supabase/isConfigured.ts), so a
 *      misconfigured production deploy looks like a working app where
 *      nobody can log in — the worst kind of broken.
 *
 *   2. Deploying with the SERVICE ROLE key present. It must never exist in
 *      the web app's environment at all: it bypasses every RLS policy this
 *      project is built on. It belongs only to catalog-import/, run from a
 *      laptop.
 *
 *   node scripts/check-env.mjs
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Locally the vars live in .env.local, which `next` loads but bare `node`
 * does not — so without this the preflight fails on a correctly
 * configured machine, which teaches people to ignore it. On Vercel there
 * is no such file and the real environment is used, unchanged.
 *
 * Deliberately does not overwrite an existing process.env value: an
 * explicitly exported var should win over a stale file.
 */
function loadEnvLocal() {
  const path = resolve(dirname(fileURLToPath(import.meta.url)), "..", ".env.local");
  let contents;
  try {
    contents = readFileSync(path, "utf8");
  } catch {
    return; // No file: the environment is expected to be real (CI, Vercel).
  }

  for (const line of contents.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 1) continue;
    const name = trimmed.slice(0, separator).trim();
    // Strip one layer of matching quotes, the way dotenv does.
    const value = trimmed
      .slice(separator + 1)
      .trim()
      .replace(/^(['"])(.*)\1$/, "$2");
    if (!(name in process.env)) process.env[name] = value;
  }
}

loadEnvLocal();

const REQUIRED = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"];

// Anything matching these must NOT be set for the web app.
const FORBIDDEN = [/SERVICE_ROLE/i, /^SUPABASE_SECRET/i, /_SECRET_KEY$/i];

const problems = [];

for (const name of REQUIRED) {
  const value = process.env[name];
  if (!value) problems.push(`missing ${name}`);
  else if (name.endsWith("URL") && !/^https:\/\/.+\.supabase\.(co|in)$/.test(value.trim()))
    problems.push(`${name} does not look like a Supabase project URL: ${value}`);
  else if (name.endsWith("ANON_KEY") && value.trim().length < 40)
    problems.push(`${name} looks too short to be a real key`);
}

for (const name of Object.keys(process.env)) {
  if (FORBIDDEN.some((pattern) => pattern.test(name))) {
    problems.push(
      `${name} is set — a service-role/secret key must NEVER be in the web app's environment; ` +
        `it bypasses every RLS policy. Remove it from the deployment and rotate it.`,
    );
  }
}

// A public var holding something that looks like a JWT with the service
// role in it — the specific accident of pasting the wrong key into
// NEXT_PUBLIC_SUPABASE_ANON_KEY, which would ship it to every browser.
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
try {
  const [, payload] = anon.split(".");
  if (payload) {
    const claims = JSON.parse(Buffer.from(payload, "base64").toString("utf8"));
    if (claims.role && claims.role !== "anon") {
      problems.push(
        `NEXT_PUBLIC_SUPABASE_ANON_KEY carries role="${claims.role}", not "anon". ` +
          `This key is served to every browser — rotate it immediately.`,
      );
    }
  }
} catch {
  // Not a JWT, or not decodable. The length check above already covers the
  // obvious "someone pasted a placeholder" case.
}

if (problems.length > 0) {
  console.error("environment check failed:");
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log(`environment OK — ${REQUIRED.length} required vars present, no secret keys exposed.`);
