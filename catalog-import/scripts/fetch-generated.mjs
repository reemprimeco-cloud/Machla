#!/usr/bin/env node
/**
 * One-time helper: downloads freshly generated product images (from this
 * session's Higgsfield generations) into catalog-import/images/generated/,
 * converting them to the house style (400x400 webp) the rest of that
 * directory already uses.
 *
 * Run locally (needs real internet access — this cannot run inside a
 * sandboxed Claude Code session):
 *
 *   cd catalog-import && npm install sharp   # if not already present
 *   node scripts/fetch-generated.mjs
 *
 * Then upload with the existing pipeline:
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     node scripts/upload-images.mjs
 */

import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT_DIR = path.join(ROOT, "images", "generated");

// Round 1 (juices + banana/strawberry milk) already fetched and uploaded —
// not repeated here. This file gets replaced with each new round; run it,
// then upload-images.mjs, each time before the next round lands.
//
// Round 2: Cooking & Pantry (17 types).
const IMAGES = {
  baking_powder: "https://d8j0ntlcm91z4.cloudfront.net/user_3AGhTHKPN3FQpd6GCElZeyNv3tQ/hf_20260819_083717_3e08bedc-35ba-4181-ac4f-62dc059c9c06.png",
  black_pepper: "https://d8j0ntlcm91z4.cloudfront.net/user_3AGhTHKPN3FQpd6GCElZeyNv3tQ/hf_20260819_083717_c8d1fb42-a511-43ef-ae23-8daceff7f61e.png",
  cardamom: "https://d8j0ntlcm91z4.cloudfront.net/user_3AGhTHKPN3FQpd6GCElZeyNv3tQ/hf_20260819_083717_74bd58f5-430b-433d-b4c1-ba90ae7786f1.png",
  chili_powder: "https://d8j0ntlcm91z4.cloudfront.net/user_3AGhTHKPN3FQpd6GCElZeyNv3tQ/hf_20260819_083717_aa585abd-9664-42b8-9172-af489c2152c0.png",
  cinnamon: "https://d8j0ntlcm91z4.cloudfront.net/user_3AGhTHKPN3FQpd6GCElZeyNv3tQ/hf_20260819_083717_1423497d-b599-46a9-824e-472eeb341e79.png",
  coriander_powder: "https://d8j0ntlcm91z4.cloudfront.net/user_3AGhTHKPN3FQpd6GCElZeyNv3tQ/hf_20260819_083717_5f3caad1-7976-49da-95bd-37bc5dbbe1f2.png",
  corn_oil: "https://d8j0ntlcm91z4.cloudfront.net/user_3AGhTHKPN3FQpd6GCElZeyNv3tQ/hf_20260819_083717_a4654532-556e-4222-8f09-413df94041b8.png",
  cumin: "https://d8j0ntlcm91z4.cloudfront.net/user_3AGhTHKPN3FQpd6GCElZeyNv3tQ/hf_20260819_083717_de873d45-da20-4d39-b49d-6b77581e364c.png",
  ghee: "https://d8j0ntlcm91z4.cloudfront.net/user_3AGhTHKPN3FQpd6GCElZeyNv3tQ/hf_20260819_083717_c114b57f-02dd-4d77-b22d-102b2e4fb603.png",
  mixed_spices: "https://d8j0ntlcm91z4.cloudfront.net/user_3AGhTHKPN3FQpd6GCElZeyNv3tQ/hf_20260819_083717_d5e3b84e-81af-4f66-994c-f327c09443a4.png",
  olive_oil: "https://d8j0ntlcm91z4.cloudfront.net/user_3AGhTHKPN3FQpd6GCElZeyNv3tQ/hf_20260819_083717_aaef16d3-8e8c-494c-a524-7f19778a52b8.png",
  salt: "https://d8j0ntlcm91z4.cloudfront.net/user_3AGhTHKPN3FQpd6GCElZeyNv3tQ/hf_20260819_083717_d8aee40b-ed75-4bbd-b363-debc02f5e0a1.png",
  sugar: "https://d8j0ntlcm91z4.cloudfront.net/user_3AGhTHKPN3FQpd6GCElZeyNv3tQ/hf_20260819_083822_91bd4c36-564b-492c-823a-b96965e08c53.png",
  sunflower_oil: "https://d8j0ntlcm91z4.cloudfront.net/user_3AGhTHKPN3FQpd6GCElZeyNv3tQ/hf_20260819_083822_b8f37943-05e7-4d8d-9ebf-33884156f79a.png",
  turmeric: "https://d8j0ntlcm91z4.cloudfront.net/user_3AGhTHKPN3FQpd6GCElZeyNv3tQ/hf_20260819_083822_47949408-eae2-4a79-909f-d769ecb82f73.png",
  vinegar: "https://d8j0ntlcm91z4.cloudfront.net/user_3AGhTHKPN3FQpd6GCElZeyNv3tQ/hf_20260819_083822_89417bb4-258c-416a-8e3e-ceef191e4327.png",
  yeast: "https://d8j0ntlcm91z4.cloudfront.net/user_3AGhTHKPN3FQpd6GCElZeyNv3tQ/hf_20260819_083822_d000ab4a-23c2-460e-a4e4-9ae14157ece9.png",

  // Round 3: Canned & Sauces (15 types).
  canned_beans: "https://d8j0ntlcm91z4.cloudfront.net/user_3AGhTHKPN3FQpd6GCElZeyNv3tQ/hf_20260819_084027_71bd0e97-018c-4b6a-9bd6-794430fea977.png",
  canned_corn: "https://d8j0ntlcm91z4.cloudfront.net/user_3AGhTHKPN3FQpd6GCElZeyNv3tQ/hf_20260819_084027_37a50a31-559c-4269-91e9-6da69af0fdae.png",
  canned_tomato: "https://d8j0ntlcm91z4.cloudfront.net/user_3AGhTHKPN3FQpd6GCElZeyNv3tQ/hf_20260819_084027_2aa6d572-6ae8-449b-a006-7802762209c0.png",
  chickpeas_can: "https://d8j0ntlcm91z4.cloudfront.net/user_3AGhTHKPN3FQpd6GCElZeyNv3tQ/hf_20260819_084027_ad940329-c00f-46dd-833c-e143ba26db35.png",
  honey: "https://d8j0ntlcm91z4.cloudfront.net/user_3AGhTHKPN3FQpd6GCElZeyNv3tQ/hf_20260819_084027_820277f2-eb20-4056-a8b5-49c89384474f.png",
  hot_sauce: "https://d8j0ntlcm91z4.cloudfront.net/user_3AGhTHKPN3FQpd6GCElZeyNv3tQ/hf_20260819_084027_2eab8359-5071-49fb-b755-bcfc4d3efc7c.png",
  jam: "https://d8j0ntlcm91z4.cloudfront.net/user_3AGhTHKPN3FQpd6GCElZeyNv3tQ/hf_20260819_084027_80a19e8d-fb3e-47c8-b71c-f6ed7afd51c5.png",
  ketchup: "https://d8j0ntlcm91z4.cloudfront.net/user_3AGhTHKPN3FQpd6GCElZeyNv3tQ/hf_20260819_084027_3d2b9b8f-0630-441e-a512-c8d7ed487e5f.png",
  mayonnaise: "https://d8j0ntlcm91z4.cloudfront.net/user_3AGhTHKPN3FQpd6GCElZeyNv3tQ/hf_20260819_084138_5355a2c3-4679-4d70-890c-32be3cefdecf.png",
  mustard: "https://d8j0ntlcm91z4.cloudfront.net/user_3AGhTHKPN3FQpd6GCElZeyNv3tQ/hf_20260819_084138_707629b7-6fac-4644-9956-ad31c40774d3.png",
  peanut_butter: "https://d8j0ntlcm91z4.cloudfront.net/user_3AGhTHKPN3FQpd6GCElZeyNv3tQ/hf_20260819_084138_4ade947f-acb6-46ba-8963-f6133ee5547f.png",
  soy_sauce: "https://d8j0ntlcm91z4.cloudfront.net/user_3AGhTHKPN3FQpd6GCElZeyNv3tQ/hf_20260819_084138_62633eb8-3fac-48bd-997e-f8157065ce1d.png",
  tahini: "https://d8j0ntlcm91z4.cloudfront.net/user_3AGhTHKPN3FQpd6GCElZeyNv3tQ/hf_20260819_084138_2f39b53e-329f-423e-b0e4-0470d26a2301.png",
  tomato_paste: "https://d8j0ntlcm91z4.cloudfront.net/user_3AGhTHKPN3FQpd6GCElZeyNv3tQ/hf_20260819_084138_0d848665-1958-4dd1-875c-b81af4cd93d5.png",
  tuna_can: "https://d8j0ntlcm91z4.cloudfront.net/user_3AGhTHKPN3FQpd6GCElZeyNv3tQ/hf_20260819_084139_fedf355a-1c44-4a9f-93bc-fb3b8b729a89.png",

  // Round 4: Frozen (8 types).
  frozen_fish: "https://d8j0ntlcm91z4.cloudfront.net/user_3AGhTHKPN3FQpd6GCElZeyNv3tQ/hf_20260819_084304_a41bc3ef-c743-4b78-acea-fdf22406914a.png",
  frozen_fries: "https://d8j0ntlcm91z4.cloudfront.net/user_3AGhTHKPN3FQpd6GCElZeyNv3tQ/hf_20260819_084303_94922012-c2f8-4bcb-8f86-c3ec70f616c0.png",
  frozen_nuggets: "https://d8j0ntlcm91z4.cloudfront.net/user_3AGhTHKPN3FQpd6GCElZeyNv3tQ/hf_20260819_084303_e47b07c6-e4ee-46e5-b2ea-399ec2863d74.png",
  frozen_paratha: "https://d8j0ntlcm91z4.cloudfront.net/user_3AGhTHKPN3FQpd6GCElZeyNv3tQ/hf_20260819_084304_61b38004-b507-4a9e-9f89-28097f572316.png",
  frozen_peas: "https://d8j0ntlcm91z4.cloudfront.net/user_3AGhTHKPN3FQpd6GCElZeyNv3tQ/hf_20260819_084303_dd8ae81b-6b38-4729-8cca-c99eee3605ef.png",
  frozen_samosa: "https://d8j0ntlcm91z4.cloudfront.net/user_3AGhTHKPN3FQpd6GCElZeyNv3tQ/hf_20260819_084304_6c299667-a5e3-41e1-89c9-fe79237b92ec.png",
  frozen_vegetables: "https://d8j0ntlcm91z4.cloudfront.net/user_3AGhTHKPN3FQpd6GCElZeyNv3tQ/hf_20260819_084304_03d2cf9d-49d7-4065-91ce-f898a331be1f.png",
  ice_cream: "https://d8j0ntlcm91z4.cloudfront.net/user_3AGhTHKPN3FQpd6GCElZeyNv3tQ/hf_20260819_084303_d48213eb-146b-4318-8961-907410b67366.png",

  // Round 5: rest of Drinks (7 types).
  arabic_coffee: "https://d8j0ntlcm91z4.cloudfront.net/user_3AGhTHKPN3FQpd6GCElZeyNv3tQ/hf_20260819_084425_623613d4-5bfe-4bf5-89a9-869489c21355.png",
  black_tea: "https://d8j0ntlcm91z4.cloudfront.net/user_3AGhTHKPN3FQpd6GCElZeyNv3tQ/hf_20260819_084425_ad1df839-b745-4c48-b716-65d4c3708682.png",
  green_tea: "https://d8j0ntlcm91z4.cloudfront.net/user_3AGhTHKPN3FQpd6GCElZeyNv3tQ/hf_20260819_084425_c1661d5a-112d-47e3-84db-09127f04d437.png",
  instant_coffee: "https://d8j0ntlcm91z4.cloudfront.net/user_3AGhTHKPN3FQpd6GCElZeyNv3tQ/hf_20260819_084425_eb97a334-a39b-4564-8ddb-adf89405dba6.png",
  soft_drink: "https://d8j0ntlcm91z4.cloudfront.net/user_3AGhTHKPN3FQpd6GCElZeyNv3tQ/hf_20260819_084425_41910071-8f6b-4e07-ad4d-88f75d935d03.png",
  tea_bags: "https://d8j0ntlcm91z4.cloudfront.net/user_3AGhTHKPN3FQpd6GCElZeyNv3tQ/hf_20260819_084425_ffac42bb-7ff6-427e-8a6c-1d8f6d90a698.png",
  water_bottle: "https://d8j0ntlcm91z4.cloudfront.net/user_3AGhTHKPN3FQpd6GCElZeyNv3tQ/hf_20260819_084425_006b6183-a580-472d-86ac-0249a863f385.png",

  // Round 6: Snacks & Sweets (8 types).
  biscuits: "https://d8j0ntlcm91z4.cloudfront.net/user_3AGhTHKPN3FQpd6GCElZeyNv3tQ/hf_20260819_084559_5a72aaba-7630-4a98-9a19-a71b9a12dd45.png",
  candy: "https://d8j0ntlcm91z4.cloudfront.net/user_3AGhTHKPN3FQpd6GCElZeyNv3tQ/hf_20260819_084559_153a5326-5f08-4759-9c07-846404338d24.png",
  chocolate: "https://d8j0ntlcm91z4.cloudfront.net/user_3AGhTHKPN3FQpd6GCElZeyNv3tQ/hf_20260819_084559_ce2ec6c1-903e-4fa0-ad0a-b4a9a86fb848.png",
  mixed_nuts: "https://d8j0ntlcm91z4.cloudfront.net/user_3AGhTHKPN3FQpd6GCElZeyNv3tQ/hf_20260819_084559_2c1f958a-00d3-4c34-85bd-8a74590f297b.png",
  peanuts: "https://d8j0ntlcm91z4.cloudfront.net/user_3AGhTHKPN3FQpd6GCElZeyNv3tQ/hf_20260819_084559_ba4eaabe-097e-403d-984e-34a569569692.png",
  popcorn: "https://d8j0ntlcm91z4.cloudfront.net/user_3AGhTHKPN3FQpd6GCElZeyNv3tQ/hf_20260819_084559_ae305fa4-1de0-4801-93ad-2e5da1a103b9.png",
  potato_chips: "https://d8j0ntlcm91z4.cloudfront.net/user_3AGhTHKPN3FQpd6GCElZeyNv3tQ/hf_20260819_084600_7f65008e-e70a-4c9b-998b-577e67cb99a2.png",
  wafer: "https://d8j0ntlcm91z4.cloudfront.net/user_3AGhTHKPN3FQpd6GCElZeyNv3tQ/hf_20260819_084559_e6b3fcdd-625f-41ae-b0e0-cc552e4ed884.png",

  // Round 7: Cleaning (13 types).
  air_freshener: "https://d8j0ntlcm91z4.cloudfront.net/user_3AGhTHKPN3FQpd6GCElZeyNv3tQ/hf_20260819_084818_b3dec533-291e-49f4-b39d-19b3e5450d99.png",
  bathroom_cleaner: "https://d8j0ntlcm91z4.cloudfront.net/user_3AGhTHKPN3FQpd6GCElZeyNv3tQ/hf_20260819_084818_538eb649-22d9-4416-999c-f22a6f62bd67.png",
  bleach: "https://d8j0ntlcm91z4.cloudfront.net/user_3AGhTHKPN3FQpd6GCElZeyNv3tQ/hf_20260819_084818_b8db3015-0406-4f5b-b085-0a7d0e79df95.png",
  cleaning_gloves: "https://d8j0ntlcm91z4.cloudfront.net/user_3AGhTHKPN3FQpd6GCElZeyNv3tQ/hf_20260819_084818_616ea83d-281d-40b7-9a1b-b7161a0b79bd.png",
  dish_soap: "https://d8j0ntlcm91z4.cloudfront.net/user_3AGhTHKPN3FQpd6GCElZeyNv3tQ/hf_20260819_084818_f8fd753c-a753-4570-8efe-4c0dd8b3e6ba.png",
  dishwasher_tablets: "https://d8j0ntlcm91z4.cloudfront.net/user_3AGhTHKPN3FQpd6GCElZeyNv3tQ/hf_20260819_084818_5f4e2630-65d3-4db0-9282-5389f6ed7827.png",
  fabric_softener: "https://d8j0ntlcm91z4.cloudfront.net/user_3AGhTHKPN3FQpd6GCElZeyNv3tQ/hf_20260819_084819_982a7a63-ca57-4051-9300-0fcd578bdf52.png",
  floor_cleaner: "https://d8j0ntlcm91z4.cloudfront.net/user_3AGhTHKPN3FQpd6GCElZeyNv3tQ/hf_20260819_084818_10bd1e2d-ee37-4539-99b9-7bc9fa7b91c4.png",
  garbage_bags: "https://d8j0ntlcm91z4.cloudfront.net/user_3AGhTHKPN3FQpd6GCElZeyNv3tQ/hf_20260819_084945_c6a67862-d112-4399-a9a1-193107c347a7.png",
  glass_cleaner: "https://d8j0ntlcm91z4.cloudfront.net/user_3AGhTHKPN3FQpd6GCElZeyNv3tQ/hf_20260819_084945_120e9d33-9784-4448-bbce-180b370886d7.png",
  laundry_liquid: "https://d8j0ntlcm91z4.cloudfront.net/user_3AGhTHKPN3FQpd6GCElZeyNv3tQ/hf_20260819_084946_def7d8f0-d601-432f-a071-e8dcd8342294.png",
  laundry_powder: "https://d8j0ntlcm91z4.cloudfront.net/user_3AGhTHKPN3FQpd6GCElZeyNv3tQ/hf_20260819_084945_92a3ba4a-a0e5-48ab-abba-bd0f93dbf9d4.png",
  sponge: "https://d8j0ntlcm91z4.cloudfront.net/user_3AGhTHKPN3FQpd6GCElZeyNv3tQ/hf_20260819_084945_9543164c-e99d-4dd4-907d-34be8574c338.png",
};

mkdirSync(OUT_DIR, { recursive: true });

const { default: sharp } = await import("sharp").catch(() => {
  console.error("error: sharp is not installed. Run `npm install sharp` in catalog-import/ first.");
  process.exit(1);
});

for (const [type, url] of Object.entries(IMAGES)) {
  process.stdout.write(`${type} ... `);
  const res = await fetch(url);
  if (!res.ok) {
    console.log(`FAILED (${res.status})`);
    continue;
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  const outPath = path.join(OUT_DIR, `${type}.webp`);
  await sharp(buffer)
    .resize(400, 400, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .webp({ quality: 82 })
    .toFile(outPath);
  console.log(`-> ${path.relative(ROOT, outPath)}`);
}

console.log("\ndone. Next: node scripts/upload-images.mjs --dry-run (then without --dry-run)");
