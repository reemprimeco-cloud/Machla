#!/usr/bin/env node
// Asserts every locale JSON file in locales/ has exactly the same set of
// keys as en.json (the canonical set). Catches missing translations and
// stray/typo'd keys before they ship. Plain Node, no dependencies —
// deliberately not a full test framework (Phase 2 doesn't need one yet).

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const localesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "locales");
const CANONICAL = "en.json";

function flattenKeys(obj, prefix = "") {
  return Object.entries(obj).flatMap(([key, value]) => {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    return value && typeof value === "object" && !Array.isArray(value)
      ? flattenKeys(value, fullKey)
      : [fullKey];
  });
}

const files = readdirSync(localesDir).filter((file) => file.endsWith(".json")).sort();

if (!files.includes(CANONICAL)) {
  console.error(`Missing canonical locale file: ${CANONICAL}`);
  process.exit(1);
}

const base = JSON.parse(readFileSync(path.join(localesDir, CANONICAL), "utf8"));
const baseKeys = new Set(flattenKeys(base));

let failed = false;

for (const file of files) {
  if (file === CANONICAL) continue;

  const data = JSON.parse(readFileSync(path.join(localesDir, file), "utf8"));
  const keys = new Set(flattenKeys(data));

  const missing = [...baseKeys].filter((key) => !keys.has(key));
  const extra = [...keys].filter((key) => !baseKeys.has(key));

  if (missing.length > 0 || extra.length > 0) {
    failed = true;
    console.error(`✗ ${file}`);
    if (missing.length > 0) console.error(`    missing: ${missing.join(", ")}`);
    if (extra.length > 0) console.error(`    unexpected: ${extra.join(", ")}`);
  }
}

if (failed) {
  console.error("\nLocale key parity check FAILED.");
  process.exit(1);
}

console.log(`Locale key parity OK — ${files.length} files, ${baseKeys.size} keys each.`);
